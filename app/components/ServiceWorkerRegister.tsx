'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // ✅ Em desenvolvimento: remove qualquer SW antigo para não cachear o Next
    if (process.env.NODE_ENV !== 'production') {
      (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));

          // Limpa caches do SW (se existirem)
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
        } catch {
          // ignore
        }
      })();

      return;
    }

    // ✅ Só registra em produção
    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch (err) {
        console.warn('Falha ao registrar o service worker', err);
      }
    };

    void register();
  }, []);

  return null;
}
