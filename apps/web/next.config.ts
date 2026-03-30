import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // standalone is used for Docker deployments; Vercel builds its own output
  output: isProd && !process.env.VERCEL ? "standalone" : undefined,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
  // ioredis uses Node.js TCP sockets — keep it server-side, never bundle for browser/edge
  serverExternalPackages: ["ioredis"],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost",
        "localhost:3000",
        "localhost:80",
        // Allow any *.vercel.app subdomain and custom domains
        ...(process.env.NEXT_PUBLIC_APP_URL
          ? [new URL(process.env.NEXT_PUBLIC_APP_URL).host]
          : []),
      ],
    },
  },
};

export default nextConfig;
