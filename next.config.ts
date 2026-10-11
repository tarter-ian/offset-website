import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The AI and lifetime pages became items on the home page.
  async redirects() {
    return [
      { source: "/ai", destination: "/#ai-chat", permanent: false },
      { source: "/lifetime", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
