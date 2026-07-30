import { memo } from "react";
import AppsLoader from "components/system/Apps/AppsLoader";
import Desktop from "components/system/Desktop";
import Taskbar from "components/system/Taskbar";
import useDeepLinkLoader from "hooks/useDeepLinkLoader";
import useGlobalErrorHandler from "hooks/useGlobalErrorHandler";
import useGlobalKeyboardShortcuts from "hooks/useGlobalKeyboardShortcuts";
import useIFrameFocuser from "hooks/useIFrameFocuser";
import useUrlLoader from "hooks/useUrlLoader";

type ShellProps = {
  /**
   * Only 404.html reports an unrecognised link. The index page and the
   * pre-rendered deep-link pages resolve what they can and stay quiet, because
   * "/" is not an error.
   */
  reportUnknownLink?: boolean;
};

/**
 * The desktop, shared by the index page, the deep-link catch-all and 404.
 *
 * A component boundary emits no host element, so `body>#__next>main` and every
 * selector beneath it are byte-identical to before this refactor — the existing
 * e2e suite passing unmodified is the proof.
 *
 * The deep-link loader lives here rather than in the pages so that Back and
 * Forward re-resolve from wherever the operator started, including "/".
 */
const Shell: FC<ShellProps> = ({ reportUnknownLink = false }) => {
  useIFrameFocuser();
  useUrlLoader();
  useDeepLinkLoader({ reportUnknown: reportUnknownLink });
  useGlobalKeyboardShortcuts();
  useGlobalErrorHandler();

  return (
    <Desktop>
      <Taskbar />
      <AppsLoader />
    </Desktop>
  );
};

export default memo(Shell);
