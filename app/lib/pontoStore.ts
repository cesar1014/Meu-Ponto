'use client';

import { addDaysISO, dateKeyLocal, parseISODate, toDateKey } from './dates';
import { buildStorageKey, migrateLegacyValue, type StorageScope } from './storage';

// Tipos
export type TipoPonto = 'ENTRADA' | 'SAIDA_ALMOCO' | 'VOLTA_ALMOCO' | 'SAIDA' | 'OUTRO';

export type Ponto = {
  id: string;
  atISO: string;
  tipo: TipoPonto;
  obs?: string;
};

export type AjusteBanco = {
  id: string;
  atISO: string;
  tipo: 'CREDITO' | 'DEBITO' | 'ATESTADO';
  minutos: number;
  justificativa?: string;
};

export type MarcoSaldo = { isoDate: string; saldoMinutos: number };

export type DailyTargets = {
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat?: number;
  sun?: number;
};

export type Config = {
  themeId:
  | 'obsidian'
  | 'emerald'
  | 'sunset'
  | 'ha'
  | 'obsidianLight'
  | 'emeraldLight'
  | 'sunsetLight'
  | 'haLight'
  | 'graphite'
  | 'aurora';
  notificacoes: boolean;
  alertaAlmoco: boolean;
  alertaHoraExtra: boolean;
  alarmesGeral: boolean;
  prefer24h: boolean;
  weekStartsOnMonday: boolean;
  weeklyTargetMinutes: number;
  dailyTargets: DailyTargets;
  weekendEnabled: boolean;
  jornadaConfigurada: boolean;
  updatedAt?: string;
  marco?: MarcoSaldo;
};

export type PendingOp =
  | { userId: string; type: 'insert'; ponto: Ponto }
  | { userId: string; type: 'update'; ponto: Ponto }
  | { userId: string; type: 'delete'; id: string };

export const LIMITE_EXTRA_DIA = 120; // 2h
export const AVISO_EXTRA_ANTES = 20; // 20 min antes

export type PendingAjusteOp =
  | { userId: string; type: 'insert'; ajuste: AjusteBanco }
  | { userId: string; type: 'update'; ajuste: AjusteBanco }
  | { userId: string; type: 'delete'; id: string };

// Feriados (Exemplo)
export const FERIADOS_2026 = [
  '2026-01-01',
  '2026-02-16',
  '2026-02-17',
  '2026-04-03',
  '2026-04-21',
  '2026-05-01',
  '2026-06-04',
  '2026-07-09',
  '2026-09-07',
  '2026-10-12',
  '2026-11-02',
  '2026-11-15',
  '2026-11-20',
  '2026-12-25',
];

/**
 * ✅ Labels (como você pediu):
 * - "Entrada do almoço" = quando você INICIA o almoço
 * - "Saída do almoço"   = quando você VOLTA do almoço (vai voltar pro serviço)
 */
export const LABEL_TIPOS: Record<TipoPonto, string> = {
  ENTRADA: 'Entrada',
  SAIDA_ALMOCO: 'Entrada do Almoço', // início da pausa
  VOLTA_ALMOCO: 'Volta do Almoço', // fim da pausa
  SAIDA: 'Saída',
  OUTRO: 'Outro',
};

export function id() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function sortDesc<T extends { atISO: string }>(arr: T[]) {
  return [...arr].sort((a, b) => +new Date(b.atISO) - +new Date(a.atISO));
}

export function pontosEqual(a: Ponto, b: Ponto) {
  return a.atISO === b.atISO && a.tipo === b.tipo && (a.obs ?? '') === (b.obs ?? '');
}

export function diffPontos(current: Ponto[], next: Ponto[]) {
  const currentMap = new Map(current.map((p) => [p.id, p]));
  const nextMap = new Map(next.map((p) => [p.id, p]));
  const toAdd: Ponto[] = [];
  const toUpdate: Ponto[] = [];
  const toDelete: string[] = [];

  for (const [id, pNext] of nextMap) {
    const pCur = currentMap.get(id);
    if (!pCur) {
      toAdd.push(pNext);
      continue;
    }
    if (!pontosEqual(pCur, pNext)) {
      toUpdate.push(pNext);
    }
  }

  for (const [id] of currentMap) {
    if (!nextMap.has(id)) {
      toDelete.push(id);
    }
  }

  return { toAdd, toUpdate, toDelete };
}

export function isHoliday(isoDate: string) {
  return FERIADOS_2026.includes(isoDate);
}

export function metaMinutosDoDia(isoDate: string, config?: Config) {
  if (isHoliday(isoDate)) return 0;
  const d = parseISODate(isoDate);
  const dow = d.getDay(); // 0 = domingo, 6 = sábado

  const targets = config?.dailyTargets;
  if (!targets) return 0;

  // Fim de semana
  if (dow === 0) {
    return config?.weekendEnabled ? (targets.sun ?? 0) : 0;
  }
  if (dow === 6) {
    return config?.weekendEnabled ? (targets.sat ?? 0) : 0;
  }

  switch (dow) {
    case 1:
      return targets.mon ?? 0;
    case 2:
      return targets.tue ?? 0;
    case 3:
      return targets.wed ?? 0;
    case 4:
      return targets.thu ?? 0;
    case 5:
      return targets.fri ?? 0;
    default:
      return 0;
  }
}

function sumWorkedFromTypedPunches(pontosDoDia: Ponto[], now?: Date) {
  if (pontosDoDia.length === 0) return 0;
  const ordenados = [...pontosDoDia].sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));

  let total = 0;
  let aberto: { time: number; type: 'ENTRADA' | 'VOLTA_ALMOCO' } | null = null;
  let podeAbrirPosAlmoco = false;

  for (const p of ordenados) {
    const t = +new Date(p.atISO);
    if (p.tipo === 'OUTRO') continue;

    if (p.tipo === 'ENTRADA') {
      if (!aberto) {
        aberto = { time: t, type: p.tipo };
      }
      // novo ciclo do dia, ignora volta almoço sem saída almoço válida
      podeAbrirPosAlmoco = false;
      continue;
    }

    if (p.tipo === 'VOLTA_ALMOCO') {
      if (!aberto && podeAbrirPosAlmoco) {
        aberto = { time: t, type: p.tipo };
      }
      continue;
    }

    if (p.tipo === 'SAIDA_ALMOCO') {
      if (aberto?.type === 'ENTRADA') {
        total += Math.max(0, t - aberto.time);
        aberto = null;
        podeAbrirPosAlmoco = true;
      }
      continue;
    }

    if (p.tipo === 'SAIDA') {
      if (aberto) {
        total += Math.max(0, t - aberto.time);
        aberto = null;
      }
      podeAbrirPosAlmoco = false;
    }
  }

  if (aberto && now) {
    total += Math.max(0, now.getTime() - aberto.time);
  }

  return Math.round(total / 60000);
}

export function workedMinutesFromPunches(pontosDoDia: Ponto[]) {
  return sumWorkedFromTypedPunches(pontosDoDia);
}

export function formatarMinutos(minutos: number) {
  const sinal = minutos < 0 ? '-' : '+';
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sinal}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatarMinutosSemSinal(minutos: number) {
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function workedMinutesFromPunchesLive(pontosDoDia: Ponto[], now: Date = new Date()) {
  return sumWorkedFromTypedPunches(pontosDoDia, now);
}

export function nextTipo(pontosDia: Ponto[]): TipoPonto {
  const n = pontosDia.length;
  if (n === 0) return 'ENTRADA';
  if (n === 1) return 'SAIDA_ALMOCO';
  if (n === 2) return 'VOLTA_ALMOCO';
  return 'SAIDA';
}

/* --- Storage --- */
export function loadPontos(scope: StorageScope): Ponto[] {
  if (typeof window === 'undefined') return [];
  migrateLegacyValue('pontos', scope);
  const key = buildStorageKey('pontos', scope);
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export function savePontos(scope: StorageScope, p: Ponto[]) {
  if (typeof window === 'undefined') return;
  const key = buildStorageKey('pontos', scope);
  localStorage.setItem(key, JSON.stringify(p));
}

export function updatePontoInStorage(scope: StorageScope, pontoEditado: Ponto) {
  const atuais = loadPontos(scope);
  const index = atuais.findIndex((p) => p.id === pontoEditado.id);
  if (index >= 0) {
    atuais[index] = pontoEditado;
    const ordenados = sortDesc(atuais);
    savePontos(scope, ordenados);
    return ordenados;
  }
  return atuais;
}

export function deletePontoFromStorage(scope: StorageScope, idToDelete: string) {
  const atuais = loadPontos(scope);
  const filtrados = atuais.filter((p) => p.id !== idToDelete);
  savePontos(scope, filtrados);
  return filtrados;
}

export function loadAjustes(scope: StorageScope): AjusteBanco[] {
  if (typeof window === 'undefined') return [];
  migrateLegacyValue('ajustes', scope);
  const key = buildStorageKey('ajustes', scope);
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

export function saveAjustes(scope: StorageScope, a: AjusteBanco[]) {
  if (typeof window === 'undefined') return;
  const key = buildStorageKey('ajustes', scope);
  localStorage.setItem(key, JSON.stringify(a));
}

export const DEFAULT_CONFIG: Config = {
  themeId: 'obsidian',
  notificacoes: false,
  alertaAlmoco: false,
  alertaHoraExtra: false,
  alarmesGeral: false,
  prefer24h: true,
  weekStartsOnMonday: true,
  weeklyTargetMinutes: 0,
  dailyTargets: {
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
    sun: 0,
  },
  weekendEnabled: false,
  jornadaConfigurada: false,
  updatedAt: undefined,
};
function toMinutes(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

export function normalizeConfig(raw: Partial<Config> & { horasSegundaQuinta?: number; horasSexta?: number } = {}): Config {
  const legacySegQui = toMinutes((raw as { horasSegundaQuinta?: number }).horasSegundaQuinta, 0);
  const legacySexta = toMinutes((raw as { horasSexta?: number }).horasSexta, 0);

  const dailyTargets: DailyTargets = {
    mon: toMinutes(raw.dailyTargets?.mon, legacySegQui),
    tue: toMinutes(raw.dailyTargets?.tue, legacySegQui),
    wed: toMinutes(raw.dailyTargets?.wed, legacySegQui),
    thu: toMinutes(raw.dailyTargets?.thu, legacySegQui),
    fri: toMinutes(raw.dailyTargets?.fri, legacySexta),
    sat: toMinutes(raw.dailyTargets?.sat, 0),
    sun: toMinutes(raw.dailyTargets?.sun, 0),
  };

  const weekendEnabled = !!raw.weekendEnabled;
  const weeklyFallback = dailyTargets.mon + dailyTargets.tue + dailyTargets.wed + dailyTargets.thu + dailyTargets.fri +
    (weekendEnabled ? (dailyTargets.sat ?? 0) + (dailyTargets.sun ?? 0) : 0);
  const weeklyTargetMinutes = toMinutes(raw.weeklyTargetMinutes, weeklyFallback);

  const themeId = (typeof raw.themeId === 'string' ? raw.themeId : DEFAULT_CONFIG.themeId) as Config['themeId'];

  return {
    themeId,
    notificacoes: !!raw.notificacoes,
    alertaAlmoco: !!(raw.alertaAlmoco ?? (raw as { almocoAutoAviso?: boolean }).almocoAutoAviso),
    alertaHoraExtra: !!raw.alertaHoraExtra,
    alarmesGeral: !!raw.alarmesGeral,
    prefer24h: raw.prefer24h ?? true,
    weekStartsOnMonday: raw.weekStartsOnMonday ?? true,
    weeklyTargetMinutes,
    dailyTargets,
    weekendEnabled,
    jornadaConfigurada: !!raw.jornadaConfigurada,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    marco: raw.marco || undefined,
  };
}

export function loadConfig(scope: StorageScope): Config {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  migrateLegacyValue('config', scope);
  const key = buildStorageKey('config', scope);
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    return normalizeConfig(raw);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(scope: StorageScope, cfg: Config) {
  if (typeof window === 'undefined') return;
  const key = buildStorageKey('config', scope);
  localStorage.setItem(key, JSON.stringify(cfg));
}

/* --- Pendencias de sync (offline) --- */
export function loadPendingOps(scope: StorageScope): PendingOp[] {
  if (typeof window === 'undefined') return [];
  migrateLegacyValue('pendingOps', scope);
  const key = buildStorageKey('pendingOps', scope);
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? (raw as PendingOp[]) : [];
  } catch {
    return [];
  }
}

export function savePendingOps(scope: StorageScope, ops: PendingOp[]) {
  if (typeof window === 'undefined') return;
  const key = buildStorageKey('pendingOps', scope);
  localStorage.setItem(key, JSON.stringify(ops));
}

/* --- Pendencias de ajustes (offline) --- */
export function loadPendingAjusteOps(scope: StorageScope): PendingAjusteOp[] {
  if (typeof window === 'undefined') return [];
  const key = `pontoapp.pendingAjusteOps.${scope.isGuest ? 'guest' : scope.userId ? `user_${scope.userId}` : 'anonymous'}.v1`;
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? (raw as PendingAjusteOp[]) : [];
  } catch {
    return [];
  }
}

export function savePendingAjusteOps(scope: StorageScope, ops: PendingAjusteOp[]) {
  if (typeof window === 'undefined') return;
  const key = `pontoapp.pendingAjusteOps.${scope.isGuest ? 'guest' : scope.userId ? `user_${scope.userId}` : 'anonymous'}.v1`;
  localStorage.setItem(key, JSON.stringify(ops));
}

/* --- Cálculos --- */
export function calcSaldoPeriodo({
  pontos,
  ajustes,
  config,
  startISO,
  endISO,
  saldoInicial = 0,
}: {
  pontos: Ponto[];
  ajustes: AjusteBanco[];
  config?: Config;
  startISO: string;
  endISO: string;
  saldoInicial?: number;
}) {
  if (endISO < startISO) return saldoInicial;

  const map = new Map<string, Ponto[]>();
  for (const p of pontos) {
    const k = toDateKey(p.atISO);
    map.set(k, [...(map.get(k) ?? []), p]);
  }

  const ajustesMap = new Map<string, AjusteBanco[]>();
  for (const a of ajustes) {
    const k = toDateKey(a.atISO);
    ajustesMap.set(k, [...(ajustesMap.get(k) ?? []), a]);
  }

  let saldo = saldoInicial;

  for (let d = startISO; d <= endISO; d = addDaysISO(d, 1)) {
    const meta = metaMinutosDoDia(d, config);
    const pontosDia = (map.get(d) ?? []).sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));
    const hasAny = pontosDia.length > 0;
    const hasAtestado = (ajustesMap.get(d) ?? []).some((a) => a.tipo === 'ATESTADO');

    if (!hasAny) {
      if (meta > 0 && !hasAtestado) saldo -= meta;
      continue;
    }

    const worked = workedMinutesFromPunches(pontosDia);
    saldo += worked - meta;
  }

  const startDt = parseISODate(startISO);
  const endDt = parseISODate(endISO);
  endDt.setHours(23, 59, 59, 999);

  for (const a of ajustes) {
    const t = new Date(a.atISO);
    if (t < startDt || t > endDt) continue;
    saldo += (a.tipo === 'CREDITO' ? 1 : -1) * a.minutos;
  }

  return saldo;
}

export function calcSaldo2026(pontos: Ponto[], ajustes: AjusteBanco[], marco?: MarcoSaldo, config?: Config) {
  const hojeISO = dateKeyLocal();
  const end = hojeISO > '2026-12-31' ? '2026-12-31' : hojeISO;
  const startBase = '2026-01-01';
  const start = marco?.isoDate && marco.isoDate > startBase ? marco.isoDate : startBase;

  const map = new Map<string, Ponto[]>();
  for (const p of pontos) {
    const k = toDateKey(p.atISO);
    map.set(k, [...(map.get(k) ?? []), p]);
  }


  const ajustesMap = new Map<string, AjusteBanco[]>();
  for (const a of ajustes) {
    const k = toDateKey(a.atISO);
    ajustesMap.set(k, [...(ajustesMap.get(k) ?? []), a]);
  }
  let saldo = marco?.saldoMinutos ?? 0;
  let faltas = 0;

  for (let d = start; d <= end; d = addDaysISO(d, 1)) {
    const meta = metaMinutosDoDia(d, config);
    const pontosDia = (map.get(d) ?? []).sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));
    const hasAny = pontosDia.length > 0;
    const hasSaida = pontosDia.some((p) => p.tipo === 'SAIDA');
    const hasAtestado = (ajustesMap.get(d) ?? []).some((a) => a.tipo === 'ATESTADO');

    // Skip today if day is still in progress (no SAIDA yet)
    if (d === hojeISO && hasAny && !hasSaida && !hasAtestado) continue;

    if (!hasAny && d === hojeISO) continue; // hoje vazio não conta falta
    if (!hasAny) {
      if (meta > 0) {
        if (!hasAtestado) {
          saldo -= meta;
          faltas += 1;
        }
      }
      continue;
    }

    const worked = workedMinutesFromPunches(pontosDia);
    saldo += worked - meta;
  }

  const startDt = parseISODate(start);
  const endDt = parseISODate(end);
  endDt.setHours(23, 59, 59, 999);

  for (const a of ajustes) {
    const t = new Date(a.atISO);
    if (t < startDt || t > endDt) continue;
    saldo += (a.tipo === 'CREDITO' ? 1 : -1) * a.minutos;
  }

  return { saldoMinutos: saldo, faltas, start };
}

export function compactarHistorico({
  pontos,
  ajustes,
  config,
  diasLimite = 120,
  hoje = new Date(),
}: {
  pontos: Ponto[];
  ajustes: AjusteBanco[];
  config: Config;
  diasLimite?: number;
  hoje?: Date;
}) {
  if (diasLimite <= 0) return { pontos, ajustes, config, mudou: false };

  const hojeISO = dateKeyLocal(hoje);
  const oldestAllowed = addDaysISO(hojeISO, -(diasLimite - 1));

  const hasOld = pontos.some((p) => toDateKey(p.atISO) < oldestAllowed);
  const hasOldAjustes = ajustes.some((a) => toDateKey(a.atISO) < oldestAllowed);
  if (!hasOld && !hasOldAjustes) return { pontos, ajustes, config, mudou: false };

  let nextConfig = config;
  const marcoISO = config.marco?.isoDate;

  if (!marcoISO || marcoISO < oldestAllowed) {
    const startISO = marcoISO ?? '2026-01-01';
    const endISO = addDaysISO(oldestAllowed, -1);
    const saldoInicial = config.marco?.saldoMinutos ?? 0;

    const saldoAte = calcSaldoPeriodo({
      pontos,
      ajustes,
      config,
      startISO,
      endISO,
      saldoInicial,
    });

    nextConfig = {
      ...config,
      marco: { isoDate: oldestAllowed, saldoMinutos: saldoAte },
    };
  }

  const cutoffISO = nextConfig.marco?.isoDate ?? oldestAllowed;

  const pontosNovos = pontos.filter((p) => toDateKey(p.atISO) >= cutoffISO);
  const ajustesNovos = ajustes.filter((a) => toDateKey(a.atISO) >= cutoffISO);

  return { pontos: pontosNovos, ajustes: ajustesNovos, config: nextConfig, mudou: true };
}

export function extraDoDiaLiveMinutos(isoDate: string, pontos: Ponto[], now: Date, config?: Config) {
  const meta = metaMinutosDoDia(isoDate, config);
  if (meta <= 0) return 0;

  const pontosDia = pontos
    .filter((p) => toDateKey(p.atISO) === isoDate)
    .sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));

  if (pontosDia.length === 0) return 0;

  const worked = workedMinutesFromPunchesLive(pontosDia, now);
  return Math.max(0, worked - meta);
}

export function calcularHorarioMaximoSaida({
  isoDate,
  pontos,
  limiteExtraMin = LIMITE_EXTRA_DIA,
  config,
}: {
  isoDate: string;
  pontos: Ponto[];
  limiteExtraMin?: number;
  config?: Config;
}) {
  const meta = metaMinutosDoDia(isoDate, config);
  if (meta <= 0) return null;

  const pontosDia = pontos
    .filter((p) => toDateKey(p.atISO) === isoDate)
    .sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));

  if (pontosDia.length === 0) return null;

  const t0 = +new Date(pontosDia[0].atISO);
  const t1 = pontosDia[1] ? +new Date(pontosDia[1].atISO) : null;
  const t2 = pontosDia[2] ? +new Date(pontosDia[2].atISO) : null;

  const almocoMin = t1 && t2 ? Math.max(0, Math.round((t2 - t1) / 60000)) : 60;

  const maxLiquido = meta + limiteExtraMin;
  const maxSaidaMs = t0 + (almocoMin + maxLiquido) * 60000;
  return new Date(maxSaidaMs);
}




