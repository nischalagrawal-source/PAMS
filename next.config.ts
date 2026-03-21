import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  async headers() {
    return [
      {
        // Allow CA Website Express server to call internal API endpoints
        source: "/api/internal/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: process.env.CA_WEBSITE_ORIGIN || "http://localhost:3001" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type,X-PAMS-Key" },
        ],
      },
    ];
  },
};

export default nextConfig;
