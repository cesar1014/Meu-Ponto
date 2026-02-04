'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowser } from '../lib/supabase/browser';

export type Profile = {
  user_id: string;
  nome: string;
  id_login: string;
  created_at?: string;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  isGuest: boolean;
  needsProfile: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<string | null>;
  enterGuestMode: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const GUEST_KEY = 'pontoapp.guest.v1';

function getInitialGuest(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabaseBrowser();
  const initialGuest = getInitialGuest();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  // Se não tem supabase, não precisa carregar - modo offline/visitante funciona direto
  const [loading, setLoading] = useState(() => supabase !== null && !initialGuest);
  const [isGuest, setIsGuest] = useState<boolean>(initialGuest);

  const fetchProfile = useCallback(
    async (userId?: string | null) => {
      if (!supabase || !userId) {
        setProfile(null);
        setNeedsProfile(false);
        return;
      }
      setProfileLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id,nome,id_login,created_at')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) {
          console.error('Erro ao buscar perfil', error);
          setProfile(null);
          setNeedsProfile(false);
        } else if (data?.user_id) {
          setProfile(data as Profile);
          setNeedsProfile(false);
        } else {
          setProfile(null);
          setNeedsProfile(true);
        }
      } catch (err) {
        console.error('Erro ao buscar perfil', err);
        setProfile(null);
        setNeedsProfile(false);
      } finally {
        setProfileLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (!supabase || isGuest) {
      setLoading(false);
      setProfile(null);
      setNeedsProfile(false);
      return;
    }

    let isMounted = true;

    const loadSession = async () => {
      try {
        const [{ data: sessionData }, { data: userData }] = await Promise.all([
          supabase.auth.getSession(),
          supabase.auth.getUser(),
        ]);
        if (!isMounted) return;
        const nextSession = sessionData.session ?? null;
        const nextUser = userData.user ?? nextSession?.user ?? null;
        setSession(nextSession);
        setUser(nextUser);
        void fetchProfile(nextUser?.id);
        setLoading(false);
      } catch {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    void loadSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      try {
        setSession(nextSession ?? null);
        const { data: userData } = await supabase.auth.getUser();
        const nextUser = userData.user ?? nextSession?.user ?? null;
        setUser(nextUser);
        void fetchProfile(nextUser?.id);
      } catch (err) {
        console.error('Erro ao atualizar sessão', err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase, isGuest, fetchProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const signIn = async (email: string, password: string) => {
      if (!supabase) return 'Supabase nao configurado.';
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!error) {
          setIsGuest(false);
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem(GUEST_KEY);
              document.cookie = 'pontoapp_guest=; Path=/; Max-Age=0';
            } catch {
              // ignore storage errors
            }
          }
          return null;
        }
        if (error.message?.toLowerCase().includes('email not confirmed')) {
          return 'Conta nao confirmada. Desative a confirmacao de email no Supabase ou confirme seu email.';
        }
        if (error.message?.toLowerCase().includes('invalid login credentials')) {
          return 'ID ou senha invalidos. Verifique seus dados e tente novamente.';
        }
        if (error.message?.toLowerCase().includes('user not found')) {
          return 'Usuario nao encontrado. Verifique o ID ou crie uma conta.';
        }
        // Erro de configuracao/chave invalida
        if (error.message?.toLowerCase().includes('invalid api key') ||
          error.message?.toLowerCase().includes('invalid key')) {
          return 'Erro de configuracao do servidor. Contate o administrador.';
        }
        return error.message ?? 'Erro ao fazer login. Tente novamente.';
      } catch (err) {
        console.error('Erro ao fazer login', err);
        return 'Erro ao fazer login. Tente novamente.';
      }
    };
    const signInWithGoogle = async () => {
      if (!supabase) return 'Supabase nao configurado.';
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/auth/completar-perfil` : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: redirectTo ? { redirectTo } : undefined,
      });
      return error?.message ?? null;
    };

    const signOut = async () => {
      setIsGuest(false);
      setProfile(null);
      setNeedsProfile(false);
      setSession(null);
      setUser(null);
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(GUEST_KEY);
          document.cookie = 'pontoapp_guest=; Path=/; Max-Age=0';
        } catch {
          // ignore storage errors
        }
      }
      if (!supabase) return 'Supabase nao configurado.';
      const { error } = await supabase.auth.signOut();
      return error?.message ?? null;
    };

    const enterGuestMode = () => {
      setIsGuest(true);
      setLoading(false);
      setProfile(null);
      setNeedsProfile(false);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(GUEST_KEY, '1');
          document.cookie = 'pontoapp_guest=1; Path=/; Max-Age=2592000';
        } catch {
          // ignore storage errors
        }
      }
    };

    return {
      user,
      session,
      loading,
      profile,
      profileLoading,
      isGuest,
      needsProfile,
      signIn,
      signInWithGoogle,
      signOut,
      enterGuestMode,
      refreshProfile: async () => {
        if (!supabase) return;
        const userId = user?.id ?? (await supabase.auth.getUser()).data.user?.id ?? null;
        await fetchProfile(userId);
      },
    };
  }, [supabase, user, session, loading, profile, profileLoading, isGuest, needsProfile, fetchProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

