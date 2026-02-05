import type { SupabaseClient } from '@supabase/supabase-js';
import {
  loadAjustes,
  loadConfig,
  loadPendingOps,
  loadPontos,
  normalizeConfig,
  saveAjustes,
  saveConfig,
  savePendingOps,
  savePontos,
  sortDesc,
  type AjusteBanco,
  type Config,
  type PendingOp,
  type Ponto,
} from './pontoStore';
import { type StorageScope } from './storage';

export type LocalState = {
  pontos: Ponto[];
  ajustes: AjusteBanco[];
  config: Config;
  pendingOps: PendingOp[];
};

export function loadLocalState(scope: StorageScope): LocalState {
  return {
    pontos: loadPontos(scope),
    ajustes: loadAjustes(scope),
    config: loadConfig(scope),
    pendingOps: loadPendingOps(scope),
  };
}

export function persistLocalState(scope: StorageScope, state: Omit<LocalState, 'pendingOps'>) {
  savePontos(scope, state.pontos);
  saveAjustes(scope, state.ajustes);
  saveConfig(scope, state.config);
}

export function persistPendingOps(scope: StorageScope, ops: PendingOp[]) {
  savePendingOps(scope, ops);
  return ops;
}

export function queuePendingOp(scope: StorageScope, ops: PendingOp[], op: PendingOp) {
  const next = [...ops, op];
  savePendingOps(scope, next);
  return next;
}

export async function flushPendingOps({
  supabase,
  userId,
  ops,
  scope,
}: {
  supabase: SupabaseClient | null;
  userId: string | null;
  ops: PendingOp[];
  scope: StorageScope;
}) {
  if (!supabase || !userId) return ops;
  if (ops.length === 0) return ops;

  const remaining: PendingOp[] = [];

  for (const op of ops) {
    if (op.type === 'delete') {
      const res = await supabase.from('pontos').delete().eq('id', op.id).eq('user_id', userId);
      if (res.error) remaining.push(op);
      continue;
    }

    const p = op.ponto;
    const payload = {
      id: p.id,
      user_id: userId,
      at_iso: p.atISO,
      tipo: p.tipo,
      obs: p.obs ?? null,
    };
    const res = await supabase.from('pontos').upsert(payload, { onConflict: 'user_id,id' });
    if (res.error) remaining.push(op);
  }

  savePendingOps(scope, remaining);
  return remaining;
}

export async function syncCloud({
  supabase,
  userId,
  localPontos,
  localConfig,
  pendingOps,
  scope,
}: {
  supabase: SupabaseClient | null;
  userId: string | null;
  localPontos: Ponto[];
  localConfig: Config;
  pendingOps: PendingOp[];
  scope: StorageScope;
}) {
  if (!supabase || !userId) {
    return { pontos: localPontos, config: localConfig, pendingOps };
  }

  const errors: string[] = [];
  const remainingOps = await flushPendingOps({ supabase, userId, ops: pendingOps, scope });

  const pendingInsertIds = new Set(
    remainingOps.filter((op) => op.type === 'insert').map((op) => op.ponto.id)
  );
  const preferLocalIds = new Set(
    remainingOps.filter((op): op is Extract<typeof op, { ponto: Ponto }> => op.type !== 'delete').map((op) => op.ponto.id)
  );

  const [pontosRes, configRes] = await Promise.all([
    supabase.from('pontos').select('id, at_iso, tipo, obs').eq('user_id', userId),
    supabase.from('config').select('config, updated_at').eq('user_id', userId).maybeSingle(),
  ]);

  if (pontosRes.error) errors.push(pontosRes.error.message);
  if (configRes.error) errors.push(configRes.error.message);

  const remoteRows = pontosRes.data ?? [];
  const remotePontos = remoteRows.map((row) => ({
    id: row.id as string,
    atISO: row.at_iso as string,
    tipo: row.tipo as Ponto['tipo'],
    obs: (row.obs as string | null) ?? undefined,
  }));

  const remoteMap = new Map(remotePontos.map((p) => [p.id, p]));
  const locaisNaoEnviados = localPontos.filter((p) => !remoteMap.has(p.id) && !pendingInsertIds.has(p.id));

  if (locaisNaoEnviados.length > 0) {
    const payload = locaisNaoEnviados.map((p) => ({
      id: p.id,
      user_id: userId,
      at_iso: p.atISO,
      tipo: p.tipo,
      obs: p.obs ?? null,
    }));
    const insertRes = await supabase.from('pontos').insert(payload);
    if (insertRes.error) errors.push(insertRes.error.message);
  }

  const mergedMap = new Map<string, Ponto>();
  for (const p of remotePontos) {
    if (!preferLocalIds.has(p.id)) mergedMap.set(p.id, p);
  }
  for (const p of localPontos) {
    if (preferLocalIds.has(p.id) || !mergedMap.has(p.id)) mergedMap.set(p.id, p);
  }

  const merged = sortDesc([...mergedMap.values()]);
  savePontos(scope, merged);

  const remoteRow = configRes.data as { config?: Config; updated_at?: string } | null;
  const remoteConfig = remoteRow?.config ? normalizeConfig(remoteRow.config as Partial<Config>) : null;
  const remoteUpdatedAt = remoteRow?.updated_at ?? remoteConfig?.updatedAt;

  const localNormalized = normalizeConfig(localConfig);
  const localUpdatedAt = localNormalized.updatedAt;

  const remoteTs = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
  const localTs = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;

  let nextConfig = localNormalized;

  if (remoteConfig && remoteTs > localTs) {
    nextConfig = remoteConfig;
  } else {
    const nextUpdatedAt = localUpdatedAt ?? new Date().toISOString();
    nextConfig = { ...localNormalized, updatedAt: nextUpdatedAt };
    const payload = {
      user_id: userId,
      config: nextConfig,
      updated_at: nextUpdatedAt,
    };
    const upsertRes = await supabase.from('config').upsert(payload, { onConflict: 'user_id' });
    if (upsertRes.error) errors.push(upsertRes.error.message);
  }

  saveConfig(scope, nextConfig);

  if (errors.length > 0) {
    throw new Error(errors[0]);
  }

  return { pontos: merged, config: nextConfig, pendingOps: remainingOps };
}
