import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import {
  OWLAGENTS_APP_IDS,
  OWLAGENTS_REGISTRY,
  isOwlAgentsAppId,
} from "owlagents/registry";
import { buildShortcutFiles, START_MENU } from "scripts/owlAgentsShortcuts.js";

const walk = (directory: string): string[] =>
  existsSync(directory)
    ? readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = join(directory, entry.name);

        return entry.isDirectory() ? walk(entryPath) : [entryPath];
      })
    : [];

const generated = buildShortcutFiles();
const onDisk = walk(START_MENU);

const normalise = (contents: string): string => contents.replace(/\r\n/g, "\n");

const valueOf = (contents: string, key: string): string =>
  contents
    .split("\n")
    .find((line) => line.startsWith(`${key}=`))
    ?.slice(key.length + 1)
    .trim() ?? "";

/**
 * The Start menu is filesystem-driven, so its entries are generated from
 * `owlagents/registry.json` and committed. This test is what keeps the registry
 * the single owner: if someone edits a `.url` by hand, or adds an application
 * without regenerating, the sets stop matching and this fails.
 */
describe("start menu shortcuts are generated from the registry", () => {
  test("one shortcut per application, plus one desktop icon", () =>
    expect(generated).toHaveLength(OWLAGENTS_APP_IDS.length + 1));

  test("the files on disk are exactly the generated set", () =>
    expect(onDisk.toSorted((a, b) => a.localeCompare(b))).toStrictEqual(
      generated
        .filter((file) => file.path.startsWith(START_MENU))
        .map((file) => file.path)
        .toSorted((a, b) => a.localeCompare(b))
    ));

  /**
   * Compared line-ending agnostically: git's autocrlf rewrites these on a
   * Windows checkout, and the contract is the content, not the bytes.
   */
  test("the contents on disk match what the generator produces", () =>
    generated
      .filter((file) => existsSync(file.path))
      .forEach((file) =>
        expect(normalise(readFileSync(file.path, "utf8"))).toBe(
          normalise(file.contents)
        )
      ));

  test("every BaseURL is a registered application id", () =>
    generated.forEach((file) =>
      expect(isOwlAgentsAppId(valueOf(file.contents, "BaseURL"))).toBe(true)
    ));

  test("every IconFile resolves to a real asset", () =>
    generated.forEach((file) => {
      const name = valueOf(file.contents, "IconFile").split("/").pop() ?? "";

      expect(existsSync(join("public", "System", "Icons", "48x48", name))).toBe(
        true
      );
    }));

  test("groups are derived from the category, not hand-placed", () =>
    generated
      .filter((file) => file.path.startsWith(START_MENU))
      .forEach((file) => {
        const id = valueOf(file.contents, "BaseURL");

        if (!isOwlAgentsAppId(id)) return;

        const { category } = OWLAGENTS_REGISTRY[id];
        const expectedFolder =
          category === "advanced"
            ? "Advanced"
            : category === "diagnostic"
              ? "Diagnostics"
              : "OwlAgents";

        expect(file.path).toContain(expectedFolder);
      }));

  test("the desktop carries exactly one command-center icon", () =>
    expect(
      generated.filter((file) => file.path.includes("Desktop"))
    ).toHaveLength(1));
});
