/** @type {import('next').NextConfig} */
const backendInternalUrl = process.env.BACKEND_INTERNAL_URL || 'http://shinhandb_backend:3001';
const backendUrlObj = new URL(backendInternalUrl);
const backendHost = backendUrlObj.hostname;
const backendPort = backendUrlObj.port || '3001';

const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendInternalUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendInternalUrl}/uploads/:path*`,
      },
      {
        source: '/mo',
        destination: '/mo/index.html',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: backendPort,
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: backendHost,
        port: backendPort,
        pathname: '/uploads/**',
      },
    ],
  },
};
export default nextConfig;
