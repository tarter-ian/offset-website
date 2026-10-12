import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The database's web client loads this lazily, so tracing misses it; the Cloudflare build needs it copied.
  outputFileTracingIncludes: { "/api/**": ["./node_modules/@libsql/isomorphic-ws/**"] },
  // The AI and lifetime pages became items on the home page.
  async redirects() {
    return [
      { source: "/ai", destination: "/#ai-chat", permanent: false },
      { source: "/lifetime", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
