import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Do not fail the production build on ESLint errors
    ignoreDuringBuilds: true,
  },
  /* config options here */
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
  }
};

export default nextConfig;
