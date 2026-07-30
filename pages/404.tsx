import { memo } from "react";
import Shell from "components/pages/Shell";

/**
 * The desktop, not an error page.
 *
 * Static export emits this as `404.html`, which the host serves for any path it
 * has no file for. It renders exactly the same tree as the index page and
 * resolves the path client-side, so a link to an object that was not
 * pre-rendered still opens the right application — and an unrecognised link
 * opens Mission Control with "link not recognised" instead of replacing the
 * desktop with a 404.
 */
const NotFound = (): React.ReactElement => <Shell reportUnknownLink />;

export default memo(NotFound);
