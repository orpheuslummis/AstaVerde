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
    domains: ['gateway.pinata.cloud'],
  },
};

module.exports = nextConfig;