import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dl.airtable.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.airtableusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'graph.facebook.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img-eshop.cdn.nintendo.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.nintendo.com',
        pathname: '/eu/media/**',
      },
    ],
    // Disable optimization for local API paths
    unoptimized: false,
  },
};

export default nextConfig;
