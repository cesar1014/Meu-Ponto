'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

// Dica: use SEMPRE o mesmo caminho (com @/) em todo o projeto
// pra evitar módulos duplicados no bundler.
import { useAuth } from '@/contexts/AuthContext';
import { ClientOnly } from '@/components/ClientOnly';

function LoginForm() {
  const { user, loading: authLoading, signIn, signInWithGoogle, enterGuestMode } = useAuth();
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/home');
    }
  }, [authLoading, user, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const cleanIdentifier = identifier.trim();
      const nextErrors: typeof errors = {};

      if (!cleanIdentifier) {
        nextErrors.identifier = 'Informe seu ID ou email.';
      } else if (!cleanIdentifier.includes('@')) {
        if (!/^\d+$/.test(cleanIdentifier)) {
          nextErrors.identifier = 'O ID deve conter apenas números.';
        } else if (cleanIdentifier.length < 3 || cleanIdentifier.length > 12) {
          nextErrors.identifier = 'O ID deve ter entre 3 e 12 dígitos.';
        }
      }

      if (!password) {
        nextErrors.password = 'Informe sua senha.';
      }

      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }

      let email = cleanIdentifier;

      if (!cleanIdentifier.includes('@')) {
        try {
          const res = await fetch('/api/auth/id-to-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_login: cleanIdentifier }),
          });
          const data = (await res.json()) as { email?: string | null };
          email = data?.email ?? '';
        } catch {
          email = '';
        }

        if (!email) {
          setErrors({ form: 'ID ou senha inválidos.' });
          return;
        }
      }

      const err = await signIn(email, password);
      if (err) {
        setErrors({ form: err });
        return;
      }

      router.replace('/home');
    } catch (err) {
      console.error('Falha ao fazer login', err);
      setErrors({ form: 'Falha ao fazer login. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErrors({});
    const err = await signInWithGoogle();
    if (err) {
      setErrors({ form: 'Falha ao iniciar login com Google. Tente novamente.' });
    }
  };

  const handleGuestMode = () => {
    // Proteção: evita crash se por algum motivo enterGuestMode vier undefined
    if (typeof enterGuestMode === 'function') {
      enterGuestMode();
    } else if (typeof window !== 'undefined') {
      // fallback: mantém o mesmo padrão do seu AuthContext
      try {
        localStorage.setItem('pontoapp.guest.v1', '1');
      } catch {
        // ignore
      }
    }

    router.replace('/home');
  };

  return (
    <div
      className="w-full max-w-md rounded-3xl border p-6"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
    >
      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
        Acesso
      </div>

      <div className="mt-1 text-2xl font-semibold">Entrar</div>

      <p className="mt-2 text-xs" style={{ color: 'var(--muted2)' }}>
        Use seu ID ou email e senha para acessar seus pontos. A sessao fica salva neste dispositivo para acesso rapido.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          type="text"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="ID ou Email"
          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
        />
        {errors.identifier ? (
          <div className="text-xs" style={{ color: 'var(--neg)' }}>
            {errors.identifier}
          </div>
        ) : null}

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full rounded-2xl border px-3 py-2 pr-10 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-xs opacity-70 transition hover:opacity-100"
            style={{ color: 'var(--muted2)' }}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={showPassword}
            title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password ? (
          <div className="text-xs" style={{ color: 'var(--neg)' }}>
            {errors.password}
          </div>
        ) : null}

        <div className="text-right text-xs">
          <Link href="/auth/esqueci-senha" className="underline" style={{ color: 'var(--muted2)' }}>
            Esqueci minha senha
          </Link>
        </div>

        {errors.form && (
          <div
            className="text-xs rounded-2xl border px-3 py-2"
            style={{ borderColor: 'rgba(251,113,133,.35)', color: 'var(--neg)' }}
          >
            {errors.form}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl px-3 py-3 text-sm font-semibold disabled:opacity-60"
          style={{ background: 'var(--accent)', color: 'var(--accentText)' }}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full rounded-2xl border px-3 py-3 text-sm font-semibold transition hover:opacity-90"
          style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
        >
          Entrar com Google
        </button>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--muted2)' }}>
            ou
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        <button
          type="button"
          onClick={handleGuestMode}
          className="w-full rounded-2xl border px-3 py-3 text-sm font-semibold transition hover:opacity-80"
          style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
        >
          Continuar como visitante
        </button>
      </div>

      <div className="mt-4 text-xs" style={{ color: 'var(--muted2)' }}>
        Nao tem conta?{' '}
        <Link href="/cadastro" className="underline">
          Criar cadastro
        </Link>
      </div>

    </div>
  );
}

function LoginFallback() {
  return (
    <div
      className="w-full max-w-md rounded-3xl border p-6"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
    >
      <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
        Acesso
      </div>
      <div className="mt-1 text-2xl font-semibold">Entrar</div>
      <p className="mt-2 text-xs" style={{ color: 'var(--muted2)' }}>
        Use seu ID ou email e senha para acessar seus pontos. A sessao fica salva neste dispositivo para acesso rapido.
      </p>

      <div className="mt-4 space-y-3">
        <div className="w-full rounded-2xl border px-3 py-2 text-sm h-10" style={{ borderColor: 'var(--border)', background: 'var(--card2)' }} />
        <div className="w-full rounded-2xl border px-3 py-2 text-sm h-10" style={{ borderColor: 'var(--border)', background: 'var(--card2)' }} />
        <div className="w-full rounded-2xl px-3 py-3 text-sm font-semibold h-12" style={{ background: 'var(--accent)', color: 'var(--accentText)' }} />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="w-full rounded-2xl border px-3 py-3 text-sm font-semibold h-12" style={{ borderColor: 'var(--border)', background: 'var(--card2)' }} />
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--muted2)' }}>
            ou
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>
        <div className="w-full rounded-2xl border px-3 py-3 text-sm font-semibold h-12" style={{ borderColor: 'var(--border)', background: 'var(--card2)' }} />
      </div>

      <div className="mt-4 text-xs" style={{ color: 'var(--muted2)' }}>
        Nao tem conta? <span className="underline">Criar cadastro</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="flex-1 flex items-center justify-center px-4">
        <ClientOnly fallback={<LoginFallback />}>
          <LoginForm />
        </ClientOnly>
      </div>
      <div
        className="pb-6 text-center text-[10px] uppercase tracking-[0.3em]"
        style={{ color: 'var(--muted2)', opacity: 0.45 }}
      >
        Desenvolvido por Cesar Santana
      </div>
    </div>
  );
}
