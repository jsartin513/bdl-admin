import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@bdl/board-apps', '@bdl/admin-auth'],
};

export default nextConfig;
