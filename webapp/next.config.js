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
    domains: [
      'gateway.pinata.cloud', // Keep the old one as a fallback or for existing images
      // Dynamically add the hostname from the environment variable
      ...(process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL
        ? [new URL(process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL).hostname]
        : []),
    ],
  },
};

module.exports = nextConfig;