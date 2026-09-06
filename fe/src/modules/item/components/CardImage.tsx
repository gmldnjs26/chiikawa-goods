'use client';

import { useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * 이미지 슬롯 96×96 (디자인 플랜 v1.2). 원본 CDN을 그대로 가리킨다 — `next/image`를 쓰지 않는다 (fe/CLAUDE.md §6).
 * 없거나 실패(404 · referer 차단)하면 브랜드 이니셜 1자를 둔 빈칸이다 — 깨진 게 아니라 라벨이 있는 빈칸.
 * 브라우저의 깨진 아이콘을 지우려면 `onError`가 필요해서 이것만 클라이언트다. 잎이다.
 */
export function CardImage({
  src,
  initial,
  muted = false,
}: {
  src: string | null;
  initial: string;
  muted?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = src !== null && !failed;
  return (
    <div
      className={cn(
        'flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-background text-2xl',
        muted ? 'text-border' : 'text-label-quaternary',
      )}
      aria-hidden
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- next/image를 쓰지 않는다
        <img
          src={src}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initial
      )}
    </div>
  );
}
