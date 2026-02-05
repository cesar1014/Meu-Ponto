function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Format while typing: keeps only digits, inserts ":" when there are 3+ digits
export function formatTimeDraft(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  const hours = digits.slice(0, digits.length - 2);
  const minutes = digits.slice(-2);
  return `${hours}:${minutes}`;
}

// Normalize to HH:MM or return null when empty
export function normalizeTimeValue(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const trimmed = digits.slice(0, 4);

  let hoursStr = '';
  let minutesStr = '';
  if (trimmed.length <= 2) {
    hoursStr = trimmed;
    minutesStr = '00';
  } else {
    hoursStr = trimmed.slice(0, trimmed.length - 2);
    minutesStr = trimmed.slice(-2);
  }

  let hours = Number(hoursStr);
  let minutes = Number(minutesStr);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  hours = clamp(hours, 0, 23);
  minutes = clamp(minutes, 0, 59);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
