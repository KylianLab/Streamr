import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["bcryptjs"],
  async rewrites() {
    return [
      // Xtream Codes compatibility: players expect these at the root
      { source: "/player_api.php", destination: "/api/xtream/player_api.php" },
      { source: "/get.php", destination: "/api/xtream/get.php" },
      { source: "/live/:username/:password/:streamId", destination: "/api/xtream/live/:username/:password/:streamId" },
      { source: "/movie/:username/:password/:streamId", destination: "/api/xtream/movie/:username/:password/:streamId" },
      { source: "/series/:username/:password/:streamId", destination: "/api/xtream/series/:username/:password/:streamId" },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
