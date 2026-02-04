export function dateKeyLocal(date: Date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toDateKey(iso: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  return dateKeyLocal(d);
}

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDaysISO(iso: string, delta: number) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + delta);
  return dateKeyLocal(d);
}

export function startOfMonthISO(iso: string) {
  const d = parseISODate(iso);
  return dateKeyLocal(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonthISO(iso: string) {
  const d = parseISODate(iso);
  return dateKeyLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function rangeDias(endISO: string, dias: number) {
  const out: string[] = [];
  if (dias <= 0) return out;
  for (let i = dias - 1; i >= 0; i -= 1) out.push(addDaysISO(endISO, -i));
  return out;
}

export function rangeDiasEntre(startISO: string, endISO: string) {
  if (endISO < startISO) return [endISO];
  const out: string[] = [];
  for (let d = startISO; d <= endISO; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

export function nowLocalDateTime() {
  const d = new Date();
  const date = dateKeyLocal(d);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date, time };
}

export function formatTimePtBr(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatDatePtBr(isoDate: string) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}
