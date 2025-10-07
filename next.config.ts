import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Do not fail the production build on ESLint errors
    ignoreDuringBuilds: true,
  },
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
  // Allow larger multipart/form-data payloads for Server Actions (default is 1MB)
  serverActions: {
    // Align with max single file (10MB) + overhead; adjust if requirements change
    bodySizeLimit: '12mb',
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
