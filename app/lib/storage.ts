export type StorageScope = {
  userId?: string | null;
  isGuest?: boolean;
};

type StorageKey = 'pontos' | 'config' | 'ajustes' | 'pendingOps' | 'setup' | 'diasOcultos';

const PREFIX = 'pontoapp';
const VERSION = 'v1';

const LEGACY_KEYS: Record<StorageKey, string> = {
  pontos: `${PREFIX}.pontos.${VERSION}`,
  config: `${PREFIX}.config.${VERSION}`,
  ajustes: `${PREFIX}.ajustes.${VERSION}`,
  pendingOps: `${PREFIX}.pendingOps.${VERSION}`,
  setup: `${PREFIX}.setup.${VERSION}`,
  diasOcultos: `${PREFIX}.dias.ocultos.${VERSION}`,
};

function scopeId(scope: StorageScope) {
  if (scope.isGuest) return 'guest';
  if (scope.userId) return `user_${encodeURIComponent(scope.userId)}`;
  return 'anonymous';
}

export function buildStorageKey(key: StorageKey, scope: StorageScope) {
  return `${PREFIX}.${key}.${scopeId(scope)}.${VERSION}`;
}

function hasAnyScopedKey(prefix: string) {
  if (typeof window === 'undefined') return false;
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) return true;
  }
  return false;
}

export function migrateLegacyValue(key: StorageKey, scope: StorageScope) {
  if (typeof window === 'undefined') return;
  const scopedKey = buildStorageKey(key, scope);
  if (localStorage.getItem(scopedKey) != null) return;

  const legacyKey = LEGACY_KEYS[key];
  const legacyValue = localStorage.getItem(legacyKey);
  if (legacyValue == null) return;

  // Avoid auto-migrating legacy data if there are already scoped keys for any user.
  const scopedPrefix = `${PREFIX}.${key}.user_`;
  if (!scope.isGuest && hasAnyScopedKey(scopedPrefix)) return;

  localStorage.setItem(scopedKey, legacyValue);
}
