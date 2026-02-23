import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Three.js imports large WASM/worker files; raise the limit
  serverExternalPackages: ["three"],
};

export default nextConfig;
