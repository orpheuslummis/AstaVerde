const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
      },
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL
          ? new URL(process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL).hostname
          : 'n/a', // Required, but won't match if env var is not set
      },
      {
        protocol: 'https',
        hostname: '*.ipfs.w3s.link', // Added for web3.storage gateway
      },
      {
        protocol: 'https',
        hostname: 'dweb.link', // Added for dweb.link fallback
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