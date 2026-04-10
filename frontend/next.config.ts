import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,

  compiler: {
    removeConsole: !isDev ? { exclude: ['error', 'warn'] } : false,
  },

  typescript: {
    ignoreBuildErrors: isDev,
  },

  eslint: {
    ignoreDuringBuilds: isDev,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
