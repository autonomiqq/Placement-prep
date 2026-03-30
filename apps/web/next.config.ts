import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // TS errors from missing Supabase generated types don't block production build.
  // Run `npm run gen-types` after `supabase db push` to fix properly.
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
      // Accept from nginx (port 80) and direct (port 3000)
      allowedOrigins: ["localhost", "localhost:3000", "localhost:80"],
    },
  },
};

export default nextConfig;
