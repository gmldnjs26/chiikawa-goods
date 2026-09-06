import Link from 'next/link';

/** 404. 제목 · 1줄 설명 · ホームへ. 일러스트 없음 */
export default function NotFound() {
  return (
    <div className="flex flex-col gap-2 pt-12">
      <h2 className="text-xl font-semibold">ページが見つかりません</h2>
      <p className="text-sm leading-relaxed text-label-secondary">
        商品が削除されたか、URLが変わった可能性があります。
      </p>
      <Link
        href="/"
        className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold no-underline"
      >
        ホームへ <span aria-hidden>›</span>
      </Link>
    </div>
  );
}
