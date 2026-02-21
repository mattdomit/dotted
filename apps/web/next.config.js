/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@dotted/shared"],
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

module.exports = nextConfig;
