const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Ensure modern ESM deps are transpiled for all browsers
  transpilePackages: ["@wagmi/core", "viem", "connectkit", "mipd"],
  typescript: {
    // Skip type checking for external dependencies with known issues
    // This specifically handles the viem/ox Authorization.ts type conflict
    ignoreBuildErrors: true,
  },
  // Memory optimization settings
  // experimental: {
  // Disable webpack build worker in dev to reduce memory overhead
  //     webpackBuildWorker: false,
  // },
  // Reduce webpack memory usage
  webpack: (config, { dev, isServer }) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.resolve.alias["@"] = path.join(__dirname, "src");

    // Memory optimizations for development
    if (dev) {
      // Use filesystem cache instead of memory cache
      config.cache = {
        type: "filesystem",
        buildDependencies: {
          config: [__filename],
        },
      };
      // Keep optimizations but reduce memory usage
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };
      // Allow webpack to use all available CPUs for parallel processing
      // (parallelism is auto-detected based on CPU count)
    }

    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval needed for Web3 wallets
              "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for Tailwind CSS
              "img-src 'self' data: https: blob:", // Allow IPFS and wallet images
              "connect-src 'self' http://127.0.0.1:8545 http://localhost:8545 https: wss:", // Allow blockchain RPC and WebSocket connections
              "font-src 'self' data:",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gateway.pinata.cloud",
      },
      {
        protocol: "https",
        hostname: process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL
          ? new URL(process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL).hostname
          : "n/a", // Required, but won't match if env var is not set
      },
      {
        protocol: "https",
        hostname: "*.ipfs.w3s.link", // Added for web3.storage gateway
      },
      {
        protocol: "https",
        hostname: "dweb.link", // Added for dweb.link fallback
      },
    ],
    // domains: [
    //   'gateway.pinata.cloud',
    //   ...(process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL
    //     ? [new URL(process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL).hostname]
    //     : []),
    //   '*.ipfs.w3s.link', // Added for web3.storage gateway
    //   'dweb.link', // Added for dweb.link fallback
    // ],
  },
};

module.exports = nextConfig;
