import { useCallback } from "react";
import { useProcesses } from "contexts/process";

type OwlWindowState = {
  clearDeepLinkError: () => void;
  deepLinkError: string | undefined;
  filter: string;
  selectedId: string;
  setFilter: (next: string) => void;
  setSelectedId: (next: string) => void;
  setTab: (next: string) => void;
  tab: string;
};

/**
 * Per-window view state, held on the process rather than in `SessionData`.
 *
 * `SessionData` is written to `/session.json` by a single effect that depends
 * on every persisted field, so a filter box typed into it would rewrite the OS
 * session file on every keystroke. More importantly this is *shell* state: no
 * service reads it, and every service call takes its expected version from the
 * store snapshot, so operational authority cannot leak through here.
 *
 * The selection is mirrored into `url` because that is the only field
 * `openProcess` re-targets when a singleton is re-opened by a deep link.
 */
type OwlWindowOptions = {
  defaultTab?: string;
  /**
   * Sources & Files composes the repository's File Explorer, which reads `url`
   * as a filesystem path. That window keeps its selection in `owlSelectedId`
   * only, so the path is never overwritten with a domain id.
   */
  mirrorSelectionToUrl?: boolean;
};

const useOwlWindow = (
  id: string,
  options: OwlWindowOptions | string = {}
): OwlWindowState => {
  const { defaultTab = "", mirrorSelectionToUrl = true } =
    typeof options === "string" ? { defaultTab: options } : options;
  const { argument, processes } = useProcesses();
  const process = processes[id];

  /**
   * `openProcess` re-targets a singleton by setting `url` and nothing else, so
   * for every application whose selection is an object id, `url` is the
   * freshest selection and the only one worth reading. Storing it in a second
   * field as well would leave a stale value that outranks the deep link.
   */
  const setSelectedId = useCallback(
    (next: string) =>
      argument(id, mirrorSelectionToUrl ? "url" : "owlSelectedId", next),
    [argument, id, mirrorSelectionToUrl]
  );

  const setTab = useCallback(
    (next: string) => argument(id, "owlTab", next),
    [argument, id]
  );

  const setFilter = useCallback(
    (next: string) => argument(id, "owlFilter", next),
    [argument, id]
  );

  const clearDeepLinkError = useCallback(
    () => argument(id, "owlDeepLinkError", ""),
    [argument, id]
  );

  return {
    clearDeepLinkError,
    deepLinkError: process?.owlDeepLinkError,
    filter: process?.owlFilter ?? "",
    selectedId:
      (mirrorSelectionToUrl ? process?.url : process?.owlSelectedId) ?? "",
    setFilter,
    setSelectedId,
    setTab,
    tab: process?.owlTab ?? defaultTab,
  };
};

export default useOwlWindow;
