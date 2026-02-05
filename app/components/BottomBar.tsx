'use client';

import Link from 'next/link';
import React from 'react';
import { motion } from 'framer-motion';
import { Home, ListChecks, Settings2, Wrench } from 'lucide-react';

export function BottomBar({
  active,
  onOpenAjustes,
  onOpenConfig,
}: {
  active: 'home' | 'pontos' | 'ajustes' | 'config';
  onOpenAjustes?: () => void;
  onOpenConfig?: () => void;
}) {
  const itemStyle = (isActive: boolean) => ({
    borderColor: 'var(--border)',
    background: isActive ? 'var(--accent)' : 'transparent',
    color: isActive ? 'var(--accentText)' : 'var(--muted)',
  });

  const spring = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.6 };

  const mobileItem = (
    key: 'home' | 'pontos' | 'ajustes' | 'config',
    label: string,
    Icon: React.ComponentType<{ className?: string }>
  ) => {
    const isActive = active === key;
    const content = (
      <motion.div
        whileTap={{ scale: 0.96 }}
        className="relative flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[11px]"
        style={{ color: isActive ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.62)' }}
      >
        {isActive && (
          <motion.span
            layoutId="mobile-nav-pill"
            transition={spring}
            className="absolute inset-0 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,.10)',
              border: '1px solid rgba(255,255,255,.18)',
              backdropFilter: 'blur(14px)',
              boxShadow: '0 10px 22px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.12)',
            }}
          />
        )}
        <Icon className="relative z-10 h-5 w-5" />
        <span className="relative z-10 font-medium">{label}</span>
      </motion.div>
    );

    if (key === 'ajustes' && onOpenAjustes) {
      return (
        <button
          key={key}
          type="button"
          onClick={onOpenAjustes}
          className="rounded-2xl focus:outline-none"
          aria-label={label}
        >
          {content}
        </button>
      );
    }

    if (key === 'config' && onOpenConfig) {
      return (
        <button
          key={key}
          type="button"
          onClick={onOpenConfig}
          className="rounded-2xl focus:outline-none"
          aria-label={label}
        >
          {content}
        </button>
      );
    }

    const href = key === 'home' ? '/home' : key === 'pontos' ? '/pontos' : key === 'ajustes' ? '/ajustes' : '/home';
    return (
      <Link
        key={key}
        href={href}
        className="rounded-2xl focus:outline-none"
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
      >
        {content}
      </Link>
    );
  };

  return (
    <>
      {/* Desktop nav */}
      <div className="hidden xl:flex fixed left-4 top-1/2 -translate-y-1/2 z-40">
        <div
          className="rounded-3xl border p-2 backdrop-blur-xl"
          style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,.35)' }}
        >
          <div className="grid grid-rows-4 gap-2">
            <Link
              href="/home"
              className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-sm"
              style={itemStyle(active === 'home')}
              aria-label="Home"
              aria-current={active === 'home' ? 'page' : undefined}
            >
              <Home className="h-5 w-5" />
              <span className="font-medium">Home</span>
            </Link>

            <Link
              href="/pontos"
              className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-sm"
              style={itemStyle(active === 'pontos')}
              aria-label="Pontos"
              aria-current={active === 'pontos' ? 'page' : undefined}
            >
              <ListChecks className="h-5 w-5" />
              <span className="font-medium">Pontos</span>
            </Link>

            <button
              type="button"
              onClick={onOpenAjustes}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-sm"
              style={itemStyle(false)}
              aria-label="Ajustes"
            >
              <Wrench className="h-5 w-5" />
              <span className="font-medium">Ajustes</span>
            </button>

            <button
              type="button"
              onClick={onOpenConfig}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-sm"
              style={itemStyle(false)}
              aria-label="Config"
            >
              <Settings2 className="h-5 w-5" />
              <span className="font-medium">Config</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 xl:hidden"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="mx-auto w-full max-w-md px-3 pb-3">
          <nav
            className="relative overflow-hidden rounded-3xl border px-2 py-2 backdrop-blur-2xl"
            style={{
              borderColor: 'var(--border)',
              background: 'rgba(7,10,18,.62)',
              boxShadow: '0 10px 30px rgba(0,0,0,.35)',
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,0) 55%), radial-gradient(90% 140% at 50% -20%, rgba(255,255,255,.18), rgba(255,255,255,0) 60%)',
                opacity: 0.55,
              }}
            />

            <div className="relative grid grid-cols-4 gap-2">
              {mobileItem('home', 'Home', Home)}
              {mobileItem('pontos', 'Pontos', ListChecks)}
              {mobileItem('ajustes', 'Ajustes', Wrench)}
              {mobileItem('config', 'Config', Settings2)}
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
