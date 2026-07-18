import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vinext applies this request-body ceiling before App Router handlers.
  // The registry route enforces its own stricter 32 MiB ZIP limit.
  experimental: {
    serverActions: {
      bodySizeLimit: "33mb",
    },
  },
};

export default nextConfig;
