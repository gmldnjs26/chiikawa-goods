'use client';

/** 읽기 API가 안 닿을 때. Next 규약상 error boundary는 클라이언트여야 한다 */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2.5 pt-12" role="alert">
      <p className="text-sm text-label-secondary">データを取得できませんでした</p>
      <button
        type="button"
        onClick={reset}
        className="flex min-h-11 items-center rounded-lg border border-label bg-surface px-5 text-sm font-semibold text-label"
      >
        もう一度試す
      </button>
    </div>
  );
}
