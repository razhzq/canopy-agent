import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // packages/shared ships TypeScript source; Next compiles it with the page.
  transpilePackages: ["@canopy-agent/shared"],
};

export default nextConfig;
