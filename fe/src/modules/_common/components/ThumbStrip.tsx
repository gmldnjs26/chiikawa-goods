'use client';

import { useState } from 'react';

import { cn } from '@/lib/cn';

/**
 * 접힌 발표의 대표 이미지 스트립 — 44px, 최대 4장 + 「+N」 점선 칸 (디자인 플랜 7a).
 * 원본 CDN을 그대로 가리킨다. 실패한 이미지는 칸째 지운다 — 깨진 아이콘을 남기지 않는다.
 * `onError`가 필요해서 클라이언트다. 잎이다.
 */
export function ThumbStrip({
  images,
  total,
  className,
}: {
  images: readonly string[];
  /** 발표의 총 건수. `images`보다 많으면 「+N」 */
  total: number;
  className?: string;
}) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const shown = images.filter((src) => !failed.has(src));
  const more = total - shown.length;
  if (shown.length === 0) return null;

  return (
    <div className={cn('flex gap-1.5', className)} aria-hidden>
      {shown.map((src) => (
        <div
          key={src}
          className="size-11 shrink-0 overflow-hidden rounded-lg border border-separator bg-background"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image를 쓰지 않는다 */}
          <img
            src={src}
            alt=""
            loading="lazy"
            className="size-full object-cover"
            onError={() => setFailed((prev) => new Set(prev).add(src))}
          />
        </div>
      ))}
      {more > 0 && (
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-dashed border-label-tertiary text-xs font-semibold text-label-secondary tabular-nums">
          +{more}
        </div>
      )}
    </div>
  );
}
