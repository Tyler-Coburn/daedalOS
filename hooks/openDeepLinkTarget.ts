import { type ProcessArguments } from "contexts/process/types";
import { type DeepLinkTarget } from "owlagents/deepLinks";
import { type OwlAgentsSnapshot } from "owlagents/domain/snapshot";

type OpenProcess = (
  id: string,
  processArguments?: ProcessArguments,
  icon?: string
) => void;

/**
 * The single place that decides how a resolved deep link becomes an open
 * window.
 *
 * This existed twice — once for links arriving from the address bar and once
 * for links clicked inside an application — and the two disagreed. Sources &
 * Files is the one application whose `url` is a filesystem path rather than an
 * object id, because it composes the real `FileManager`. The loader knew that;
 * the in-app navigator did not, so clicking a source link wrote a domain id
 * into the file pane's path and the pane broke.
 *
 * Anything that opens a deep link goes through here, so that rule cannot be
 * half-applied again.
 */
const openDeepLinkTarget = (
  target: DeepLinkTarget,
  open: OpenProcess,
  getSnapshot: () => OwlAgentsSnapshot
): void => {
  if (target.appId === "SourcesFiles") {
    const source = getSnapshot().sources[target.objectId];

    open("SourcesFiles", {
      owlSelectedId: target.objectId,
      // The folder holding the file, or undefined to leave the pane where it
      // is. Never the object id: that is not a path.
      url: source?.path.split("/").slice(0, -1).join("/") || undefined,
    });

    return;
  }

  open(target.appId, {
    owlSelectedId: target.objectId,
    // `url` is the only field `openProcess` re-targets on a singleton re-open,
    // which is why it carries the object id everywhere else.
    url: target.objectId,
  });
};

export default openDeepLinkTarget;
