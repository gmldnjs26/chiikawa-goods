import { cn } from '@/lib/cn';
import { formatDateTimeJst } from '@/lib/format';
import type { SourceRef } from '@/lib/schema';

/**
 * 출처 표기 (docs/plan.md §6.8). 기존 팬 블로그가 하지 않는 것 — 차별점이다.
 * `sources[]`는 게시 게이트를 지난 소스만 온다. 밝힐 수 없는 경로는 애초에 없다.
 */
export function SourceLinks({
  sources,
  muted = false,
}: {
  sources: readonly SourceRef[];
  muted?: boolean;
}) {
  return (
    <span className={cn('text-xs', muted ? 'text-label-tertiary' : 'text-label-secondary')}>
      出典:{' '}
      {sources.map((source, index) => (
        <span key={source.code}>
          {index > 0 && ' · '}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('underline underline-offset-2', muted && 'text-label-tertiary')}
          >
            {source.name}
          </a>{' '}
          ({formatDateTimeJst(source.observedAt)} 確認)
        </span>
      ))}
    </span>
  );
}
