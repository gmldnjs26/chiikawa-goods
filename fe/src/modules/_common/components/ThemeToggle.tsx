'use client';

import { Moon, Sun } from 'lucide-react';
import { type MouseEvent, useSyncExternalStore } from 'react';

import { cn } from '@/lib/cn';

import { THEME_STORAGE_KEY } from '../consts';

type Theme = 'light' | 'dark';

const CHANGE_EVENT = 'theme-change';

/** 실제로 보이는 테마. 저장값이 있으면 그것, 없으면 OS */
function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // 읽지 못하면 OS를 따른다
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  media.addEventListener('change', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
    media.removeEventListener('change', onChange);
  };
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 저장 못 해도 이번 화면에는 적용된다
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * 테마 전환 — 클릭 지점에서 원이 퍼지며 새 테마가 드러난다 (View Transitions API).
 * `startViewTransition`이 없거나 모션을 줄여 달라면 즉시 바꾼다.
 * `::view-transition-*(root)`의 기본 크로스페이드는 `globals.css`에서 꺼 두었다 — 여기의 clip-path만 움직인다.
 */
function switchTheme(event: MouseEvent<HTMLButtonElement>, next: Theme) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof document.startViewTransition !== 'function' || reduce) {
    applyTheme(next);
    return;
  }

  const x = event.clientX;
  const y = event.clientY;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  const transition = document.startViewTransition(() => applyTheme(next));
  void transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 500, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
    );
  });
}

/**
 * 라이트 ↔ 다크 버튼. 지금 보이는 테마의 아이콘을 낸다 — 라이트면 Sun, 다크면 Moon.
 * `localStorage` · `matchMedia` · `document`를 만지므로 클라이언트다. 잎이다.
 * 서버 스냅샷은 `light`(hydration 불일치 회피). 첫 페인트 전 적용은 `layout.tsx`의 인라인 스크립트가 한다.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light' as Theme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={(event) => switchTheme(event, next)}
      aria-label={next === 'dark' ? 'ダークテーマに切り替え' : 'ライトテーマに切り替え'}
      className={cn(
        'relative inline-flex size-9 items-center justify-center overflow-hidden rounded-md border border-border bg-surface text-label transition-colors hover:bg-fill',
        className,
      )}
    >
      <Icon aria-hidden className="size-[1.2rem]" strokeWidth={2} />
    </button>
  );
}
