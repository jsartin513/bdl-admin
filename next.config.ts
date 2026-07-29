import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@bdl/admin-auth', '@bdl/app-config', '@bdl/board-apps'],
};

export default nextConfig;
