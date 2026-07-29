const fs = require("fs");
const path = require("path");
const registry = require("../owlagents/registry.json");

const START_MENU = path.join(
  "public",
  "Users",
  "Public",
  "Start Menu",
  "OwlAgents"
);
const DESKTOP = path.join("public", "Users", "Public", "Desktop");

/** Category -> subfolder. Primary sits at the top of the OwlAgents group. */
const FOLDER_FOR_CATEGORY = {
  advanced: "Advanced",
  diagnostic: "Diagnostics",
  primary: "",
};

/** The one desktop icon: the landing application. */
const DESKTOP_APP = "MissionControl";

const shortcut = (entry) =>
  [
    "[InternetShortcut]",
    `BaseURL=${entry.id}`,
    `Comment=${entry.comment}`,
    `IconFile=${entry.icon}`,
    "",
  ].join("\n");

/**
 * Pure, and exported so the drift test asserts against this function rather
 * than a duplicated expectation. `owlagents/registry.json` is the only input:
 * remove a row and its shortcut disappears, add one and it appears.
 */
const buildShortcutFiles = (table = registry) => {
  const files = Object.entries(table).map(([id, entry]) => ({
    contents: shortcut({
      comment: `${entry.title} — daedalOS command center (${entry.category})`,
      icon: entry.icon,
      id,
    }),
    path: path.join(
      START_MENU,
      FOLDER_FOR_CATEGORY[entry.category],
      `${entry.title.replace(/[/\\:*?"<>|]/g, "-")}.url`
    ),
  }));

  const desktop = table[DESKTOP_APP];

  if (desktop) {
    files.push({
      contents: shortcut({
        comment: `${desktop.title} — daedalOS command center`,
        icon: desktop.icon,
        id: DESKTOP_APP,
      }),
      path: path.join(DESKTOP, "OwlAgents.url"),
    });
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
};

const write = () => {
  fs.rmSync(START_MENU, { force: true, recursive: true });

  buildShortcutFiles().forEach((file) => {
    fs.mkdirSync(path.dirname(file.path), { recursive: true });
    fs.writeFileSync(file.path, file.contents);
  });
};

module.exports = { buildShortcutFiles, DESKTOP, START_MENU };

if (require.main === module) write();
