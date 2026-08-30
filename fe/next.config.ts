import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cloud Run에 컨테이너로 올린다 (docs/tech-stack.md §1.2)
  output: 'standalone',

  // 가드다. next/image를 쓰지 않지만(fe/CLAUDE.md §6), 이게 없으면 누군가 쓰는 순간
  // 원본 이미지를 /_next/image로 받아 우리 서버가 디스크 캐시로 재서빙한다 —
  // docs/plan.md §2.1이 복제권·공중송신권을 이유로 버린 안 B 그 자체다.
  // remotePatterns를 추가하지 않는다.
  images: { unoptimized: true },

  poweredByHeader: false,
};

export default nextConfig;
