import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Prevent Turbopack from inferring the workspace root from other lockfiles on disk.
    root: __dirname,
  },
};

export default nextConfig;
