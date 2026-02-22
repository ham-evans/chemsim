import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only client-side app — no SSR API routes or server actions needed
  output: "standalone",

  // Three.js imports large WASM/worker files; raise the limit
  serverExternalPackages: ["three"],
};

export default nextConfig;
