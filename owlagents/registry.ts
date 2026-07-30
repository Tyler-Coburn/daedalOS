import registry from "owlagents/registry.json";

/**
 * The single owner of the command-center application table.
 *
 * `contexts/process/directory.ts` spreads these entries and adds only the
 * component. `scripts/owlAgentsShortcuts.js` reads the same JSON to generate the
 * Start-menu and desktop shortcuts. Deep links resolve against it too — so
 * there is no second hand-maintained list on any surface, and a jest test fails
 * if the generated shortcuts ever drift from this file.
 */
type OwlAgentsCategory = "advanced" | "diagnostic" | "primary";

/**
 * Structurally compatible with react-rnd's `Size`, declared locally because
 * `owlagents/**` may not import from `components/**`.
 */
type RegistrySize = { height: number; width: number };

type OwlAgentsRegistryEntry = {
  category: OwlAgentsCategory;
  deepLinkPatterns?: readonly string[];
  defaultSize: RegistrySize;
  icon: string;
  laneBadge: string;
  minSize: RegistrySize;
  requiredCapabilities: readonly string[];
  singleton: boolean;
  title: string;
};

export type OwlAgentsAppId = keyof typeof registry;

export const OWLAGENTS_REGISTRY = registry as Record<
  OwlAgentsAppId,
  OwlAgentsRegistryEntry
>;

export const OWLAGENTS_APP_IDS = Object.keys(registry) as OwlAgentsAppId[];

/** Start-menu group order, which is also the desktop grid order. */
export const OWLAGENTS_CATEGORY_ORDER: readonly OwlAgentsCategory[] = [
  "primary",
  "diagnostic",
  "advanced",
];

export const appIdsInCategory = (
  category: OwlAgentsCategory
): readonly OwlAgentsAppId[] =>
  OWLAGENTS_APP_IDS.filter(
    (id) => OWLAGENTS_REGISTRY[id].category === category
  );

export const isOwlAgentsAppId = (id: string): id is OwlAgentsAppId =>
  Object.hasOwn(registry, id);
