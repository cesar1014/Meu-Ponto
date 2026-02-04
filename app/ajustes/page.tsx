'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { startOfWeek, endOfWeek } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { usePonto } from '@/contexts/PontoContext';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { dateKeyLocal, toDateKey } from '@/lib/dates';
import { LABEL_TIPOS, TipoPonto, formatarMinutos, formatarMinutosSemSinal } from '@/lib/pontoStore';
import { uid } from '@/lib/utils';
import { AjusteRegistro, PontoJson, calcularTotalDia, calcularTotalSemana, normalizarPontosJson } from '@/lib/ajustesCalc';

const TIPOS_PONTO: TipoPonto[] = ['ENTRADA', 'SAIDA_ALMOCO', 'VOLTA_ALMOCO', 'SAIDA'];

type AjusteRow = {
  id: string;
  data_alvo: string;
  tipo: 'pontos' | 'horas';
  delta_minutos: number | null;
  pontos_json: PontoJson[] | null;
  justificativa: string;
  created_at: string;
};

export default function AjustesPage() {
  const supabase = getSupabaseBrowser();
  const { user } = useAuth();
  const { pontos, addPonto, deletePonto, config } = usePonto();

  const [date, setDate] = useState<string>(() => dateKeyLocal(new Date()));
  const [modo, setModo] = useState<'pontos' | 'horas'>('pontos');
  const [pontoEntradas, setPontoEntradas] = useState<Record<TipoPonto, string>>({
    ENTRADA: '',
    SAIDA_ALMOCO: '',
    VOLTA_ALMOCO: '',
    SAIDA: '',
    OUTRO: '',
  });
  const [pontosExtras, setPontosExtras] = useState<{ tipo: TipoPonto; time: string }[]>([]);
  const [deltaSign, setDeltaSign] = useState<1 | -1>(1);
  const [deltaHh, setDeltaHh] = useState(0);
  const [deltaMm, setDeltaMm] = useState(0);
  const [justificativa, setJustificativa] = useState('');
  const [ajustesDia, setAjustesDia] = useState<AjusteRegistro[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [weekData, setWeekData] = useState<{
    start: string;
    end: string;
    pontosMap: Map<string, PontoJson[]>;
    ajustesMap: Record<string, AjusteRegistro[]>;
  } | null>(null);

  // Note: This page is not the primary UX for ajustes (we also have ConfigView modal),
  // but we keep layout responsive/consistent across desktop widths.

  const pontosDiaBase = useMemo(() => {
    const list: PontoJson[] = [];
    TIPOS_PONTO.forEach((tipo) => {
      const time = pontoEntradas[tipo];
      if (time) list.push({ tipo, time });
    });
    pontosExtras.forEach((p) => {
      if (p.time) list.push({ tipo: p.tipo, time: p.time });
    });
    return normalizarPontosJson(list);
  }, [pontoEntradas, pontosExtras]);

  const resumoDia = useMemo(() => {
    return calcularTotalDia({
      dateISO: date,
      pontosBase: pontosDiaBase,
      ajustes: ajustesDia,
    });
  }, [date, pontosDiaBase, ajustesDia]);

  const resumoSemana = useMemo(() => {
    if (!weekData) return { workedMin: 0, ajustesMin: 0, totalMin: 0 };
    const dias: { dateISO: string; pontosBase: PontoJson[] }[] = [];
    for (let d = weekData.start; d <= weekData.end; ) {
      dias.push({
        dateISO: d,
        pontosBase: d === date ? pontosDiaBase : weekData.pontosMap.get(d) ?? [],
      });
      const next = new Date(`${d}T00:00:00`);
      next.setDate(next.getDate() + 1);
      d = dateKeyLocal(next);
    }
    return calcularTotalSemana({ dias, ajustesPorDia: weekData.ajustesMap });
  }, [weekData, pontosDiaBase, date]);

  const loadDia = async (targetDate: string) => {
    if (!supabase || !user) return;
    setErro(null);
    setStatus(null);

    const { data: pontosRow } = await supabase
      .from('pontos_dia')
      .select('pontos_json')
      .eq('user_id', user.id)
      .eq('data', targetDate)
      .maybeSingle();

    const pontosJson = (pontosRow?.pontos_json as PontoJson[] | null) ?? [];
    const nextEntradas: Record<TipoPonto, string> = {
      ENTRADA: '',
      SAIDA_ALMOCO: '',
      VOLTA_ALMOCO: '',
      SAIDA: '',
      OUTRO: '',
    };
    const extras: { tipo: TipoPonto; time: string }[] = [];

    for (const p of pontosJson) {
      if (TIPOS_PONTO.includes(p.tipo) && !nextEntradas[p.tipo]) {
        nextEntradas[p.tipo] = p.time;
      } else {
        extras.push({ tipo: p.tipo, time: p.time });
      }
    }

    setPontoEntradas(nextEntradas);
    setPontosExtras(extras);

    const { data: ajustesRows } = await supabase
      .from('ajustes')
      .select('id,data_alvo,tipo,delta_minutos,pontos_json,justificativa,created_at')
      .eq('user_id', user.id)
      .eq('data_alvo', targetDate)
      .order('created_at', { ascending: false });

    const list = (ajustesRows as AjusteRow[] | null) ?? [];
    setAjustesDia(
      list.map((row) => ({
        id: row.id,
        tipo: row.tipo,
        delta_minutos: row.delta_minutos,
        pontos_json: (row.pontos_json as PontoJson[] | null) ?? null,
        justificativa: row.justificativa,
        created_at: row.created_at,
      }))
    );

    const baseDate = new Date(`${targetDate}T12:00:00`);
    const weekStartsOn = config.weekStartsOnMonday ? 1 : 0;
    const start = dateKeyLocal(startOfWeek(baseDate, { weekStartsOn }));
    const end = dateKeyLocal(endOfWeek(baseDate, { weekStartsOn }));

    const [pontosSemanaRes, ajustesSemanaRes] = await Promise.all([
      supabase
        .from('pontos_dia')
        .select('data,pontos_json')
        .eq('user_id', user.id)
        .gte('data', start)
        .lte('data', end),
      supabase
        .from('ajustes')
        .select('id,data_alvo,tipo,delta_minutos,pontos_json,justificativa,created_at')
        .eq('user_id', user.id)
        .gte('data_alvo', start)
        .lte('data_alvo', end),
    ]);

    const pontosSemanaRows = (pontosSemanaRes.data as { data: string; pontos_json: PontoJson[] }[] | null) ?? [];
    const ajustesSemanaRows = (ajustesSemanaRes.data as AjusteRow[] | null) ?? [];

    const pontosMap = new Map<string, PontoJson[]>();
    pontosSemanaRows.forEach((row) => {
      pontosMap.set(row.data, (row.pontos_json as PontoJson[]) ?? []);
    });

    const ajustesMap: Record<string, AjusteRegistro[]> = {};
    ajustesSemanaRows.forEach((row) => {
      const key = row.data_alvo;
      const item: AjusteRegistro = {
        id: row.id,
        tipo: row.tipo,
        delta_minutos: row.delta_minutos,
        pontos_json: (row.pontos_json as PontoJson[] | null) ?? null,
        justificativa: row.justificativa,
        created_at: row.created_at,
      };
      ajustesMap[key] = ajustesMap[key] ? [...ajustesMap[key], item] : [item];
    });

    setWeekData({ start, end, pontosMap, ajustesMap });
  };

  useEffect(() => {
    void loadDia(date);
  }, [date, supabase, user, config.weekStartsOnMonday]);

  const addExtra = () => {
    setPontosExtras([...pontosExtras, { tipo: 'OUTRO', time: '' }]);
  };

  const removeExtra = (idx: number) => {
    setPontosExtras(pontosExtras.filter((_, i) => i !== idx));
  };

  const updateExtra = (idx: number, field: 'tipo' | 'time', value: string) => {
    const updated = [...pontosExtras];
    if (field === 'tipo') {
      updated[idx] = { ...updated[idx], tipo: value as TipoPonto };
    } else {
      updated[idx] = { ...updated[idx], time: value };
    }
    setPontosExtras(updated);
  };

  const salvar = async () => {
    if (!supabase || !user) return;
    setErro(null);
    setStatus(null);

    const just = justificativa.trim();
    if (!just) {
      setErro('Justificativa é obrigatória.');
      return;
    }

    if (modo === 'pontos') {
      if (pontosDiaBase.length === 0) {
        setErro('Informe pelo menos um ponto.');
        return;
      }
      setLoading(true);

      const pontosPayload = pontosDiaBase;
      const upsertRes = await supabase.from('pontos_dia').upsert(
        {
          user_id: user.id,
          data: date,
          pontos_json: pontosPayload,
        },
        { onConflict: 'user_id,data' }
      );

      if (upsertRes.error) {
        setErro('Erro ao salvar pontos do dia.');
        setLoading(false);
        return;
      }

      const ajusteRes = await supabase.from('ajustes').insert({
        user_id: user.id,
        data_alvo: date,
        tipo: 'pontos',
        delta_minutos: null,
        pontos_json: pontosPayload,
        justificativa: just,
      });

      if (ajusteRes.error) {
        setErro('Pontos salvos, mas falha ao registrar ajuste.');
        setLoading(false);
        return;
      }

      const pontosDoDia = pontos.filter((p) => toDateKey(p.atISO) === date);
      pontosDoDia.forEach((p) => deletePonto(p.id));

      pontosPayload.forEach((p) => {
        const at = new Date(`${date}T${p.time}`);
        addPonto({
          id: uid(),
          atISO: at.toISOString(),
          tipo: p.tipo,
        });
      });

      setStatus('Ajuste de pontos registrado.');
      setLoading(false);
      setJustificativa('');
      await loadDia(date);
      return;
    }

    const minutes = (Number(deltaHh) || 0) * 60 + (Number(deltaMm) || 0);
    if (minutes <= 0) {
      setErro('Informe uma quantidade de horas válida.');
      return;
    }

    setLoading(true);
    const ajusteRes = await supabase.from('ajustes').insert({
      user_id: user.id,
      data_alvo: date,
      tipo: 'horas',
      delta_minutos: deltaSign * minutes,
      pontos_json: null,
      justificativa: just,
    });

    if (ajusteRes.error) {
      setErro('Erro ao registrar ajuste de horas.');
      setLoading(false);
      return;
    }

    setStatus('Ajuste de horas registrado.');
    setLoading(false);
    setJustificativa('');
    await loadDia(date);
  };

  return (
    <div className="min-h-screen pb-24 xl:pb-10 xl:pl-24" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="text-2xl font-semibold">Ajustes retroativos</div>
        <p className="mt-1 text-xs" style={{ color: 'var(--muted2)' }}>
          Registre pontos passados ou ajuste horas com justificativa obrigatória.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                    Data alvo
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    max={dateKeyLocal(new Date())}
                    className="mt-2 rounded-2xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setModo('pontos')}
                    className="rounded-2xl border px-3 py-2 text-xs font-semibold"
                    style={{
                      borderColor: 'var(--border)',
                      background: modo === 'pontos' ? 'var(--accent)' : 'var(--card2)',
                      color: modo === 'pontos' ? 'var(--accentText)' : 'var(--text)',
                    }}
                  >
                    Ajustar pontos
                  </button>
                  <button
                    onClick={() => setModo('horas')}
                    className="rounded-2xl border px-3 py-2 text-xs font-semibold"
                    style={{
                      borderColor: 'var(--border)',
                      background: modo === 'horas' ? 'var(--accent)' : 'var(--card2)',
                      color: modo === 'horas' ? 'var(--accentText)' : 'var(--text)',
                    }}
                  >
                    Ajustar horas
                  </button>
                </div>
              </div>

              {modo === 'pontos' ? (
                <div className="mt-4 space-y-3">
                  <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                    Pontos do dia
                  </div>
                  {TIPOS_PONTO.map((tipo) => (
                    <div key={tipo} className="flex items-center gap-2">
                      <span className="flex-1 text-sm">{LABEL_TIPOS[tipo]}</span>
                      <input
                        type="time"
                        value={pontoEntradas[tipo]}
                        onChange={(e) => setPontoEntradas({ ...pontoEntradas, [tipo]: e.target.value })}
                        className="w-24 rounded-xl border px-2 py-1.5 text-sm outline-none"
                        style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                      />
                    </div>
                  ))}

                  {pontosExtras.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                        Pontos extras
                      </div>
                      {pontosExtras.map((extra, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <select
                            value={extra.tipo}
                            onChange={(e) => updateExtra(idx, 'tipo', e.target.value)}
                            className="flex-1 rounded-xl border px-2 py-1.5 text-sm outline-none"
                            style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                          >
                            {Object.entries(LABEL_TIPOS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={extra.time}
                            onChange={(e) => updateExtra(idx, 'time', e.target.value)}
                            className="w-24 rounded-xl border px-2 py-1.5 text-sm outline-none"
                            style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                          />
                          <button
                            onClick={() => removeExtra(idx)}
                            className="rounded-xl p-1.5"
                            style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--neg)' }}
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <button
                    onClick={addExtra}
                    className="w-full rounded-2xl border px-3 py-2 text-sm font-medium"
                    style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--accent)' }}
                  >
                    + Adicionar ponto extra
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                    Ajuste de horas (somar ou subtrair)
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setDeltaSign(1)}
                      className="rounded-2xl border px-3 py-2 text-sm"
                      style={{
                        borderColor: deltaSign === 1 ? 'var(--pos)' : 'var(--border)',
                        background: deltaSign === 1 ? 'rgba(34,197,94,0.15)' : 'var(--card2)',
                        color: deltaSign === 1 ? 'var(--pos)' : 'var(--text)',
                      }}
                    >
                      + Somar
                    </button>
                    <button
                      onClick={() => setDeltaSign(-1)}
                      className="rounded-2xl border px-3 py-2 text-sm"
                      style={{
                        borderColor: deltaSign === -1 ? 'var(--neg)' : 'var(--border)',
                        background: deltaSign === -1 ? 'rgba(239,68,68,0.15)' : 'var(--card2)',
                        color: deltaSign === -1 ? 'var(--neg)' : 'var(--text)',
                      }}
                    >
                      - Subtrair
                    </button>
                    <div />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      value={deltaHh}
                      onChange={(e) => setDeltaHh(Number(e.target.value))}
                      className="rounded-2xl border px-3 py-2 text-sm outline-none"
                      style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                      placeholder="Horas"
                    />
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={deltaMm}
                      onChange={(e) => setDeltaMm(Number(e.target.value))}
                      className="rounded-2xl border px-3 py-2 text-sm outline-none"
                      style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                      placeholder="Min"
                    />
                  </div>
                </div>
              )}

              <div className="mt-4">
                <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                  Justificativa
                </div>
                <input
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                  placeholder="Obrigatório"
                />
              </div>

              {erro ? (
                <div className="mt-3 rounded-2xl border px-3 py-2 text-sm" style={{ borderColor: 'rgba(251,113,133,.35)', color: 'var(--neg)' }}>
                  {erro}
                </div>
              ) : null}

              {status ? (
                <div className="mt-3 rounded-2xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted2)' }}>
                  {status}
                </div>
              ) : null}

              <button
                onClick={salvar}
                disabled={loading}
                className="mt-4 w-full rounded-2xl px-3 py-3 text-sm font-semibold disabled:opacity-60"
                style={{ background: 'var(--accent)', color: 'var(--accentText)' }}
              >
                {loading ? 'Salvando...' : 'Salvar ajuste'}
              </button>
            </div>

            <div className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                Histórico do dia
              </div>
              {ajustesDia.length === 0 ? (
                <div className="mt-3 text-sm" style={{ color: 'var(--muted2)' }}>
                  Nenhum ajuste registrado.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {ajustesDia.map((a) => (
                    <div key={a.id} className="rounded-2xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--card2)' }}>
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">
                          {a.tipo === 'horas' ? `Horas ${formatarMinutos(a.delta_minutos ?? 0)}` : 'Ajuste de pontos'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                          {new Date(a.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                      <div className="mt-1 text-xs" style={{ color: 'var(--muted2)' }}>
                        {a.justificativa}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                Resumo do dia
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Trabalhado</span>
                  <span className="font-semibold">{formatarMinutosSemSinal(resumoDia.workedMin)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Ajustes</span>
                  <span className="font-semibold">{formatarMinutos(resumoDia.ajustesMin)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total</span>
                  <span className="font-semibold">{formatarMinutosSemSinal(resumoDia.totalMin)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                Resumo da semana
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Trabalhado</span>
                  <span className="font-semibold">{formatarMinutosSemSinal(resumoSemana.workedMin)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Ajustes</span>
                  <span className="font-semibold">{formatarMinutos(resumoSemana.ajustesMin)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total</span>
                  <span className="font-semibold">{formatarMinutosSemSinal(resumoSemana.totalMin)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
