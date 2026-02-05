import { DEFAULT_CONFIG, normalizeConfig, type AjusteBanco, type Config, type Ponto, type TipoPonto } from './pontoStore';
import { loadAjustes, loadConfig, loadPontos, saveAjustes, saveConfig, savePontos } from './pontoStore';
import { type StorageScope } from './storage';

const BACKUP_VERSION = 1;
const VALID_TIPOS: TipoPonto[] = ['ENTRADA', 'SAIDA_ALMOCO', 'VOLTA_ALMOCO', 'SAIDA', 'OUTRO'];

type BackupPayload = {
  version: number;
  date: string;
  scope?: { userId?: string; isGuest?: boolean };
  pontos: Ponto[];
  ajustes: AjusteBanco[];
  config: Config;
};

function isValidTipo(tipo: unknown): tipo is TipoPonto {
  return typeof tipo === 'string' && VALID_TIPOS.includes(tipo as TipoPonto);
}

function isValidPonto(value: unknown): value is Ponto {
  if (!value || typeof value !== 'object') return false;
  const v = value as Ponto;
  return (
    typeof v.id === 'string' &&
    typeof v.atISO === 'string' &&
    isValidTipo(v.tipo) &&
    (v.obs === undefined || typeof v.obs === 'string')
  );
}

function isValidAjuste(value: unknown): value is AjusteBanco {
  if (!value || typeof value !== 'object') return false;
  const v = value as AjusteBanco;
  return (
    typeof v.id === 'string' &&
    typeof v.atISO === 'string' &&
    (v.tipo === 'CREDITO' || v.tipo === 'DEBITO' || v.tipo === 'ATESTADO') &&
    typeof v.minutos === 'number' &&
    Number.isFinite(v.minutos) &&
    (v.justificativa === undefined || typeof v.justificativa === 'string')
  );
}

export function createBackup(scope: StorageScope): string {
  const data: BackupPayload = {
    version: BACKUP_VERSION,
    date: new Date().toISOString(),
    scope: {
      userId: scope.userId ?? undefined,
      isGuest: !!scope.isGuest,
    },
    pontos: loadPontos(scope),
    ajustes: loadAjustes(scope),
    config: loadConfig(scope),
  };
  return JSON.stringify(data, null, 2);
}

export function parseBackup(raw: string): { ok: true; data: BackupPayload } | { ok: false; error: string } {
  try {
    const data = JSON.parse(raw) as Partial<BackupPayload>;

    const version = typeof data.version === 'number' ? data.version : 1;
    if (version !== BACKUP_VERSION) {
      return { ok: false, error: `Versao de backup nao suportada (${version}).` };
    }

    if (!Array.isArray(data.pontos)) return { ok: false, error: 'Backup sem pontos.' };
    if (!Array.isArray(data.ajustes)) return { ok: false, error: 'Backup sem ajustes.' };

    const pontos = data.pontos.filter(isValidPonto);
    const ajustes = data.ajustes.filter(isValidAjuste);

    if (pontos.length !== data.pontos.length) return { ok: false, error: 'Pontos invalidos no backup.' };
    if (ajustes.length !== data.ajustes.length) return { ok: false, error: 'Ajustes invalidos no backup.' };

    const config = normalizeConfig((data.config ?? DEFAULT_CONFIG) as Config);

    return {
      ok: true,
      data: {
        version,
        date: typeof data.date === 'string' ? data.date : new Date().toISOString(),
        scope: data.scope,
        pontos,
        ajustes,
        config,
      },
    };
  } catch {
    return { ok: false, error: 'JSON invalido.' };
  }
}

export function restoreBackup(scope: StorageScope, raw: string): { ok: true } | { ok: false; error: string } {
  const parsed = parseBackup(raw);
  if (!parsed.ok) return parsed;

  savePontos(scope, parsed.data.pontos);
  saveAjustes(scope, parsed.data.ajustes);
  saveConfig(scope, parsed.data.config);

  return { ok: true };
}
