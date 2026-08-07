import type { NextConfig } from "next";

const scriptSources =
  process.env.NODE_ENV === "production"
    ? "'self' 'unsafe-inline'"
    : "'self' 'unsafe-inline' 'unsafe-eval'";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: https://lh3.googleusercontent.com; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src ${scriptSources}; worker-src 'self' blob:; connect-src 'self'; media-src 'self' blob:; form-action 'self' https://accounts.google.com`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
