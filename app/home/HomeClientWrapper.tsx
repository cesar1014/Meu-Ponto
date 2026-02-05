'use client';

import dynamic from 'next/dynamic';

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="text-center">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2"
          style={{ borderColor: 'var(--muted)', borderTopColor: 'transparent' }}
        />
        <span className="text-sm opacity-60">Carregando...</span>
      </div>
    </div>
  );
}

const HomeClient = dynamic(() => import('./HomeClient'), {
  ssr: false,
  loading: () => <LoadingFallback />,
});

export default function HomeClientWrapper() {
  return <HomeClient />;
}
