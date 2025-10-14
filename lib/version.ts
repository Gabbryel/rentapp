import { cache } from "react";
import pkg from "../package.json" assert { type: "json" };

export type AppVersion = {
  version: string; // semantic version from package.json
  commit?: string; // short git sha from env if available
  build?: string; // vercel build id or similar ci build id
  env?: string; // deployment environment label
};

function readEnvVersion(): Pick<AppVersion, "commit" | "build" | "env"> {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.GITHUB_SHA?.slice(0, 7) ||
    process.env.COMMIT_SHA?.slice(0, 7);
  const build = process.env.VERCEL_BUILD_ID || process.env.BUILD_ID;
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
  return { commit, build, env };
}

export const getAppVersion = cache(async (): Promise<AppVersion> => {
  const base: AppVersion = { version: pkg.version };
  const extra = readEnvVersion();
  return { ...base, ...extra };
});
