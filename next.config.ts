import type { NextConfig } from "next";
const assetHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;
const config: NextConfig = {
  images: {
    remotePatterns: assetHost
      ? [
          {
            protocol: assetHost.protocol === "https:" ? "https" : "http",
            hostname: assetHost.hostname,
            port: assetHost.port,
            pathname: "/storage/v1/object/public/marketplace-assets/**",
          },
        ]
      : [],
  },
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), camera=(), microphone=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://tile.openstreetmap.org${assetHost ? " " + assetHost.origin : ""}; connect-src 'self' https://tile.openstreetmap.org${process.env.NODE_ENV === "development" ? " ws://127.0.0.1:3000 ws://localhost:3000" : ""}; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
          },
        ],
      },
    ];
  },
};
export default config;
