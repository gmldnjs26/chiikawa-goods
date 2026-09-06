import './globals.css';

import type { Metadata } from 'next';

import { NavTabs } from '@/modules/_common/components/NavTabs';
import { ThemeToggle } from '@/modules/_common/components/ThemeToggle';
import { ISSUES_URL, SITE_NAME, THEME_STORAGE_KEY } from '@/modules/_common/consts';

import { QueryProvider } from './providers/query-provider';

export const metadata: Metadata = {
  // 서비스명·도메인은 v0 착수 조건 (docs/plan.md §8.1). 확정 전까지 가제
  title: SITE_NAME,
  description: 'ちいかわグッズの発売・予約・再入荷情報をまとめて確認する。',
};

/**
 * 첫 페인트 전에 저장된 테마를 `<html data-theme>`에 찍는다 — 다크로 저장해 둔 사람이 라이트 깜빡임을 보지 않게.
 * 값이 없으면 스탬프도 없다 = OS를 따른다. 키는 ThemeToggle과 같다.
 */
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ja" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <QueryProvider>
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-6">
            <header className="pt-5">
              <div className="flex items-center justify-between gap-2">
                <h1 className="text-xl font-semibold">{SITE_NAME}</h1>
                <ThemeToggle />
              </div>
              <NavTabs />
            </header>
            <main className="flex-1 pt-4">{children}</main>
            <footer className="pt-8 text-xs leading-[1.55] text-label-secondary [text-wrap:pretty]">
              <p>
                掲載情報は各公式サイトの公開情報をもとにした集計です。商品名・価格・日付・リンクのみを扱い、説明文は転載しません。
              </p>
              <p>
                各項目に出典を明記しています。誤り・削除のご依頼は{' '}
                <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
                  GitHub Issues
                </a>{' '}
                まで。
              </p>
            </footer>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
