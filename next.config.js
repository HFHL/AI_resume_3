/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 允许加载 dicebear 头像
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        pathname: '/**',
      },
    ],
  },
  // 实验性功能
  experimental: {
    // 服务器操作
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;

