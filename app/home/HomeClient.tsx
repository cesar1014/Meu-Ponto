'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePonto } from '../contexts/PontoContext';
import { useAuth } from '@/contexts/AuthContext';
import { BottomBar } from '../components/BottomBar';
import { HomeDisplay } from '../components/HomeDisplay';
import { OnlineIndicator, OfflineBanner } from '../components/OnlineIndicator';
import { ModalNovoAjuste } from '../components/ModalNovoAjuste';
import { motion } from 'framer-motion';
import { ChevronDown, Settings2 } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateWorkedMinutes, getMetaDoDia, minutesToHHMM, uid, getNextTipo } from '../lib/utils';
import { calcSaldo2026, diffPontos } from '../lib/pontoStore';
import { dateKeyLocal } from '../lib/dates';
import { ModalBase } from '../components/ModalBase';
import { ConfigView } from '../components/ConfigView';
import { Ponto } from '../lib/types';
import { AjusteBanco } from '../lib/pontoStore';
import { useClock } from '../hooks/useClock';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

function LoadingState() {
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

export default function HomeClient() {
  const { pontos, ajustes, config, addPonto, updatePonto, deletePonto, addAjuste, syncStatus, pendingCount, syncNow } = usePonto();
  const { user, loading: authLoading, isGuest, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isOnline } = useOnlineStatus();
  const setupCheckedRef = useRef(false);
  const setupScopeRef = useRef<string | null>(null);
  const [autoSetupOpen, setAutoSetupOpen] = useState(false);

  const clockNow = useClock({ intervalMs: 1000 });
  const now = clockNow ?? new Date();

  const [openBater, setOpenBater] = useState(false);
  const [openCfg, setOpenCfg] = useState(false);
  const [openAjustePonto, setOpenAjustePonto] = useState(false);
  const [ajusteDate, setAjusteDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateKeyLocal(d);
  });
  const todayISO = useMemo(() => dateKeyLocal(), []);

  const [tipoNovo, setTipoNovo] = useState<Ponto['tipo']>('ENTRADA');
  const [obsNova, setObsNova] = useState('');

  const setupScopeKey = useMemo(() => {
    if (isGuest) return 'guest';
    if (user?.id) return `user:${user.id}`;
    return 'anonymous';
  }, [isGuest, user?.id]);

  const setupKey = useMemo(() => `pontoapp.setup.${setupScopeKey}.v1`, [setupScopeKey]);

  useEffect(() => {
    if (setupScopeRef.current !== setupScopeKey) {
      setupCheckedRef.current = false;
      setupScopeRef.current = setupScopeKey;
    }
  }, [setupScopeKey]);

  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      router.replace('/login');
    }
  }, [authLoading, user, isGuest, router]);

  const jornadaConfigurada = config.jornadaConfigurada;

  useEffect(() => {
    if (authLoading) return;
    if (!user && !isGuest) return;
    if (setupCheckedRef.current) return;
    if (typeof window === 'undefined') return;

    const dismissed = localStorage.getItem(setupKey) === '1';

    if (!dismissed && !jornadaConfigurada) {
      setOpenCfg(true);
      setAutoSetupOpen(true);
    }

    setupCheckedRef.current = true;
  }, [authLoading, user, isGuest, jornadaConfigurada, setupKey]);

  useEffect(() => {
    if (!jornadaConfigurada) return;
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(setupKey, '1');
    } catch {
      // ignore
    }
  }, [jornadaConfigurada, setupKey]);

  const pontosHoje = useMemo(() => pontos.filter((p) => isSameDay(new Date(p.atISO), now)), [pontos, now]);

  const workedHoje = useMemo(() => calculateWorkedMinutes(pontosHoje, true, now), [pontosHoje, now]);

  const metaHoje = useMemo(() => getMetaDoDia(now, config), [now, config]);

  const deltaHoje = workedHoje - metaHoje;

  const saldoTotalMin = useMemo(() => {
    return calcSaldo2026(pontos, ajustes, config.marco, config).saldoMinutos;
  }, [pontos, ajustes, config]);

  const handleOpenBater = useCallback(() => {
    setTipoNovo(getNextTipo(pontosHoje));
    setObsNova('');
    setOpenBater(true);
  }, [pontosHoje]);

  useEffect(() => {
    const shouldOpen = searchParams?.get('bater') === '1';
    if (!shouldOpen) return;
    handleOpenBater();
    router.replace('/home', { scroll: false });
  }, [searchParams, handleOpenBater, router]);

  const handleBater = useCallback(() => {
    const novo: Ponto = {
      id: uid(),
      atISO: new Date().toISOString(),
      tipo: tipoNovo,
      obs: obsNova,
    };
    addPonto(novo);
    setOpenBater(false);
  }, [tipoNovo, obsNova, addPonto]);

  const handleCloseConfig = useCallback(() => {
    setOpenCfg(false);
    if (autoSetupOpen && typeof window !== 'undefined') {
      try {
        localStorage.setItem(setupKey, '1');
      } catch {
        // ignore
      }
      setAutoSetupOpen(false);
    }
  }, [autoSetupOpen, setupKey]);

  const handleOpenAjustes = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setAjusteDate(dateKeyLocal(d));
    setOpenAjustePonto(true);
  }, []);

  const aplicarPontos = useCallback(
    (next: Ponto[]) => {
      const { toAdd, toUpdate, toDelete } = diffPontos(pontos, next);
      toDelete.forEach((id) => deletePonto(id));
      toAdd.forEach((p) => addPonto(p));
      toUpdate.forEach((p) => updatePonto(p));
    },
    [pontos, addPonto, updatePonto, deletePonto]
  );

  const handleConfirmAjuste = useCallback(() => {
    if (!ajusteDate) return;
    setOpenAjustePonto(false);
    router.push(`/pontos?dia=${ajusteDate}&ponto=1`);
  }, [ajusteDate, router]);

  if (authLoading && !isGuest) {
    return <LoadingState />;
  }

  if (!user && !isGuest) {
    return <LoadingState />;
  }

  const displayName =
    profile?.nome ??
    (typeof user?.user_metadata?.name === 'string'
      ? (user.user_metadata.name as string)
      : typeof user?.user_metadata?.nome === 'string'
        ? (user.user_metadata.nome as string)
        : undefined);

  const greeting = isGuest ? 'Bem-vindo ao seu ponto' : displayName ? `Bem-vindo, ${displayName}` : 'Bem-vindo';

  return (
    <motion.div
      className="min-h-screen pb-24 xl:pb-10 xl:pl-24"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      <OfflineBanner isOnline={isOnline} />

      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight break-words">{greeting}</h1>
            <p className="text-xs opacity-60 uppercase tracking-widest mt-1 break-words">
              {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <OnlineIndicator
              isOnline={isOnline}
              syncStatus={syncStatus}
              pendingCount={pendingCount}
              onClick={() => void syncNow()}
            />

            {!user ? (
              <Link
                href="/login"
                className="px-3 py-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] text-xs font-semibold"
              >
                Entrar
              </Link>
            ) : null}
            <button
              onClick={() => setOpenCfg(true)}
              className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] active:scale-95 transition"
            >
              <Settings2 className="w-5 h-5 opacity-80" />
            </button>
          </div>
        </div>

        <BottomBar
          active="home"
          onOpenAjustes={handleOpenAjustes}
          onOpenConfig={() => setOpenCfg(true)}
        />

        <HomeDisplay
          pontosHoje={pontosHoje}
          metaHoje={metaHoje}
          workedHoje={workedHoje}
          deltaHoje={deltaHoje}
          saldoTotal={saldoTotalMin}
          onBater={handleOpenBater}
          minutesToHHMM={minutesToHHMM}
          now={now}
        />
      </div>

      <ModalBase aberto={openBater} aoFechar={() => setOpenBater(false)}>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">Registrar Ponto</h2>
            <p className="text-xs" style={{ color: 'var(--muted2)' }}>
              Selecione o tipo e confirme o registro.
            </p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
              Tipo de ponto
            </div>
            <div className="relative mt-2">
              <select
                value={tipoNovo}
                onChange={(e) => setTipoNovo(e.target.value as Ponto['tipo'])}
                className="w-full appearance-none rounded-2xl border bg-[var(--card2)] py-3 pl-4 pr-10 text-sm font-semibold tracking-wide text-[var(--text)] transition focus:ring-2 focus:ring-[rgba(56,189,248,0.35)]"
                style={{ borderColor: 'var(--border)' }}
              >
                <option value="ENTRADA">Entrada</option>
                <option value="SAIDA_ALMOCO">Entrada do Almoço</option>
                <option value="VOLTA_ALMOCO">Volta do Almoço</option>
                <option value="SAIDA">Saída</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-70" />
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
              Observação
            </div>
            <input
              placeholder="Observação..."
              value={obsNova}
              onChange={(e) => setObsNova(e.target.value)}
              className="mt-2 w-full rounded-2xl border bg-[var(--card2)] px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--muted2)]"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>

          <button
            onClick={handleBater}
            className="w-full rounded-2xl bg-[var(--accent)] p-4 text-lg font-bold text-[var(--accentText)] disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </ModalBase>

      <ModalBase aberto={openCfg} aoFechar={handleCloseConfig} width="max-w-4xl">
        <ConfigView onClose={handleCloseConfig} />
      </ModalBase>

      <ModalNovoAjuste
        aberto={openAjustePonto}
        initialDate={ajusteDate}
        pontosExistentes={pontos}
        aoFechar={() => setOpenAjustePonto(false)}
        aoSalvar={(a) => {
          addAjuste(a);
          setOpenAjustePonto(false);
        }}
        aoSalvarPontos={(novosPontos, dateKey) => {
          // Add or replace pontos for this date
          const outrosDias = pontos.filter((p) => p.atISO.slice(0, 10) !== dateKey);
          const next = [...outrosDias, ...novosPontos].sort(
            (a, b) => +new Date(b.atISO) - +new Date(a.atISO)
          );
          aplicarPontos(next);
          setOpenAjustePonto(false);
        }}
      />
    </motion.div>
  );
}
