'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ClientOnly } from '@/components/ClientOnly';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

type FormErrors = {
  nome?: string;
  id_login?: string;
  email?: string;
  password?: string;
  confirm?: string;
  form?: string;
};

function CadastroForm() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const [nome, setNome] = useState('');
  const [idLogin, setIdLogin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/home');
    }
  }, [authLoading, user, router]);

  const validate = () => {
    const nextErrors: FormErrors = {};
    const cleanNome = nome.trim();
    const cleanId = idLogin.trim();
    const cleanEmail = email.trim();

    if (!cleanNome) nextErrors.nome = 'Informe seu nome.';
    else if (cleanNome.length < 2) nextErrors.nome = 'O nome deve ter pelo menos 2 caracteres.';

    if (!cleanId) nextErrors.id_login = 'Informe seu ID.';
    else if (!/^\d+$/.test(cleanId)) nextErrors.id_login = 'O ID deve conter apenas números.';
    else if (cleanId.length < 3 || cleanId.length > 12) nextErrors.id_login = 'O ID deve ter entre 3 e 12 dígitos.';

    if (!cleanEmail) nextErrors.email = 'Informe seu email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) nextErrors.email = 'Email inválido.';

    if (!password) nextErrors.password = 'Informe sua senha.';
    else if (password.length < 8) nextErrors.password = 'A senha deve ter pelo menos 8 caracteres.';
    else if (!/\d/.test(password)) nextErrors.password = 'A senha deve conter pelo menos 1 número.';

    if (!confirm) nextErrors.confirm = 'Confirme sua senha.';
    else if (confirm !== password) nextErrors.confirm = 'As senhas não conferem.';

    return nextErrors;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setStatus(null);

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (!supabase) {
      setErrors({ form: 'Supabase não configurado.' });
      return;
    }

    setLoading(true);

    const cleanId = idLogin.trim();
    const cleanNome = nome.trim();
    const cleanEmail = email.trim();

    try {
      const idRes = await fetch('/api/auth/id-to-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_login: cleanId }),
      });
      const idData = (await idRes.json()) as { email?: string | null };
      if (idData?.email) {
        setErrors({ id_login: 'Este ID já está em uso.' });
        setLoading(false);
        return;
      }
    } catch {
      // ignore lookup errors
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          nome: cleanNome,
          id_login: cleanId,
        },
      },
    });

    if (error) {
      if (error.message?.toLowerCase().includes('user already registered')) {
        setErrors({ email: 'Este email já está em uso.' });
      } else {
        setErrors({ form: error.message ?? 'Erro ao criar conta.' });
      }
      setLoading(false);
      return;
    }

    if (data.user && data.session) {
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: data.user.id,
        nome: cleanNome,
        id_login: cleanId,
      });

      if (profileError) {
        await supabase.auth.signOut();
        if (profileError.code === '23505') {
          setErrors({ id_login: 'Este ID já está em uso.' });
        } else {
          setErrors({ form: 'Conta criada, mas houve erro ao salvar o perfil.' });
        }
        setLoading(false);
        return;
      }

      router.replace('/home');
      return;
    }

    setStatus('Conta criada. Verifique seu email para confirmar.');
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md rounded-3xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
        Cadastro
      </div>
      <div className="mt-1 text-2xl font-semibold">Criar conta</div>
      <p className="mt-2 text-xs" style={{ color: 'var(--muted2)' }}>
        Informe nome, ID, email e senha para criar sua conta.
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

        <div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
          />
          {errors.email ? <div className="mt-1 text-xs" style={{ color: 'var(--neg)' }}>{errors.email}</div> : null}
        </div>

        <div>
          <input
            type="password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha (mínimo 8 caracteres)"
            className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
          />
          {errors.password ? <div className="mt-1 text-xs" style={{ color: 'var(--neg)' }}>{errors.password}</div> : null}
        </div>

        <div>
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
          {errors.confirm ? <div className="mt-1 text-xs" style={{ color: 'var(--neg)' }}>{errors.confirm}</div> : null}
        </div>

        {errors.form ? (
          <div className="text-xs rounded-2xl border px-3 py-2" style={{ borderColor: 'rgba(251,113,133,.35)', color: 'var(--neg)' }}>
            {errors.form}
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
          {loading ? 'Criando...' : 'Criar conta'}
        </button>
      </form>

      <div className="mt-4 text-xs" style={{ color: 'var(--muted2)' }}>
        Já tem conta?{' '}
        <Link href="/login" className="underline">
          Entrar
        </Link>
      </div>
    </div>
  );
}

function CadastroFallback() {
  return (
    <div className="w-full max-w-md rounded-3xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
        Cadastro
      </div>
      <div className="mt-1 text-2xl font-semibold">Criar conta</div>
      <p className="mt-2 text-xs" style={{ color: 'var(--muted2)' }}>
        Informe nome, ID, email e senha para criar sua conta.
      </p>
      <div className="mt-4 space-y-3">
        <div className="w-full rounded-2xl border px-3 py-2 text-sm h-10" style={{ borderColor: 'var(--border)', background: 'var(--card2)' }} />
        <div className="w-full rounded-2xl border px-3 py-2 text-sm h-10" style={{ borderColor: 'var(--border)', background: 'var(--card2)' }} />
        <div className="w-full rounded-2xl border px-3 py-2 text-sm h-10" style={{ borderColor: 'var(--border)', background: 'var(--card2)' }} />
        <div className="w-full rounded-2xl border px-3 py-2 text-sm h-10" style={{ borderColor: 'var(--border)', background: 'var(--card2)' }} />
        <div className="w-full rounded-2xl px-3 py-3 text-sm font-semibold h-12" style={{ background: 'var(--accent)', color: 'var(--accentText)' }} />
      </div>
      <div className="mt-4 text-xs" style={{ color: 'var(--muted2)' }}>
        Já tem conta? <span className="underline">Entrar</span>
      </div>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <ClientOnly fallback={<CadastroFallback />}>
        <CadastroForm />
      </ClientOnly>
    </div>
  );
}
