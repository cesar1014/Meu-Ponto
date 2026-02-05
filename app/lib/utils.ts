import {
  Config,
  Ponto,
  TipoPonto,
  formatarMinutosSemSinal,
  metaMinutosDoDia,
  nextTipo,
  workedMinutesFromPunches,
  workedMinutesFromPunchesLive,
  id,
} from './pontoStore';
import { dateKeyLocal } from './dates';

// Generates a unique id
export const uid = () => id();

export function minutesToHHMM(min: number) {
  return formatarMinutosSemSinal(min);
}

// Sorts punches chronologically
export function sortPontos(pontos: Ponto[]) {
  return [...pontos].sort((a, b) => new Date(a.atISO).getTime() - new Date(b.atISO).getTime());
}

/**
 * Calculates worked minutes.
 * If isLive=true and the punch count is odd, it adds time until now.
 */
export function calculateWorkedMinutes(pontos: Ponto[], isLive = false, now = new Date()): number {
  if (isLive) return workedMinutesFromPunchesLive(pontos, now);
  return workedMinutesFromPunches(pontos);
}

export function getMetaDoDia(date: Date | string, config: Config): number {
  if (typeof date === 'string') {
    const isDateKey = /^\d{4}-\d{2}-\d{2}$/.test(date);
    const key = isDateKey ? date : dateKeyLocal(new Date(date));
    return metaMinutosDoDia(key, config);
  }
  return metaMinutosDoDia(dateKeyLocal(date), config);
}

export function getNextTipo(pontosDoDia: Ponto[]): TipoPonto {
  return nextTipo(pontosDoDia);
}
