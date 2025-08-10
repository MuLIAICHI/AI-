/** @type {import('next').NextConfig} */
const nextConfig: import('next').NextConfig = {
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    // Fix for WebSocket in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        ws: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
