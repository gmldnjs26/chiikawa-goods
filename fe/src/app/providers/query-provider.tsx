'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * 서버 상태는 TanStack Query만 쓴다. 클라이언트 전역 상태 스토어는 두지 않는다
 * (docs/tech-stack.md §1.2 — zustand 제외).
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 30분 폴링 주기를 감안한 값. 화면이 수집보다 자주 갱신될 이유가 없다
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
