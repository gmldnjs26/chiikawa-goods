import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cloud Run에 컨테이너로 올린다 (docs/tech-stack.md §1.2)
  output: 'standalone',

  poweredByHeader: false,
};

export default nextConfig;
