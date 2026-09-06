'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/cn';

const TABS = [
  { href: '/', label: 'ホーム' },
  { href: '/calendar', label: 'カレンダー' },
  { href: '/archive', label: '過去・完売' },
] as const;

function isActive(href: string, pathname: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/**
 * 탭 바. 밑줄은 탭마다 있는 게 아니라 **인디케이터 하나**가 활성 탭 자리로 미끄러진다.
 * 위치는 DOM 측정(`offsetLeft` · `offsetWidth`)으로 잡고 인디케이터 요소의 style에 직접 쓴다 — 상태가 없다.
 * 첫 페인트는 전환 없이 제자리. 클릭하면 서버 렌더를 기다리지 않고 즉시 250ms로 미끄러지고, 경로가 바뀌면 다시 맞춘다. 폭 변화(창 크기)는 ResizeObserver가 따라간다.
 * `usePathname` · DOM 측정이 필요해서만 클라이언트다. 잎이다.
 * 섹션 전용 페이지(/now · /soon · /restock)에는 탭 바가 없다 — 그 페이지는 `‹ ホーム`로 돌아간다.
 */
export function NavTabs() {
  const pathname = usePathname();
  const listRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const mountedRef = useRef(false);

  const isTabRoute = TABS.some((tab) => isActive(tab.href, pathname));

  /** 인디케이터를 주어진 탭 자리로. 상태 없이 style에 직접 쓴다 */
  const moveTo = (tab: HTMLElement | null) => {
    const indicator = indicatorRef.current;
    if (tab === null || indicator === null) return;
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
    indicator.style.width = `${tab.offsetWidth}px`;
  };

  useEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (list === null || indicator === null) return;

    const moveToActive = () => moveTo(list.querySelector<HTMLElement>('[aria-current="page"]'));

    // 첫 배치는 전환 없이. 그 다음부터 미끄러진다
    if (!mountedRef.current) {
      indicator.style.transition = 'none';
      moveToActive();
      // 한 프레임 뒤에 전환을 켠다 — 같은 프레임에 켜면 초기 배치도 애니메이션된다
      const frame = requestAnimationFrame(() => {
        indicator.style.transition = '';
        mountedRef.current = true;
      });
      return () => cancelAnimationFrame(frame);
    }

    // 경로가 확정되면 다시 맞춘다 (클릭 시 낙관적으로 먼저 움직였다). 창 폭 변화도 따라간다
    moveToActive();
    const observer = new ResizeObserver(moveToActive);
    observer.observe(list);
    return () => observer.disconnect();
  }, [pathname, isTabRoute]);

  if (!isTabRoute) return null;

  return (
    <nav
      ref={listRef}
      aria-label="画面"
      className="relative mt-3 flex gap-5 border-b border-separator"
    >
      {TABS.map((tab) => {
        const active = isActive(tab.href, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            // 서버 렌더를 기다리지 않고 클릭 즉시 미끄러진다. 경로가 바뀌면 effect가 확정한다
            onClick={(event) => moveTo(event.currentTarget)}
            className={cn(
              'pt-2 pb-2.5 text-sm no-underline transition-colors duration-200',
              active ? 'font-semibold text-label' : 'text-label-secondary hover:text-label',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
      <span
        ref={indicatorRef}
        aria-hidden
        className="absolute bottom-[-1px] left-0 h-0.5 w-0 bg-accent transition-[transform,width] duration-250 ease-out motion-reduce:transition-none"
      />
    </nav>
  );
}
