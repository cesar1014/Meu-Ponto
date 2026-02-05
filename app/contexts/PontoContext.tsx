'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AjusteBanco,
  type Config,
  DEFAULT_CONFIG,
  type PendingOp,
  type PendingAjusteOp,
  type Ponto,
  compactarHistorico,
  loadAjustes,
  loadConfig,
  loadPendingOps,
  loadPendingAjusteOps,
  loadPontos,
  normalizeConfig,
  saveAjustes,
  saveConfig,
  savePendingOps,
  savePendingAjusteOps,
  savePontos,
  sortDesc,
} from '@/lib/pontoStore';
import { type StorageScope } from '@/lib/storage';
import { applyThemeToRoot, getTheme } from '@/lib/themes';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

type SetStateAction<T> = T | ((prev: T) => T);

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

type PontoContextValue = {
  pontos: Ponto[];
  ajustes: AjusteBanco[];
  config: Config;
  setPontos: (next: SetStateAction<Ponto[]>) => void;
  setAjustes: (next: SetStateAction<AjusteBanco[]>) => void;
  setConfig: (next: SetStateAction<Config>) => void;
  addPonto: (p: Ponto) => void;
  updatePonto: (p: Ponto) => void;
  deletePonto: (id: string) => void;
  addAjuste: (a: AjusteBanco) => void;
  updateAjuste: (a: AjusteBanco) => void;
  deleteAjuste: (id: string) => void;
  syncStatus: SyncStatus;
  pendingCount: number;
  syncNow: () => Promise<void>;
};

const PontoContext = createContext<PontoContextValue | null>(null);

function resolveNext<T>(next: SetStateAction<T>, prev: T): T {
  return typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
}

export function PontoProvider({ children }: { children: React.ReactNode }) {
  const { user, isGuest } = useAuth();
  const scope = useMemo<StorageScope>(
    () => ({ userId: user?.id ?? undefined, isGuest }),
    [user?.id, isGuest]
  );
  const scopeKey = scope.isGuest ? 'guest' : scope.userId ? `user:${scope.userId}` : 'anonymous';
  const [stateScopeKey, setStateScopeKey] = useState(scopeKey);

  // Estado principal (persistido localmente)
  const [pontos, setPontosState] = useState<Ponto[]>(() => loadPontos(scope));
  const [ajustes, setAjustesState] = useState<AjusteBanco[]>(() => loadAjustes(scope));
  const [config, setConfigState] = useState<Config>(() => loadConfig(scope));
  const supabase = getSupabaseBrowser();

  // Refs de apoio para sincronizacao/offline
  const pontosRef = useRef(pontos);
  const configRef = useRef(config);
  const pendingRef = useRef<PendingOp[]>(loadPendingOps(scope));
  const pendingAjusteRef = useRef<PendingAjusteOp[]>(loadPendingAjusteOps(scope));
  const onlineRef = useRef(true);
  const syncingRef = useRef(false);

  // Sync status state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  useEffect(() => {
    const nextPontos = loadPontos(scope);
    const nextAjustes = loadAjustes(scope);
    const nextConfig = loadConfig(scope);
    const nextPending = loadPendingOps(scope);
    const nextPendingAjuste = loadPendingAjusteOps(scope);

    setPontosState(nextPontos);
    setAjustesState(nextAjustes);
    setConfigState(nextConfig);
    setStateScopeKey(scopeKey);
    setSyncStatus('idle');

    pontosRef.current = nextPontos;
    configRef.current = nextConfig;
    pendingRef.current = nextPending;
    pendingAjusteRef.current = nextPendingAjuste;
  }, [scope]);

  useEffect(() => {
    pontosRef.current = pontos;
  }, [pontos]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const persistPending = useCallback((next: PendingOp[]) => {
    pendingRef.current = next;
    savePendingOps(scope, next);
  }, [scope]);

  const queuePendingOp = useCallback(
    (op: PendingOp) => {
      const next = [...pendingRef.current, op];
      persistPending(next);
    },
    [persistPending]
  );

  const persistPendingAjuste = useCallback((next: PendingAjusteOp[]) => {
    pendingAjusteRef.current = next;
    savePendingAjusteOps(scope, next);
  }, [scope]);

  const queuePendingAjusteOp = useCallback(
    (op: PendingAjusteOp) => {
      const next = [...pendingAjusteRef.current, op];
      persistPendingAjuste(next);
    },
    [persistPendingAjuste]
  );

  const setPontos = useCallback((next: SetStateAction<Ponto[]>) => {
    setPontosState((prev) => {
      const resolved = resolveNext(next, prev);
      savePontos(scope, resolved);
      return resolved;
    });
  }, [scope]);

  const setAjustes = useCallback((next: SetStateAction<AjusteBanco[]>) => {
    setAjustesState((prev) => {
      const resolved = resolveNext(next, prev);
      saveAjustes(scope, resolved);
      return resolved;
    });
  }, [scope]);

  const setConfig = useCallback(
    (next: SetStateAction<Config>) => {
      setConfigState((prev) => {
        const resolvedBase = resolveNext(next, prev);
        const updatedAt = new Date().toISOString();
        const resolved = { ...resolvedBase, updatedAt };
        saveConfig(scope, resolved);

        if (supabase && user && onlineRef.current) {
          const payload = {
            user_id: user.id,
            config: resolved,
            updated_at: updatedAt,
          };
          Promise.resolve(supabase.from('config').upsert(payload, { onConflict: 'user_id' }))
            .then(({ error }: { error: { message: string } | null }) => {
              if (error) console.error('Erro ao salvar config', error.message);
            })
            .catch((err: unknown) => {
              console.error('Erro ao salvar config', err);
            });
        }

        return resolved;
      });
    },
    [supabase, user, scope]
  );

  const addPonto = useCallback(
    (p: Ponto) => {
      setPontos((prev) => sortDesc([p, ...prev]));

      if (supabase && user && onlineRef.current) {
        const payload = {
          id: p.id,
          user_id: user.id,
          at_iso: p.atISO,
          tipo: p.tipo,
          obs: p.obs ?? null,
        };
        Promise.resolve(supabase.from('pontos').insert(payload))
          .then(({ error }: { error: { message: string } | null }) => {
            if (error) {
              queuePendingOp({ userId: user.id, type: 'insert', ponto: p });
            }
          })
          .catch((err: unknown) => {
            console.error('Erro ao inserir ponto', err);
            queuePendingOp({ userId: user.id, type: 'insert', ponto: p });
          });
      } else if (user) {
        queuePendingOp({ userId: user.id, type: 'insert', ponto: p });
      }
    },
    [setPontos, supabase, user, queuePendingOp]
  );

  const updatePonto = useCallback(
    (p: Ponto) => {
      setPontos((prev) => sortDesc(prev.map((item) => (item.id === p.id ? p : item))));

      if (supabase && user && onlineRef.current) {
        const payload = {
          at_iso: p.atISO,
          tipo: p.tipo,
          obs: p.obs ?? null,
        };
        Promise.resolve(supabase.from('pontos').update(payload).eq('id', p.id).eq('user_id', user.id))
          .then(({ error }: { error: { message: string } | null }) => {
            if (error) {
              queuePendingOp({ userId: user.id, type: 'update', ponto: p });
            }
          })
          .catch((err: unknown) => {
            console.error('Erro ao atualizar ponto', err);
            queuePendingOp({ userId: user.id, type: 'update', ponto: p });
          });
      } else if (user) {
        queuePendingOp({ userId: user.id, type: 'update', ponto: p });
      }
    },
    [setPontos, supabase, user, queuePendingOp]
  );

  const deletePonto = useCallback(
    (id: string) => {
      setPontos((prev) => prev.filter((p) => p.id !== id));

      if (supabase && user && onlineRef.current) {
        Promise.resolve(supabase.from('pontos').delete().eq('id', id).eq('user_id', user.id))
          .then(({ error }: { error: { message: string } | null }) => {
            if (error) {
              queuePendingOp({ userId: user.id, type: 'delete', id });
            }
          })
          .catch((err: unknown) => {
            console.error('Erro ao deletar ponto', err);
            queuePendingOp({ userId: user.id, type: 'delete', id });
          });
      } else if (user) {
        queuePendingOp({ userId: user.id, type: 'delete', id });
      }
    },
    [setPontos, supabase, user, queuePendingOp]
  );

  const addAjuste = useCallback(
    async (a: AjusteBanco) => {
      setAjustes((prev: AjusteBanco[]) => sortDesc([a, ...prev]));

      // Sync to Supabase
      if (supabase && user && onlineRef.current) {
        try {
          const dateKey = a.atISO.slice(0, 10);
          const { error } = await supabase.from('ajustes').insert({
            id: a.id,
            user_id: user.id,
            data_alvo: dateKey,
            tipo: a.tipo.toLowerCase(), // Normalize to lowercase for DB
            delta_minutos: a.tipo === 'ATESTADO' ? 0 : a.minutos,
            justificativa: a.justificativa ?? '',
            at_iso: a.atISO,
          });
          if (error) throw error;
        } catch (err: unknown) {
          console.error('Erro ao inserir ajuste no Supabase:', err);
          // Queue for later sync
          queuePendingAjusteOp({ userId: user.id, type: 'insert', ajuste: a });
        }
      } else if (user) {
        // Offline - queue for sync
        queuePendingAjusteOp({ userId: user.id, type: 'insert', ajuste: a });
      }
    },
    [setAjustes, supabase, user, queuePendingAjusteOp]
  );

  const updateAjuste = useCallback(
    async (a: AjusteBanco) => {
      setAjustes((prev: AjusteBanco[]) => sortDesc(prev.map((item: AjusteBanco) => (item.id === a.id ? a : item))));

      if (supabase && user && onlineRef.current) {
        try {
          const dateKey = a.atISO.slice(0, 10);
          const { error } = await supabase.from('ajustes').update({
            data_alvo: dateKey,
            tipo: a.tipo.toLowerCase(),
            delta_minutos: a.tipo === 'ATESTADO' ? 0 : a.minutos,
            justificativa: a.justificativa ?? '',
            at_iso: a.atISO,
          }).eq('id', a.id);
          if (error) throw error;
        } catch (err: unknown) {
          console.error('Erro ao atualizar ajuste no Supabase:', err);
          queuePendingAjusteOp({ userId: user.id, type: 'update', ajuste: a });
        }
      } else if (user) {
        queuePendingAjusteOp({ userId: user.id, type: 'update', ajuste: a });
      }
    },
    [setAjustes, supabase, user, queuePendingAjusteOp]
  );

  const deleteAjuste = useCallback(
    async (id: string) => {
      setAjustes((prev: AjusteBanco[]) => prev.filter((a: AjusteBanco) => a.id !== id));

      if (supabase && user && onlineRef.current) {
        try {
          const { error } = await supabase.from('ajustes').delete().eq('id', id);
          if (error) throw error;
        } catch (err: unknown) {
          console.error('Erro ao deletar ajuste no Supabase:', err);
          queuePendingAjusteOp({ userId: user.id, type: 'delete', id });
        }
      } else if (user) {
        queuePendingAjusteOp({ userId: user.id, type: 'delete', id });
      }
    },
    [setAjustes, supabase, user, queuePendingAjusteOp]
  );


  // Sincroniza operacoes pendentes (offline -> nuvem)
  const flushPendingOps = useCallback(async () => {
    if (!supabase || !user || !onlineRef.current) return;
    const pendingAll = pendingRef.current;
    if (pendingAll.length === 0) return;

    const mine = pendingAll.filter((op) => op.userId === user.id);
    const others = pendingAll.filter((op) => op.userId !== user.id);
    if (mine.length === 0) return;

    const remaining: PendingOp[] = [];

    for (const op of mine) {
      if (op.type === 'delete') {
        const res = await supabase.from('pontos').delete().eq('id', op.id).eq('user_id', user.id);
        if (res.error) remaining.push(op);
        continue;
      }

      const p = op.ponto;
      const payload = {
        id: p.id,
        user_id: user.id,
        at_iso: p.atISO,
        tipo: p.tipo,
        obs: p.obs ?? null,
      };
      const res = await supabase.from('pontos').upsert(payload, { onConflict: 'user_id,id' });
      if (res.error) remaining.push(op);
    }

    if (remaining.length !== mine.length) {
      persistPending([...others, ...remaining]);
    }
  }, [supabase, user, persistPending]);

  // Sincroniza nuvem -> local (e envia pontos que ainda estao no local)
  const syncCloud = useCallback(async () => {
    if (!supabase || !user || !onlineRef.current) return;
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncStatus('syncing');

    try {
      await flushPendingOps();

      const pendingOps = pendingRef.current.filter((op) => op.userId === user.id);
      const pendingInsertIds = new Set(
        pendingOps.filter((op) => op.type === 'insert').map((op) => op.ponto.id)
      );
      const preferLocalIds = new Set(
        pendingOps.filter((op): op is Extract<typeof op, { ponto: Ponto }> => op.type !== 'delete').map((op) => op.ponto.id)
      );
      const pendingDeleteIds = new Set(
        pendingOps.filter((op): op is Extract<PendingOp, { type: 'delete' }> => op.type === 'delete').map((op) => op.id)
      );

      const [pontosRes, configRes, ajustesRes] = await Promise.all([
        supabase.from('pontos').select('id, at_iso, tipo, obs').eq('user_id', user.id),
        supabase.from('config').select('config, updated_at').eq('user_id', user.id).maybeSingle(),
        supabase.from('ajustes').select('id, data_alvo, tipo, delta_minutos, justificativa, at_iso').eq('user_id', user.id),
      ]);

      if (pontosRes.error) {
        console.error('Erro ao buscar pontos', pontosRes.error.message);
      }

      const remoteRows = pontosRes.data ?? [];
      const remotePontos = remoteRows.map((row) => ({
        id: row.id as string,
        atISO: row.at_iso as string,
        tipo: row.tipo as Ponto['tipo'],
        obs: (row.obs as string | null) ?? undefined,
      }));

      const remoteMap = new Map(remotePontos.map((p) => [p.id, p]));
      const localPontos = pontosRef.current;
      const locaisNaoEnviados = localPontos.filter((p) => !remoteMap.has(p.id) && !pendingInsertIds.has(p.id));

      if (locaisNaoEnviados.length > 0) {
        const payload = locaisNaoEnviados.map((p) => ({
          id: p.id,
          user_id: user.id,
          at_iso: p.atISO,
          tipo: p.tipo,
          obs: p.obs ?? null,
        }));
        const insertRes = await supabase.from('pontos').insert(payload);
        if (insertRes.error) {
          console.error('Erro ao enviar pontos locais', insertRes.error.message);
        }
      }

      const mergedMap = new Map<string, Ponto>();
      for (const p of remotePontos) {
        if (pendingDeleteIds.has(p.id)) continue;
        if (!preferLocalIds.has(p.id)) mergedMap.set(p.id, p);
      }
      for (const p of localPontos) {
        if (preferLocalIds.has(p.id) || !mergedMap.has(p.id)) mergedMap.set(p.id, p);
      }

      const merged = sortDesc([...mergedMap.values()]);
      setPontosState(merged);
      savePontos(scope, merged);

      // Sync ajustes from Supabase
      if (ajustesRes.error) {
        console.error('Erro ao buscar ajustes', ajustesRes.error.message);
      } else {
        const remoteAjustes = (ajustesRes.data ?? []).map((row: { id: string; data_alvo: string; tipo: string; delta_minutos: number | null; justificativa: string | null; at_iso: string | null }) => ({
          id: row.id,
          atISO: row.at_iso ?? `${row.data_alvo}T12:00:00.000Z`,
          tipo: (row.tipo?.toUpperCase() ?? 'CREDITO') as AjusteBanco['tipo'],
          minutos: row.delta_minutos ?? 0,
          justificativa: row.justificativa ?? undefined,
        }));

        // Merge with local ajustes (prefer local for pending ops)
        const pendingAjusteOps = pendingAjusteRef.current.filter((op) => op.userId === user.id);
        const pendingAjusteIds = new Set(
          pendingAjusteOps.filter((op): op is { userId: string; type: 'insert' | 'update'; ajuste: AjusteBanco } => op.type !== 'delete').map((op) => op.ajuste.id)
        );

        const localAjustes = ajustes;
        const ajustesMergedMap = new Map<string, AjusteBanco>();

        for (const a of remoteAjustes) {
          if (!pendingAjusteIds.has(a.id)) ajustesMergedMap.set(a.id, a);
        }
        for (const a of localAjustes) {
          if (pendingAjusteIds.has(a.id) || !ajustesMergedMap.has(a.id)) ajustesMergedMap.set(a.id, a);
        }

        const mergedAjustes = sortDesc([...ajustesMergedMap.values()]);
        setAjustesState(mergedAjustes);
        saveAjustes(scope, mergedAjustes);
      }


      if (configRes.error) {
        console.error('Erro ao buscar config', configRes.error.message);
      }

      const remoteRow = configRes.data as { config?: Config; updated_at?: string } | null;
      const remoteConfig = remoteRow?.config ? normalizeConfig(remoteRow.config as Partial<Config>) : null;
      const remoteUpdatedAt = remoteRow?.updated_at ?? remoteConfig?.updatedAt;

      const localConfig = normalizeConfig(configRef.current);
      const localUpdatedAt = localConfig.updatedAt;

      const remoteTs = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
      const localTs = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;

      if (remoteConfig && remoteTs > localTs) {
        setConfigState(remoteConfig);
        saveConfig(scope, remoteConfig);
      } else {
        const nextUpdatedAt = localUpdatedAt ?? new Date().toISOString();
        const nextConfig = { ...localConfig, updatedAt: nextUpdatedAt };
        configRef.current = nextConfig;
        setConfigState(nextConfig);
        saveConfig(scope, nextConfig);

        const payload = {
          user_id: user.id,
          config: nextConfig,
          updated_at: nextUpdatedAt,
        };
        const upsertRes = await supabase.from('config').upsert(payload, { onConflict: 'user_id' });
        if (upsertRes.error) {
          console.error('Erro ao salvar config', upsertRes.error.message);
        }
      }
      setSyncStatus('success');
    } catch (err) {
      console.error('Erro ao sincronizar', err);
      setSyncStatus('error');
    } finally {
      syncingRef.current = false;
    }
  }, [supabase, user, flushPendingOps, scope]);

  // Estado online/offline do navegador
  useEffect(() => {
    if (typeof window === 'undefined') return;
    onlineRef.current = navigator.onLine;

    const handleOnline = () => {
      onlineRef.current = true;
      void syncCloud();
    };
    const handleOffline = () => {
      onlineRef.current = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncCloud]);

  useEffect(() => {
    if (!supabase || !user) return;
    void syncCloud();
  }, [supabase, user, syncCloud]);

  useEffect(() => {
    const theme = getTheme(config?.themeId ?? DEFAULT_CONFIG.themeId);
    applyThemeToRoot(theme);
  }, [config.themeId]);

  useEffect(() => {
    if (stateScopeKey !== scopeKey) return;
    const result = compactarHistorico({
      pontos,
      ajustes,
      config,
      diasLimite: 120,
    });
    if (!result.mudou) return;
    const nextUpdatedAt = new Date().toISOString();
    const nextConfig = { ...result.config, updatedAt: nextUpdatedAt };
    const apply = () => {
      setPontosState(result.pontos);
      setAjustesState(result.ajustes);
      setConfigState(nextConfig);
    };
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(apply);
    } else {
      Promise.resolve().then(apply);
    }
    savePontos(scope, result.pontos);
    saveAjustes(scope, result.ajustes);
    saveConfig(scope, nextConfig);
    if (supabase && user && onlineRef.current) {
      const payload = {
        user_id: user.id,
        config: nextConfig,
        updated_at: nextUpdatedAt,
      };
      Promise.resolve(supabase.from('config').upsert(payload, { onConflict: 'user_id' }))
        .then(({ error }: { error: { message: string } | null }) => {
          if (error) console.error('Erro ao salvar config', error.message);
        })
        .catch((err: unknown) => {
          console.error('Erro ao salvar config', err);
        });
    }
  }, [pontos, ajustes, config, supabase, user, scope, scopeKey, stateScopeKey]);

  const pendingCount = useMemo(() => {
    if (!user) return 0;
    return pendingRef.current.filter((op) => op.userId === user.id).length;
  }, [user, pendingRef.current]);

  const value = useMemo(
    () => ({
      pontos,
      ajustes,
      config,
      setPontos,
      setAjustes,
      setConfig,
      addPonto,
      updatePonto,
      deletePonto,
      addAjuste,
      updateAjuste,
      deleteAjuste,
      syncStatus,
      pendingCount,
      syncNow: syncCloud,
    }),
    [pontos, ajustes, config, setPontos, setAjustes, setConfig, addPonto, updatePonto, deletePonto, addAjuste, updateAjuste, deleteAjuste, syncStatus, pendingCount, syncCloud]
  );

  return <PontoContext.Provider value={value}>{children}</PontoContext.Provider>;
}

export function usePonto() {
  const ctx = useContext(PontoContext);
  if (!ctx) {
    throw new Error('usePonto must be used within PontoProvider');
  }
  return ctx;
}
