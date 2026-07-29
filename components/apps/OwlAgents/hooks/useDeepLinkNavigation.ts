import { useCallback } from "react";
import { useProcesses } from "contexts/process";
import {
  buildDeepLink,
  resolveDeepLink,
  type DeepLinkObjectType,
} from "owlagents/deepLinks";

/**
 * In-app navigation that keeps every window open.
 *
 * `history.pushState` is the raw browser API on purpose: `next/router` would
 * remount the page component and destroy all process state. For the same
 * reason `ObjectLink` renders a button, never an anchor — an anchor click is a
 * full navigation.
 *
 * Opening a singleton re-targets the process that is already there, so a link
 * from Mission Control to a work order focuses Work Orders and selects the
 * object; it never closes or replaces anything.
 */
const useDeepLinkNavigation = (): {
  navigateTo: (objectType: DeepLinkObjectType, objectId: string) => void;
} => {
  const { open } = useProcesses();

  const navigateTo = useCallback(
    (objectType: DeepLinkObjectType, objectId: string) => {
      const pathname = buildDeepLink(objectType, objectId);
      const target = resolveDeepLink(pathname);

      if (!target) return;

      window.history.pushState({}, "", pathname);
      open(target.appId, {
        owlSelectedId: target.objectId,
        url: target.objectId,
      });
    },
    [open]
  );

  return { navigateTo };
};

export default useDeepLinkNavigation;
