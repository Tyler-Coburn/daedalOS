import { memo } from "react";
import AppsLoader from "components/system/Apps/AppsLoader";
import Desktop from "components/system/Desktop";
import Taskbar from "components/system/Taskbar";
import useGlobalErrorHandler from "hooks/useGlobalErrorHandler";
import useGlobalKeyboardShortcuts from "hooks/useGlobalKeyboardShortcuts";
import useIFrameFocuser from "hooks/useIFrameFocuser";
import useUrlLoader from "hooks/useUrlLoader";

/**
 * The desktop, extracted so the index page, the deep-link catch-all and the
 * 404 page all render exactly the same tree.
 *
 * A component boundary emits no host element, so `body>#__next>main` and every
 * selector beneath it are byte-identical to before this refactor. The existing
 * e2e suite passing unmodified is the proof.
 */
const Shell = (): React.ReactElement => {
  useIFrameFocuser();
  useUrlLoader();
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
