'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export default function EsqueciSenhaPage() {
  const supabase = getSupabaseBrowser();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Informe seu email.');
      return;
    }

    if (!supabase) {
      setError('Supabase não configurado.');
      return;
    }

    setLoading(true);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const redirectTo = `${siteUrl}/auth/resetar-senha`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
    setLoading(false);

    if (resetError) {
      setStatus('Se existir uma conta, enviamos um email com instruções.');
      return;
    }

    setStatus('Se existir uma conta, enviamos um email com instruções.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-md rounded-3xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
          Recuperação
        </div>
        <div className="mt-1 text-2xl font-semibold">Esqueci minha senha</div>
        <p className="mt-2 text-xs" style={{ color: 'var(--muted2)' }}>
          Informe seu email para receber o link de redefinição.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
          />

          {error ? (
            <div className="text-xs rounded-2xl border px-3 py-2" style={{ borderColor: 'rgba(251,113,133,.35)', color: 'var(--neg)' }}>
              {error}
            </div>
          ) : null}

          {status ? (
            <div className="text-xs rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)', color: 'var(--muted2)' }}>
              {status}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl px-3 py-3 text-sm font-semibold disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--accentText)' }}
          >
            {loading ? 'Enviando...' : 'Enviar link'}
          </button>
        </form>

        <div className="mt-4 text-xs" style={{ color: 'var(--muted2)' }}>
          Voltar para{' '}
          <Link href="/login" className="underline">
            login
          </Link>
        </div>
      </div>
    </div>
  );
}
