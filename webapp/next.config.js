import path from 'node:path';

/** @type {import('next').NextConfig} */
module.exports = {
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