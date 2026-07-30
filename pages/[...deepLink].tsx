import { type GetStaticPathsResult, type GetStaticPropsResult } from "next";
import { memo } from "react";
import Shell from "components/pages/Shell";
import { listDemoDeepLinkPaths } from "owlagents/adapters/demo/fixtures";

/**
 * `output: "export"` cannot pre-render an unbounded id space, so every known
 * object gets a static page and `pages/404.tsx` catches the rest with the same
 * desktop and the same resolver.
 *
 * This list is enumerable at all because nothing under `owlagents/` imports
 * React — the fixtures load here in Node at build time.
 */
export const getStaticPaths = (): GetStaticPathsResult => ({
  fallback: false,
  paths: listDemoDeepLinkPaths().map((pathname) => ({
    params: { deepLink: pathname.split("/").filter(Boolean) },
  })),
});

export const getStaticProps = (): GetStaticPropsResult<
  Record<string, never>
> => ({ props: {} });

const DeepLink = (): React.ReactElement => <Shell />;

export default memo(DeepLink);
