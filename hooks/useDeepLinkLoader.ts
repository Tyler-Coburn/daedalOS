import { useCallback, useEffect, useRef, useState } from "react";
import { useOwlAgentsContext } from "contexts/owlagents";
import { useProcesses } from "contexts/process";
import { useSession } from "contexts/session";
import openDeepLinkTarget from "hooks/openDeepLinkTarget";
import { resolveDeepLink } from "owlagents/deepLinks";
import { PROCESS_DELIMITER } from "utils/constants";

type DeepLinkLoaderOptions = {
  /** 404.html resolves the path client-side; a miss opens Mission Control. */
  reportUnknown?: boolean;
};

/**
 * Turns the address bar into a process intent.
 *
 * A deep link never closes or replaces a window: opening a singleton
 * re-targets the process that is already there, and a non-singleton such as the
 * Artifact Viewer gets its own pid. An unrecognised link opens Mission Control
 * with a visible error rather than 404-ing the desktop.
 *
 * Sources & Files is the one application whose `url` is a filesystem path
 * rather than an object id, because it composes the repository's File Explorer;
 * its selection travels in `owlSelectedId`.
 */
const useDeepLinkLoader = (options: DeepLinkLoaderOptions = {}): void => {
  const { reportUnknown = false } = options;
  const { argument, open, processes } = useProcesses();
  const { sessionLoaded } = useSession();
  const { getSnapshot } = useOwlAgentsContext();
  const loadedRef = useRef(false);
  const [unknownLink, setUnknownLink] = useState("");

  const resolve = useCallback(
    (pathname: string): void => {
      const target = resolveDeepLink(pathname);

      if (!target) {
        if (reportUnknown && pathname !== "/") {
          setUnknownLink(pathname);
          open("MissionControl", { owlDeepLinkError: pathname });
        }

        return;
      }

      openDeepLinkTarget(target, open, getSnapshot);
    },
    [getSnapshot, open, reportUnknown]
  );

  useEffect(() => {
    if (!sessionLoaded || loadedRef.current) return;

    loadedRef.current = true;
    resolve(window.location.pathname);
  }, [resolve, sessionLoaded]);

  // Back and forward re-resolve without remounting the page.
  useEffect(() => {
    const onPopState = (): void => resolve(window.location.pathname);

    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, [resolve]);

  /**
   * Re-opening an already-open singleton carries `url` and nothing else, so the
   * error has to be set on the process once its pid exists.
   */
  useEffect(() => {
    if (!unknownLink) return;

    const pid = Object.keys(processes).find(
      (candidate) =>
        candidate === "MissionControl" ||
        candidate.startsWith(`MissionControl${PROCESS_DELIMITER}`)
    );

    if (!pid || processes[pid]?.owlDeepLinkError === unknownLink) return;

    argument(pid, "owlDeepLinkError", unknownLink);
  }, [argument, processes, unknownLink]);
};

export default useDeepLinkLoader;
