'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

export default function SegurancaPage() {
  const supabase = getSupabaseBrowser();
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

    if (!supabase || !user) {
      setError('Sessão inválida. Faça login novamente.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message ?? 'Erro ao atualizar senha.');
      return;
    }

    setStatus('Senha alterada com sucesso.');
    setPassword('');
    setConfirm('');
  };

  return (
    <div className="min-h-screen px-4 pb-24 xl:pb-10 xl:pl-24" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="mx-auto w-full max-w-lg pt-6">
        <div className="rounded-3xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
            Segurança
          </div>
          <div className="mt-1 text-2xl font-semibold">Alterar senha</div>
          <p className="mt-2 text-xs" style={{ color: 'var(--muted2)' }}>
            Atualize sua senha de acesso.
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
        </div>
      </div>
    </div>
  );
}
