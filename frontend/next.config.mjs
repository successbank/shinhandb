/** @type {import('next').NextConfig} */
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
        destination: 'http://shinhandb_backend:3001/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://shinhandb_backend:3001/uploads/:path*',
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
        port: '5648',
        pathname: '/uploads/**',
      },
      {
        protocol: 'http',
        hostname: 'shinhandb_backend',
        port: '3001',
        pathname: '/uploads/**',
      },
    ],
  },
};
export default nextConfig;
