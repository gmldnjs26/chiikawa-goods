import './globals.css';

import type { Metadata } from 'next';

import { QueryProvider } from './providers/query-provider';

export const metadata: Metadata = {
  // 서비스명·도메인은 v0 착수 조건 (docs/plan.md §8.1). 확정 전까지 가제
  title: 'ちいかわグッズ タイムライン',
  description: 'ちいかわグッズの発売・予約・再入荷情報をまとめて確認する。',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
