'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export default function ResetarSenhaPage() {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
    setStatus(null);
  }, []);

  const validate = () => {
    if (!password) return 'Informe a nova senha.';
    if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
    if (!/\d/.test(password)) return 'A senha deve conter pelo menos 1 número.';
    if (confirm !== password) return 'As senhas não conferem.';
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!supabase) {
      setError('Supabase não configurado.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message ?? 'Erro ao atualizar senha.');
      return;
    }

    setStatus('Senha atualizada com sucesso. Você já pode entrar.');
    setTimeout(() => router.replace('/login'), 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-md rounded-3xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
          Segurança
        </div>
        <div className="mt-1 text-2xl font-semibold">Resetar senha</div>
        <p className="mt-2 text-xs" style={{ color: 'var(--muted2)' }}>
          Defina uma nova senha para sua conta.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <input
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nova senha"
            className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
          />
          <input
            type="password"
            minLength={8}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirmar senha"
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
            {loading ? 'Salvando...' : 'Salvar nova senha'}
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
