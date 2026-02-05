import { type Ponto, type TipoPonto, workedMinutesFromPunches } from './pontoStore';

export type PontoJson = {
  tipo: TipoPonto;
  time: string;
  obs?: string;
};

export type AjusteRegistro = {
  id: string;
  tipo: 'pontos' | 'horas';
  delta_minutos: number | null;
  pontos_json: PontoJson[] | null;
  justificativa: string;
  created_at: string;
};

export function pontosJsonToPontos(dateISO: string, pontosJson: PontoJson[]): Ponto[] {
  return pontosJson
    .filter((p) => p.time)
    .map((p, idx) => ({
      id: `${dateISO}-${p.tipo}-${idx}`,
      atISO: new Date(`${dateISO}T${p.time}`).toISOString(),
      tipo: p.tipo,
      obs: p.obs,
    }))
    .sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));
}

export function normalizarPontosJson(pontos: PontoJson[]): PontoJson[] {
  return pontos
    .filter((p) => p.time)
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function calcularTotalDia({
  dateISO,
  pontosBase,
  ajustes,
}: {
  dateISO: string;
  pontosBase: PontoJson[];
  ajustes: AjusteRegistro[];
}) {
  const ajustesOrdenados = [...ajustes].sort(
    (a, b) => +new Date(a.created_at) - +new Date(b.created_at)
  );
  const ultimoAjustePontos = [...ajustesOrdenados].reverse().find((a) => a.tipo === 'pontos' && a.pontos_json);

  const pontosFonte = ultimoAjustePontos?.pontos_json ?? pontosBase;
  const worked = workedMinutesFromPunches(pontosJsonToPontos(dateISO, pontosFonte));
  const ajustesMin = ajustesOrdenados
    .filter((a) => a.tipo === 'horas')
    .reduce((acc, a) => acc + (a.delta_minutos ?? 0), 0);

  return {
    workedMin: worked,
    ajustesMin,
    totalMin: worked + ajustesMin,
    pontosUsados: pontosFonte,
  };
}

export function calcularTotalSemana({
  dias,
  ajustesPorDia,
}: {
  dias: { dateISO: string; pontosBase: PontoJson[] }[];
  ajustesPorDia: Record<string, AjusteRegistro[]>;
}) {
  return dias.reduce(
    (acc, dia) => {
      const ajustes = ajustesPorDia[dia.dateISO] ?? [];
      const resumo = calcularTotalDia({
        dateISO: dia.dateISO,
        pontosBase: dia.pontosBase,
        ajustes,
      });
      return {
        workedMin: acc.workedMin + resumo.workedMin,
        ajustesMin: acc.ajustesMin + resumo.ajustesMin,
        totalMin: acc.totalMin + resumo.totalMin,
      };
    },
    { workedMin: 0, ajustesMin: 0, totalMin: 0 }
  );
}
