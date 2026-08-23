import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cloud Run에 컨테이너로 올린다 (docs/tech-stack.md §1.2)
  output: 'standalone',

  // 이미지를 호스팅하지 않는다. 원본 사이트로 링크아웃만 한다 (docs/plan.md §1.4)
  images: { unoptimized: true },

  poweredByHeader: false,
};

export default nextConfig;
