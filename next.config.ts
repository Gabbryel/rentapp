import type { NextConfig } from "next";
import { execSync } from "child_process";

let buildGitDate: string | undefined;
try {
  buildGitDate = execSync("git log -1 --format=%cI HEAD", { encoding: "utf-8" }).trim();
} catch {}

const nextConfig: NextConfig = {
  env: {
    BUILD_GIT_DATE: buildGitDate,
  },
  turbopack: {
    // Ensure Turbopack uses this workspace as the root, not a higher-level lockfile
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        hostname: "media.istockphoto.com",
      },
      {
        hostname: "unsplash.com",
      }
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    }
  }
};

export default nextConfig;
