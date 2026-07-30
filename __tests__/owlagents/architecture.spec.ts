import { readdirSync, readFileSync } from "fs";
import { join } from "path";

/**
 * The layering gate.
 *
 * `.eslintrc.json` also declares these zones, but eslint is not in CI and jest
 * is — so this is the rule that actually holds. It walks the real source tree
 * and checks every import specifier against an explicit allow-list.
 */
const walk = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return walk(path);

    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")
      ? [path]
      : [];
  });

const IMPORT_PATTERN = /(?:from|import)\s+"([^"]+)"/g;

const importsOf = (path: string): string[] => {
  const source = readFileSync(path, "utf8");

  return [...source.matchAll(IMPORT_PATTERN)].map(([, specifier]) => specifier);
};

const isBare = (specifier: string): boolean =>
  !specifier.startsWith(".") &&
  !specifier.startsWith("owlagents/") &&
  !specifier.startsWith("components/") &&
  !specifier.startsWith("contexts/") &&
  !specifier.startsWith("hooks/") &&
  !specifier.startsWith("utils/") &&
  !specifier.startsWith("styles/") &&
  !specifier.startsWith("public/");

/** Layer -> the prefixes it may import. Anything else is a violation. */
const ALLOWED: Record<string, string[]> = {
  "owlagents/adapters": ["owlagents/adapters", "owlagents/domain"],
  "owlagents/domain": ["owlagents/domain"],
  "owlagents/selectors": ["owlagents/domain", "owlagents/selectors"],
  "owlagents/services": [
    "owlagents/adapters/types",
    "owlagents/domain",
    "owlagents/selectors",
    "owlagents/services",
  ],
  "owlagents/store": [
    "owlagents/adapters",
    "owlagents/domain",
    "owlagents/services",
  ],
};

const layerOf = (path: string): string | undefined =>
  Object.keys(ALLOWED).find((layer) =>
    path.replace(/\\/g, "/").includes(layer)
  );

const violations = walk("owlagents").flatMap((path) => {
  const layer = layerOf(path);

  if (!layer) return [];

  return importsOf(path)
    .filter((specifier) => !isBare(specifier))
    .filter(
      (specifier) =>
        !ALLOWED[layer]?.some((allowed) => specifier.startsWith(allowed))
    )
    .map((specifier) => `${path} imports ${specifier}`);
});

describe("owlagents layering", () => {
  test("no layer imports across a forbidden boundary", () =>
    expect(violations).toStrictEqual([]));

  test("the domain layer imports nothing but itself", () => {
    const leaks = walk(join("owlagents", "domain")).flatMap((path) =>
      importsOf(path)
        .filter((specifier) => !isBare(specifier))
        .filter((specifier) => !specifier.startsWith("owlagents/domain"))
        .map((specifier) => `${path} imports ${specifier}`)
    );

    expect(leaks).toStrictEqual([]);
  });

  /**
   * `getStaticPaths` imports the demo fixtures at build time in Node, so the
   * whole tree has to stay browser-free.
   */
  test("owlagents is React-free so it can run at build time", () => {
    const forbidden = ["react", "styled-components", "motion", "next"];
    const leaks = walk("owlagents").flatMap((path) =>
      importsOf(path)
        .filter((specifier) =>
          forbidden.some(
            (name) => specifier === name || specifier.startsWith(`${name}/`)
          )
        )
        .map((specifier) => `${path} imports ${specifier}`)
    );

    expect(leaks).toStrictEqual([]);
  });

  test("no relative imports anywhere in owlagents", () => {
    const relative = walk("owlagents").flatMap((path) =>
      importsOf(path)
        .filter((specifier) => specifier.startsWith("."))
        .map((specifier) => `${path} imports ${specifier}`)
    );

    expect(relative).toStrictEqual([]);
  });
});
