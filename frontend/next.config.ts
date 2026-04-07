import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. 보안 에러 해결: 개발 환경에서 127.0.0.1 접속 허용
  allowedDevOrigins: ['127.0.0.1', 'localhost'],

  // 2. 기존 API 프록시 설정
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/:path*',
      },
    ];
  },
};

export default nextConfig;