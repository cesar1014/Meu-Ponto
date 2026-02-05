'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

type Errors = { nome?: string; id_login?: string; form?: string };

export default function CompletarPerfilPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [idLogin, setIdLogin] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (profile) {
      router.replace('/home');
    }
  }, [profile, router]);

  useEffect(() => {
    if (!nome && typeof user?.user_metadata?.full_name === 'string') {
      setNome(user.user_metadata.full_name as string);
    }
    if (!nome && typeof user?.user_metadata?.nome === 'string') {
      setNome(user.user_metadata.nome as string);
    }
    if (!idLogin && typeof user?.user_metadata?.id_login === 'string') {
      setIdLogin(user.user_metadata.id_login as string);
    }
  }, [user, nome, idLogin]);

  const validate = () => {
    const nextErrors: Errors = {};
    const cleanNome = nome.trim();
    const cleanId = idLogin.trim();

    if (!cleanNome) nextErrors.nome = 'Informe seu nome.';
    else if (cleanNome.length < 2) nextErrors.nome = 'O nome deve ter pelo menos 2 caracteres.';

    if (!cleanId) nextErrors.id_login = 'Informe seu ID.';
    else if (!/^\d+$/.test(cleanId)) nextErrors.id_login = 'O ID deve conter apenas números.';
    else if (cleanId.length < 3 || cleanId.length > 12) nextErrors.id_login = 'O ID deve ter entre 3 e 12 dígitos.';

    return nextErrors;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (!supabase) {
      setErrors({ form: 'Sessão inválida. Faça login novamente.' });
      return;
    }

    let userId = user?.id ?? null;
    if (!userId) {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    }

    if (!userId) {
      setErrors({ form: 'Sessão inválida. Faça login novamente.' });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('profiles').insert({
      user_id: userId,
      nome: nome.trim(),
      id_login: idLogin.trim(),
    });

    setLoading(false);

    if (error) {
      if (error.code === '23505') {
        setErrors({ id_login: 'Este ID já está em uso.' });
      } else {
        setErrors({ form: error.message ?? 'Erro ao salvar perfil.' });
      }
      return;
    }

    await refreshProfile();
    router.replace('/home');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-md rounded-3xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
          Perfil
        </div>
        <div className="mt-1 text-2xl font-semibold">Complete seu cadastro</div>
        <p className="mt-2 text-xs" style={{ color: 'var(--muted2)' }}>
          Precisamos do seu nome e um ID numérico para continuar.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <input
              type="text"
              minLength={2}
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome"
              className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
            />
            {errors.nome ? <div className="mt-1 text-xs" style={{ color: 'var(--neg)' }}>{errors.nome}</div> : null}
          </div>

          <div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={idLogin}
              onChange={(e) => setIdLogin(e.target.value)}
              placeholder="ID (somente números)"
              className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
            />
            {errors.id_login ? <div className="mt-1 text-xs" style={{ color: 'var(--neg)' }}>{errors.id_login}</div> : null}
          </div>

          {errors.form ? (
            <div className="text-xs rounded-2xl border px-3 py-2" style={{ borderColor: 'rgba(251,113,133,.35)', color: 'var(--neg)' }}>
              {errors.form}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl px-3 py-3 text-sm font-semibold disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--accentText)' }}
          >
            {loading ? 'Salvando...' : 'Salvar perfil'}
          </button>
        </form>
      </div>
    </div>
  );
}
