import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',

  // Disable source maps in production to reduce build size
  productionBrowserSourceMaps: false,

  // Optimize build output
  compress: true,

  // Exclude data folder from standalone builds (1.7GB savings!)
  outputFileTracingExcludes: {
    '*': [
      'data/images/**/*',
      'data/video-game-images/**/*',
      'data/staff-ids/**/*',
      'data/*.json',
      'data/**/*.json',
      '.next/**',
      'node_modules/.cache/**',
      'node_modules/**/test/**',
      'node_modules/**/tests/**',
      'node_modules/**/*.md',
      'node_modules/**/LICENSE*',
      'node_modules/**/license*',
      'node_modules/**/*.map',
      'node_modules/**/*.ts',
      'node_modules/**/*.tsx',
      'node_modules/**/*.d.ts',
    ],
  },

  // Experimental optimizations for faster builds
  experimental: {
    // Note: instrumentation.ts runs automatically in Next.js 15.5+ (no config needed)
    // Optimize package imports for tree-shaking
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-slider',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
  },

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
    // Image optimization settings
    unoptimized: false,
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // TypeScript and ESLint optimizations
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
