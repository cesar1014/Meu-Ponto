'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
  Search,
  ListChecks,
  CalendarDays,
  CheckSquare,
  Square,
  Flag,
  HeartPulse,
} from 'lucide-react';

import {
  AjusteBanco,
  calcSaldo2026,
  diffPontos,
  formatarMinutos,
  formatarMinutosSemSinal,
  id,
  LABEL_TIPOS,
  MarcoSaldo,
  metaMinutosDoDia,
  Ponto,
  sortDesc,
  TipoPonto,
  workedMinutesFromPunches,
} from '../lib/pontoStore';
import { dateKeyLocal, toDateKey } from '../lib/dates';

import { BottomBar } from '../components/BottomBar';
import { ClientOnly } from '../components/ClientOnly';
import { ModalNovoAjuste } from '../components/ModalNovoAjuste';
import { ModalBase as ModalBaseLarge } from '../components/ModalBase';
import { ConfigView } from '../components/ConfigView';
import { TimeField } from '../components/TimeField';
import { usePonto } from '../contexts/PontoContext';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeTimeValue } from '../lib/timeInput';

const TIPOS_DIA: TipoPonto[] = ['ENTRADA', 'SAIDA_ALMOCO', 'VOLTA_ALMOCO', 'SAIDA'];
const KEY_DIAS_OCULTOS = 'pontoapp.dias.ocultos.v1';

// Filtros macro simplificados
type FiltroDia = 'TODOS' | 'COMPLETO' | 'INCOMPLETO' | 'ATESTADO';
const FILTROS_DIA: { id: FiltroDia; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'COMPLETO', label: 'Completos' },
  { id: 'INCOMPLETO', label: 'Incompletos' },
  { id: 'ATESTADO', label: 'Atestado' },
];

// Sub-filtro para saldo
type FiltroSaldo = 'TODOS' | 'POSITIVO' | 'NEGATIVO' | 'ATESTADO';
const FILTROS_SALDO: { id: FiltroSaldo; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'POSITIVO', label: 'Saldo +' },
  { id: 'NEGATIVO', label: 'Saldo -' },
  { id: 'ATESTADO', label: 'Atestado' },
];

// Filtro de período
type FiltroPeriodo = '5_DIAS' | 'SEMANA' | 'MES' | '60_DIAS' | 'TODOS';
const FILTROS_PERIODO: { id: FiltroPeriodo; label: string }[] = [
  { id: '5_DIAS', label: '5 dias' },
  { id: 'SEMANA', label: 'Semana' },
  { id: 'MES', label: 'Mês' },
  { id: '60_DIAS', label: '60 dias' },
  { id: 'TODOS', label: 'Todo período' },
];

type Modo = 'DIAS' | 'PONTOS';

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d);
}

function fmtBR(isoDate: string) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function nowLocalDateTime() {
  const d = new Date();
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
    2,
    '0'
  )}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date, time };
}

function getMissingTipos(pontosDia: Ponto[]) {
  const present = new Set(pontosDia.map((p) => p.tipo));
  return TIPOS_DIA.filter((t) => !present.has(t));
}

function statusInfo(meta: number, pontosDia: Ponto[], isFuture: boolean) {
  if (isFuture) return { label: 'Futuro', tone: 'muted' as const };
  if (meta === 0 && pontosDia.length === 0) return { label: 'Folga', tone: 'muted' as const };
  if (pontosDia.length === 0) return { label: 'Sem pontos', tone: 'neg' as const };
  const missing = getMissingTipos(pontosDia);
  if (missing.length === 0) return { label: 'Pontos OK', tone: 'pos' as const };
  return { label: `Faltam ${missing.length}`, tone: 'neg' as const };
}

function badgeStyle(tone: 'pos' | 'neg' | 'muted') {
  if (tone === 'pos') {
    return {
      borderColor: 'rgba(52,211,153,.25)',
      background: 'rgba(52,211,153,.12)',
      color: 'rgba(52,211,153,.95)',
    };
  }
  if (tone === 'neg') {
    return {
      borderColor: 'rgba(251,113,133,.25)',
      background: 'rgba(251,113,133,.12)',
      color: 'rgba(251,113,133,.95)',
    };
  }
  return { borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--muted)' };
}

function addDaysISO(iso: string, delta: number) {
  const d = new Date(`${iso}T00:00`);
  d.setDate(d.getDate() + delta);
  return dateKeyLocal(d);
}

function rangeDias(endISO: string, dias: number) {
  const out: string[] = [];
  if (dias <= 0) return out;
  for (let i = dias - 1; i >= 0; i--) out.push(addDaysISO(endISO, -i));
  return out;
}

function rangeDiasEntre(startISO: string, endISO: string) {
  if (endISO < startISO) return [endISO];
  const out: string[] = [];
  for (let d = startISO; d <= endISO; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

function startOfMonthISO(iso: string) {
  const [y, m] = iso.split('-');
  return `${y}-${m}-01`;
}

function endOfMonthISO(iso: string) {
  const [y, m] = iso.split('-').map(Number);
  const end = new Date(y, m, 0);
  return dateKeyLocal(end);
}

/* --------- grafico barras (SVG) --------- */
function Bars15({
  dias,
  label,
  hojeISO,
}: {
  dias: { iso: string; worked: number; meta: number }[];
  label: string;
  hojeISO: string;
}) {
  const W = 520; // melhor no PC
  const H = 150;
  const padX = 10;
  const padY = 12;
  const bw = 18;
  const gap = 7;

  const maxY = Math.max(1, ...dias.map((d) => Math.max(d.worked, d.meta, 9 * 60)));
  const xFor = (i: number) => padX + i * (bw + gap);
  const yFor = (min: number) => padY + (1 - min / maxY) * (H - padY * 2);
  const hFor = (min: number) => Math.max(0, (min / maxY) * (H - padY * 2));

  const yMeta = yFor(9 * 60);

  return (
    <div className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs" style={{ color: 'var(--muted2)' }}>
          barras = trabalhado
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <line
            x1="0"
            x2={W}
            y1={yMeta}
            y2={yMeta}
            stroke="var(--muted2)"
            strokeWidth="1"
            strokeDasharray="5 5"
            opacity="0.8"
          />

          {dias.map((d, i) => {
            const x = xFor(i);
            const meta = d.meta;
            const worked = d.worked;
            const isFuture = d.iso > hojeISO;
            const isFolga = meta === 0;
            const hasWorked = worked > 0;
            const isMuted = isFuture || (isFolga && !hasWorked);
            const baseColor = isMuted ? 'var(--muted2)' : worked >= meta ? 'var(--pos)' : 'var(--neg)';
            const title = `${fmtBR(d.iso)} • Trab ${formatarMinutosSemSinal(worked)}${meta > 0 ? ` / Meta ${formatarMinutosSemSinal(meta)}` : ''
              }`;

            if ((meta === 0 && worked === 0) || (isFuture && worked === 0)) {
              return (
                <rect
                  key={d.iso}
                  x={x}
                  y={yFor(10)}
                  width={bw}
                  height={hFor(10)}
                  rx={6}
                  fill={baseColor}
                  opacity="0.55"
                >
                  <title>{title}</title>
                </rect>
              );
            }

            return (
              <g key={d.iso}>
                <rect x={x} y={yFor(worked)} width={bw} height={hFor(worked)} rx={6} fill={baseColor} opacity="0.9">
                  <title>{title}</title>
                </rect>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3" style={{ color: 'var(--muted2)' }}>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: 'var(--pos)' }} /> Meta OK
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: 'var(--neg)' }} /> Faltou
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: 'var(--muted2)' }} /> Futuro / folga
        </div>
      </div>
    </div>
  );
}

/* --------- modal base --------- */
function ModalBase({
  aberto,
  aoFechar,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) aoFechar();
          }}
        >
          <div className="absolute inset-0 backdrop-blur-md" style={{ background: 'rgba(0,0,0,.62)' }} />
          <motion.div
            className="relative w-full max-w-md rounded-3xl border p-5 shadow-2xl"
            style={{ borderColor: 'var(--border)', background: 'rgba(15,15,20,.92)' }}
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PontosFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="text-center">
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2"
          style={{ borderColor: 'var(--muted)', borderTopColor: 'transparent' }}
        />
        <span className="text-sm opacity-60">Carregando...</span>
      </div>
    </div>
  );
}

function PontosContent() {
  const { pontos, ajustes, config, addPonto, updatePonto, deletePonto, addAjuste, deleteAjuste, setConfig } = usePonto();
  const { user, loading: authLoading, isGuest } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryAppliedRef = useRef(false);
  const scrollToAjusteRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      router.replace('/login');
    }
  }, [authLoading, user, isGuest, router]);

  const [diasOcultos, setDiasOcultos] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = JSON.parse(localStorage.getItem(KEY_DIAS_OCULTOS) || '[]');
      return new Set<string>(Array.isArray(raw) ? raw : []);
    } catch {
      return new Set();
    }
  });

  const [modo, setModo] = useState<Modo>('DIAS');
  const [filtroDia, setFiltroDia] = useState<FiltroDia>('TODOS');
  const [filtroSaldo, setFiltroSaldo] = useState<FiltroSaldo>('TODOS');

  // Bulk delete (seleção múltipla)
  const [modoSelecao, setModoSelecao] = useState(false);
  const [diasSelecionados, setDiasSelecionados] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastSelectedDay, setLastSelectedDay] = useState<string | null>(null);

  // Marco Zero
  const [openMarcoZero, setOpenMarcoZero] = useState(false);

  const [tipoFiltro, setTipoFiltro] = useState<'TODOS' | TipoPonto>('TODOS');
  const [busca, setBusca] = useState('');

  const [edit, setEdit] = useState<Ponto | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const [ajusteRapido, setAjusteRapido] = useState<Record<TipoPonto, string>>({
    ENTRADA: '',
    SAIDA_ALMOCO: '',
    VOLTA_ALMOCO: '',
    SAIDA: '',
    OUTRO: '',
  });

  const [openAjuste, setOpenAjuste] = useState(false);
  const [ajusteDia, setAjusteDia] = useState<string | null>(null);
  const [openCfg, setOpenCfg] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'warning' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Filtro de período
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('5_DIAS');

  const hojeISO = useMemo(() => dateKeyLocal(), []);
  const periodoLabel = useMemo(() => {
    const item = FILTROS_PERIODO.find((f) => f.id === filtroPeriodo);
    return item?.label ?? 'Periodo';
  }, [filtroPeriodo]);
  const diasRange = useMemo(() => {
    if (filtroPeriodo === 'MES') {
      const start = startOfMonthISO(hojeISO);
      const end = endOfMonthISO(hojeISO);
      return rangeDiasEntre(start, end);
    }
    if (filtroPeriodo === 'SEMANA') return rangeDias(hojeISO, 7);
    if (filtroPeriodo === '60_DIAS') return rangeDias(hojeISO, 60);
    if (filtroPeriodo === 'TODOS') {
      const start = config.marco?.isoDate ?? hojeISO;
      const earliestPonto = pontos.reduce<string | null>((acc, p) => {
        const k = toDateKey(p.atISO);
        if (!acc || k < acc) return k;
        return acc;
      }, null);
      const earliestAjuste = ajustes.reduce<string | null>((acc, a) => {
        const k = toDateKey(a.atISO);
        if (!acc || k < acc) return k;
        return acc;
      }, null);
      let startISO = start;
      if (earliestPonto && earliestPonto < startISO) startISO = earliestPonto;
      if (earliestAjuste && earliestAjuste < startISO) startISO = earliestAjuste;
      return rangeDiasEntre(startISO, hojeISO);
    }
    return rangeDias(hojeISO, 5);
  }, [filtroPeriodo, hojeISO, pontos, ajustes, config.marco?.isoDate]);

  useEffect(() => {
    if (queryAppliedRef.current) return;
    const diaParam = searchParams.get('dia');
    const pontoParam = searchParams.get('ponto');
    if (!diaParam && !pontoParam) return;

    queryAppliedRef.current = true;

    const isValidDia = typeof diaParam === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(diaParam);
    let dia = isValidDia ? diaParam : null;
    if (!dia && pontoParam === '1') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      dia = dateKeyLocal(d);
    }

    if (dia) {
      setModo('DIAS');
      setExpandedDay(dia);
      if (pontoParam === '1') {
        scrollToAjusteRef.current = dia;
      }
      const rangeStart = diasRange[0];
      const rangeEnd = diasRange[diasRange.length - 1];
      if (rangeStart && rangeEnd && (dia < rangeStart || dia > rangeEnd)) {
        setFiltroPeriodo('TODOS');
      }
    }
  }, [searchParams, diasRange]);
  const diasRangeVisiveis = useMemo(() => {
    const comPontos = new Set(pontos.map((p) => toDateKey(p.atISO)));
    const comAjustes = new Set(ajustes.map((a) => toDateKey(a.atISO)));
    const comAtividade = new Set<string>([...comPontos, ...comAjustes]);

    const baseEnd = diasRange.length > 0 ? diasRange[diasRange.length - 1] : hojeISO;
    const extrasFuturos = Array.from(comAtividade).filter((d) => d > baseEnd);
    const merged = Array.from(new Set([...diasRange, ...extrasFuturos])).sort();

    if (diasOcultos.size === 0) return merged;
    return merged.filter((iso) => {
      if (!diasOcultos.has(iso)) return true;
      return comAtividade.has(iso);
    });
  }, [diasRange, diasOcultos, pontos, ajustes]);

  useEffect(() => {
    const target = scrollToAjusteRef.current;
    if (!target || expandedDay !== target) return;
    if (typeof window === 'undefined') return;
    const el = document.getElementById(`ajuste-pontos-${target}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    scrollToAjusteRef.current = null;
  }, [expandedDay, diasRangeVisiveis]);

  const saldoTotal = useMemo(() => calcSaldo2026(pontos, ajustes, config.marco, config), [pontos, ajustes, config]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(KEY_DIAS_OCULTOS, JSON.stringify(Array.from(diasOcultos)));
  }, [diasOcultos]);

  useEffect(() => {
    if (!expandedDay) return;
    const pontosDia = pontos
      .filter((p) => toDateKey(p.atISO) === expandedDay)
      .sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));
    const next: Record<TipoPonto, string> = {
      ENTRADA: '',
      SAIDA_ALMOCO: '',
      VOLTA_ALMOCO: '',
      SAIDA: '',
      OUTRO: '',
    };
    TIPOS_DIA.forEach((t) => {
      const p = pontosDia.find((x) => x.tipo === t);
      next[t] = p ? fmtTime(new Date(p.atISO)) : '';
    });
    const apply = () => setAjusteRapido(next);
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(apply);
    } else {
      Promise.resolve().then(apply);
    }
  }, [expandedDay, pontos]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (message: string, tone: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, tone });
    if (typeof window === 'undefined') return;
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  };

  const diasResumo = useMemo(() => {
    return diasRangeVisiveis
      .map((iso) => {
        const pontosDia = pontos
          .filter((p) => toDateKey(p.atISO) === iso)
          .sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));
        const meta = metaMinutosDoDia(iso, config);
        const worked = workedMinutesFromPunches(pontosDia);
        const isFuture = iso > hojeISO;
        return { iso, pontosDia, meta, worked, delta: worked - meta, isFuture };
      })
      .reverse();
  }, [pontos, diasRangeVisiveis, config, hojeISO]);

  const chart = useMemo(() => {
    return diasRangeVisiveis.map((iso) => {
      const pontosDia = pontos
        .filter((p) => toDateKey(p.atISO) === iso)
        .sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));
      return { iso, meta: metaMinutosDoDia(iso, config), worked: workedMinutesFromPunches(pontosDia) };
    });
  }, [pontos, diasRangeVisiveis, config]);

  const ajustesPorDia = useMemo(() => {
    const map = new Map<string, AjusteBanco[]>();
    ajustes.forEach((a) => {
      const key = toDateKey(a.atISO);
      map.set(key, [...(map.get(key) ?? []), a]);
    });
    map.forEach((list) => list.sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO)));
    return map;
  }, [ajustes]);

  const diasFiltrados = useMemo(() => {
    // Find earliest date with any punches for weekend visibility logic
    const datasComPontos = new Set(pontos.map(p => toDateKey(p.atISO)));
    const minDataComPonto = pontos.length > 0
      ? Math.min(...pontos.map(p => +new Date(toDateKey(p.atISO))))
      : null;

    return diasResumo
      .filter((d) => {
        const hasPontosDia = d.pontosDia.length > 0;
        const hasAjustesDia = (ajustesPorDia.get(d.iso) ?? []).length > 0;
        const date = new Date(d.iso + 'T12:00:00');
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

        // Rule 1: If no punches AND no adjustments, hide the day
        if (!hasPontosDia && !hasAjustesDia) {
          // Rule 2: Weekends can be shown but only AFTER dates with punches
          if (isWeekend && minDataComPonto) {
            const dayTime = +new Date(d.iso);
            // Show weekend only if it's after or on the earliest punch date
            if (dayTime < minDataComPonto) {
              return false;
            }
            // Also hide if it's a future day with no activity
            if (d.isFuture) {
              return false;
            }
            return true;
          }
          return false;
        }

        return true;
      })
      .filter((d) => {
        const missing = getMissingTipos(d.pontosDia);
        const completo = d.pontosDia.length > 0 && missing.length === 0;
        const ajustesDia = ajustesPorDia.get(d.iso) ?? [];
        const hasAtestado = ajustesDia.some((a) => a.tipo === 'ATESTADO');

        // Filtro macro
        if (filtroDia === 'COMPLETO') return completo;
        if (filtroDia === 'INCOMPLETO') return !completo;
        if (filtroDia === 'ATESTADO') return hasAtestado;
        return true;
      })
      .filter((d) => {
        const ajustesDia = ajustesPorDia.get(d.iso) ?? [];
        const hasAtestado = ajustesDia.some((a) => a.tipo === 'ATESTADO');
        const deltaParaFiltro = hasAtestado ? 0 : d.delta;

        // Sub-filtro de saldo
        if (filtroSaldo === 'POSITIVO') return deltaParaFiltro > 0;
        if (filtroSaldo === 'NEGATIVO') return deltaParaFiltro < 0;
        if (filtroSaldo === 'ATESTADO') return hasAtestado;
        return true;
      });
  }, [diasResumo, filtroDia, filtroSaldo, pontos, ajustesPorDia]);

  const pontosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return sortDesc(pontos).filter((p) => {
      if (tipoFiltro !== 'TODOS' && p.tipo !== tipoFiltro) return false;
      if (!q) return true;
      const txt = `${LABEL_TIPOS[p.tipo]} ${toDateKey(p.atISO)} ${fmtTime(new Date(p.atISO))} ${p.obs ?? ''}`.toLowerCase();
      return txt.includes(q);
    });
  }, [pontos, tipoFiltro, busca]);

  const salvarTudo = (next: Ponto[]) => {
    const { toAdd, toUpdate, toDelete } = diffPontos(pontos, next);
    const now = new Date();
    const futuros = [...toAdd, ...toUpdate].filter((p) => +new Date(p.atISO) > +now);
    if (futuros.length > 0 && typeof window !== 'undefined') {
      const ok = window.confirm(
        `Atencao: voce esta salvando ${futuros.length} ponto(s) em data/hora futura. Deseja continuar?`
      );
      if (!ok) return false;
    }
    toDelete.forEach((id) => deletePonto(id));
    toAdd.forEach((p) => addPonto(p));
    toUpdate.forEach((p) => updatePonto(p));
    return true;
  };

  const atualizarHorarioRapido = (tipo: TipoPonto, valor: string) => {
    setAjusteRapido((prev) => ({ ...prev, [tipo]: valor }));
  };

  const salvarAjusteRapidoDia = (iso: string) => {
    if (!iso) return;
    const pontosDia = pontos
      .filter((p) => toDateKey(p.atISO) === iso)
      .sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));
    const outrosDias = pontos.filter((p) => toDateKey(p.atISO) !== iso);
    const atualPorTipo = new Map<TipoPonto, Ponto>();
    pontosDia.forEach((p) => {
      if (!atualPorTipo.has(p.tipo)) atualPorTipo.set(p.tipo, p);
    });

    const novosDia: Ponto[] = [];
    TIPOS_DIA.forEach((t) => {
      const time = ajusteRapido[t];
      if (!time) return;
      const normalized = normalizeTimeValue(time);
      if (!normalized) return;
      const at = new Date(`${iso}T${normalized}`);
      if (Number.isNaN(+at)) return;
      const existente = atualPorTipo.get(t);
      const base = existente ?? { id: id(), tipo: t, atISO: at.toISOString() };
      novosDia.push({ ...base, tipo: t, atISO: at.toISOString() });
    });

    const saved = salvarTudo(sortDesc([...outrosDias, ...novosDia]));
    if (saved) {
      showToast('Pontos salvos com sucesso!', 'success');
      setExpandedDay(null);
    }
  };

  const apagar = (p: Ponto) => {
    const next = pontos.filter((x) => x.id !== p.id);
    salvarTudo(next);
  };

  const salvarAjuste = (novo: AjusteBanco) => {
    addAjuste(novo);
  };

  const abrirAjusteParaDia = (iso: string) => {
    setAjusteDia(iso);
    setOpenAjuste(true);
  };

  // Bulk Delete
  const toggleSelecaoDia = (iso: string, event?: React.MouseEvent) => {
    const isShiftKey = event?.shiftKey ?? false;

    if (isShiftKey && lastSelectedDay && diasFiltrados.length > 0) {
      // Shift-click: selecionar range de dias
      const daysList = diasFiltrados.map(d => d.iso);
      const startIdx = daysList.indexOf(lastSelectedDay);
      const endIdx = daysList.indexOf(iso);

      if (startIdx !== -1 && endIdx !== -1) {
        const [minIdx, maxIdx] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        setDiasSelecionados((prev) => {
          const next = new Set(prev);
          for (let i = minIdx; i <= maxIdx; i++) {
            next.add(daysList[i]);
          }
          return next;
        });
        setLastSelectedDay(iso);
        return;
      }
    }

    // Click normal
    setDiasSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) {
        next.delete(iso);
      } else {
        next.add(iso);
      }
      return next;
    });
    setLastSelectedDay(iso);
  };

  const deletarDiasSelecionados = () => {
    const diasSet = new Set(diasSelecionados);
    const nextPontos = pontos.filter((p) => !diasSet.has(toDateKey(p.atISO)));
    salvarTudo(nextPontos);
    const ajustesParaRemover = ajustes.filter((a) => diasSet.has(toDateKey(a.atISO)));
    ajustesParaRemover.forEach((a) => deleteAjuste(a.id));
    setDiasOcultos((prev) => {
      const next = new Set(prev);
      diasSet.forEach((d) => next.add(d));
      return next;
    });
    setDiasSelecionados(new Set());
    setModoSelecao(false);
    setConfirmDelete(false);
  };

  const cancelarSelecao = () => {
    setDiasSelecionados(new Set());
    setModoSelecao(false);
  };

  // Marco Zero
  const salvarMarcoZero = (marco: MarcoSaldo) => {
    const newConfig = { ...config, marco };
    setConfig(newConfig);
    setOpenMarcoZero(false);
  };

  const removerMarcoZero = () => {
    const newConfig = { ...config, marco: undefined };
    setConfig(newConfig);
  };

  if (authLoading && !isGuest) {
    return <PontosFallback />;
  }

  if (!user && !isGuest) {
    return <PontosFallback />;
  }

  return (
    <motion.div
      className="min-h-screen pb-24 xl:pb-10 xl:pl-24"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-8 xl:px-10">
        {/* topo */}
        <div className="flex items-center justify-between">
          <Link
            href="/home"
            className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </Link>

          <div className="text-sm font-semibold">Pontos</div>

          <button
            onClick={() => setOpenCfg(true)}
            className="p-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] active:scale-95 transition"
          >
            <Settings2 className="w-5 h-5 opacity-80" />
          </button>
        </div>

        <BottomBar
          active="pontos"
          onOpenAjustes={() => {
            setAjusteDia(hojeISO);
            setOpenAjuste(true);
          }}
          onOpenConfig={() => setOpenCfg(true)}
        />

        {/* Layout PC: sidebar sticky + conteúdo */}
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(300px,360px)_1fr] xl:grid-cols-[minmax(360px,420px)_1fr]">
          {/* Sidebar */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Bars15 dias={chart} label={periodoLabel} hojeISO={hojeISO} />

            <div className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              {modo === 'DIAS' ? (
              <>
                <div className="text-sm font-semibold">Filtro de dias</div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {FILTROS_DIA.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFiltroDia(f.id)}
                      className="rounded-2xl border px-3 py-2 text-xs font-semibold transition active:scale-[.99]"
                      style={{
                        borderColor: 'var(--border)',
                        background: filtroDia === f.id ? 'var(--accent)' : 'var(--card2)',
                        color: filtroDia === f.id ? 'var(--accentText)' : 'var(--text)',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Sub-filtro de saldo */}
                <div className="mt-4 text-sm font-semibold">Filtro de saldo</div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {FILTROS_SALDO.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFiltroSaldo(f.id)}
                      className="rounded-2xl border px-3 py-2 text-xs font-semibold transition active:scale-[.99]"
                      style={{
                        borderColor: 'var(--border)',
                        background: filtroSaldo === f.id ? 'var(--accent)' : 'var(--card2)',
                        color: filtroSaldo === f.id ? 'var(--accentText)' : 'var(--text)',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Filtro de período */}
                <div className="mt-4 text-sm font-semibold">Período</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {FILTROS_PERIODO.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFiltroPeriodo(f.id)}
                      className="rounded-2xl border px-3 py-2 text-xs font-semibold transition active:scale-[.99]"
                      style={{
                        borderColor: 'var(--border)',
                        background: filtroPeriodo === f.id ? 'var(--accent)' : 'var(--card2)',
                        color: filtroPeriodo === f.id ? 'var(--accentText)' : 'var(--text)',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Marco Zero */}
                <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--card2)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flag className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      <span className="text-xs font-semibold">Marco Zero</span>
                    </div>
                    <button
                      onClick={() => setOpenMarcoZero(true)}
                      className="rounded-xl border px-2 py-1 text-[10px] font-semibold"
                      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                    >
                      {config.marco ? 'Editar' : 'Definir'}
                    </button>
                  </div>
                  {config.marco ? (
                    <div className="mt-2 flex items-center justify-between text-xs" style={{ color: 'var(--muted2)' }}>
                      <span>A partir de: {fmtBR(config.marco.isoDate)}</span>
                      <button
                        onClick={removerMarcoZero}
                        className="text-xs underline opacity-70 hover:opacity-100"
                        style={{ color: 'var(--neg)' }}
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs" style={{ color: 'var(--muted2)' }}>
                      Sem marco definido (contando desde 01/01/2026)
                    </div>
                  )}
                </div>

                {/* Saldo */}
                <div className="mt-3 rounded-2xl border p-3 text-xs" style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--muted2)' }}>
                  Saldo 2026 agora: <span style={{ color: saldoTotal.saldoMinutos >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{formatarMinutos(saldoTotal.saldoMinutos)}</span>
                  <span className="ml-2 opacity-80">• faltas: {saldoTotal.faltas}</span>
                </div>

                {/* Seleção múltipla */}
                <div className="mt-3">
                  {!modoSelecao ? (
                    <button
                      onClick={() => setModoSelecao(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold"
                      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                    >
                      <CheckSquare className="h-4 w-4" />
                      Selecionar Dias
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{diasSelecionados.size} selecionados</span>
                        <button
                          onClick={cancelarSelecao}
                          className="text-xs underline opacity-70"
                        >
                          Cancelar
                        </button>
                      </div>
                      <button
                        onClick={() => setConfirmDelete(true)}
                        disabled={diasSelecionados.size === 0}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold"
                        style={{
                          borderColor: 'rgba(251,113,133,.25)',
                          background: diasSelecionados.size > 0 ? 'rgba(251,113,133,.12)' : 'var(--card2)',
                          color: diasSelecionados.size > 0 ? 'rgba(251,113,133,.95)' : 'var(--muted)',
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Apagar Selecionados
                      </button>
                    </div>
                  )}
                </div>
              </>
              ) : (
              <>
                <div className="mt-4 text-sm font-semibold">Filtro de pontos</div>

                <select
                  value={tipoFiltro}
                  onChange={(e) => setTipoFiltro(e.target.value as TipoPonto | 'TODOS')}
                  className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                >
                  <option value="TODOS">Todos os tipos</option>
                  {Object.keys(LABEL_TIPOS).map((k) => (
                    <option key={k} value={k}>
                      {LABEL_TIPOS[k as TipoPonto]}
                    </option>
                  ))}
                </select>

                <div className="mt-3 flex items-center gap-2 rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--card2)' }}>
                  <Search className="h-4 w-4 opacity-70" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar (tipo, data, obs...)"
                    className="w-full bg-transparent text-sm outline-none"
                    style={{ color: 'var(--text)' }}
                  />
                </div>

                <div className="mt-3 text-xs" style={{ color: 'var(--muted2)' }}>
                  Dica: aqui você filtra *batida por batida*.
                </div>
              </>
              )}
            </div>
          </div>

          {/* Conteúdo principal */}
          <div className="space-y-3">
            {diasFiltrados.length === 0 ? (
              <div
                className="rounded-2xl border px-3 py-4 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--muted)' }}
              >
                Nenhum dia com esse filtro.
              </div>
            ) : (
              diasFiltrados.map((d) => {
                const status = statusInfo(d.meta, d.pontosDia, d.isFuture);
                const missingTipos = getMissingTipos(d.pontosDia);
                const aberto = expandedDay === d.iso;

                const ajustesDia = ajustesPorDia.get(d.iso) ?? [];
                const hasAtestado = ajustesDia.some((a) => a.tipo === 'ATESTADO');
                const isAbonado = hasAtestado && d.pontosDia.length === 0;
                const workedForCalc = isAbonado ? d.meta : d.worked;
                const basePct = d.meta > 0 ? Math.min(100, (Math.min(workedForCalc, d.meta) / d.meta) * 100) : 0;
                const extraPct = d.meta > 0 ? Math.min(100, (Math.max(0, workedForCalc - d.meta) / d.meta) * 100) : 0;
                const statusLabel = isAbonado ? 'Abonado' : status.label;
                const statusStyle = isAbonado
                  ? { borderColor: 'var(--medicalBorder)', background: 'var(--medicalBgStrong)', color: 'var(--medical)' }
                  : badgeStyle(status.tone);

                const entradaPonto = d.pontosDia.find((p) => p.tipo === 'ENTRADA');
                const saidaPonto = d.pontosDia.find((p) => p.tipo === 'SAIDA');
                const entradaLabel = entradaPonto ? fmtTime(new Date(entradaPonto.atISO)) : '—';
                const saidaLabel = saidaPonto ? fmtTime(new Date(saidaPonto.atISO)) : '—';
                const resumoHorario = isAbonado
                  ? 'Abonado'
                  : d.pontosDia.length === 0
                    ? 'Sem pontos'
                    : `Entrada ${entradaLabel} • Saída ${saidaLabel}`;
                const dayDate = new Date(`${d.iso}T12:00:00`);
                const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
                const weekdayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
                  .format(dayDate)
                  .replace('.', '');
                const treatZeroAsExtra = isWeekend && !config.weekendEnabled;
                const extraMin = isAbonado
                  ? null
                  : d.meta > 0
                    ? d.worked - d.meta
                    : treatZeroAsExtra && d.worked > 0
                      ? d.worked
                      : null;
                const hasPositiveExtra = extraMin !== null && extraMin > 20;
                const hasNegativeExtra = extraMin !== null && extraMin < -20;
                const weekendNeutral = isWeekend && d.meta === 0 && extraMin === null;
                const extraColor =
                  extraMin === null
                    ? 'var(--muted2)'
                    : extraMin > 20
                      ? 'var(--pos)'
                      : extraMin < -20
                        ? 'var(--neg)'
                        : 'var(--muted2)';
                const cardBorderColor = hasAtestado
                  ? 'var(--medicalBorder)'
                  : diasSelecionados.has(d.iso)
                    ? 'var(--accent)'
                    : hasPositiveExtra
                      ? 'rgba(52,211,153,.28)'
                      : hasNegativeExtra
                        ? 'rgba(251,113,133,.28)'
                        : weekendNeutral
                          ? 'rgba(148,163,184,.25)'
                          : 'var(--border)';
                const cardBackground = hasAtestado
                  ? 'var(--medicalBg)'
                  : diasSelecionados.has(d.iso)
                    ? 'rgba(99,102,241,.08)'
                    : weekendNeutral
                      ? 'rgba(148,163,184,.05)'
                      : 'var(--card)';

                return (
                  <div
                    key={d.iso}
                    className="relative rounded-3xl border p-4"
                    style={{
                      borderColor: cardBorderColor,
                      background: cardBackground,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox para seleção */}
                      {modoSelecao && (
                        <button
                          onClick={(e) => toggleSelecaoDia(d.iso, e)}
                          className="mt-1 flex-none"
                        >
                          {diasSelecionados.has(d.iso) ? (
                            <CheckSquare className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                          ) : (
                            <Square className="h-5 w-5" style={{ color: 'var(--muted2)' }} />
                          )}
                        </button>
                      )}

                      <button
                        onClick={(e) => modoSelecao ? toggleSelecaoDia(d.iso, e) : setExpandedDay(aberto ? null : d.iso)}
                        className="flex flex-1 items-start justify-between text-left"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold">{fmtBR(d.iso)}</div>
                            <span
                              className="rounded-full border px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wider"
                              style={{
                                borderColor: isWeekend ? 'rgba(148,163,184,.35)' : 'var(--border)',
                                background: isWeekend ? 'rgba(148,163,184,.12)' : 'var(--card2)',
                                color: isWeekend ? 'var(--muted)' : 'var(--muted2)',
                              }}
                            >
                              {weekdayLabel}
                            </span>
                            {hasAtestado && (
                              <div
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider leading-none"
                                style={{
                                  borderColor: 'var(--medicalBorder)',
                                  background: 'var(--medicalBgStrong)',
                                  color: 'var(--medical)',
                                }}
                                title="Dia abonado por atestado médico"
                              >
                                <HeartPulse className="h-3.5 w-3.5" />
                                Atestado
                              </div>
                            )}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full border px-2 py-1" style={statusStyle}>
                              {statusLabel}
                            </span>

                            {!isAbonado ? (
                              <span className="text-xs" style={{ color: 'var(--muted2)' }}>
                                {d.pontosDia.length}/4 pontos
                              </span>
                            ) : null}
                          </div>

                          {/* mini resumo dos horários (bem pequeno) */}
                          {d.pontosDia.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px]" style={{ color: 'var(--muted2)' }}>
                              {TIPOS_DIA.map((t) => {
                                const p = d.pontosDia.find((x) => x.tipo === t);
                                return (
                                  <span
                                    key={t}
                                    className="rounded-full border px-2 py-[2px]"
                                    style={{ borderColor: 'var(--border)', background: 'var(--card2)' }}
                                  >
                                    {LABEL_TIPOS[t]}: {p ? fmtTime(new Date(p.atISO)) : '—'}
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <div className="text-xs text-right" style={{ color: 'var(--muted2)' }}>
                            {resumoHorario}
                          </div>
                          <div className="text-sm font-semibold" style={{ color: isAbonado ? 'var(--medical)' : 'var(--text)' }}>
                            Trabalhado: {isAbonado ? 'Abonado' : formatarMinutosSemSinal(d.worked)}
                          </div>
                          {isAbonado ? null : extraMin === null ? (
                            <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                              Meta não configurada
                            </div>
                          ) : (
                            <div className="text-xs font-semibold" style={{ color: extraColor }}>
                              Extra: {formatarMinutos(extraMin)}
                            </div>
                          )}
                          <ChevronDown className={`h-4 w-4 transition ${aberto ? 'rotate-180' : ''}`} style={{ color: 'var(--muted2)' }} />
                        </div>
                      </button>
                    </div>

                    <AnimatePresence initial={false}>
                      {aberto ? (
                        <motion.div
                          className="mt-4 space-y-3"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        >
                          {/* barra resumo */}
                          <div
                            id={`ajuste-pontos-${d.iso}`}
                            className="rounded-2xl border p-3"
                            style={{ borderColor: 'var(--border)', background: 'var(--card2)' }}
                          >
                            <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                              Resumo do dia
                            </div>

                            <div className="mt-2">
                              <div
                                className="relative h-2 w-full overflow-hidden rounded-full"
                                style={{ background: 'var(--card)' }}
                              >
                                <div
                                  className="absolute inset-y-0 left-0"
                                  style={{
                                    width: `${basePct}%`,
                                    background: isAbonado || d.worked >= d.meta ? 'var(--pos)' : 'var(--neg)',
                                  }}
                                />
                                {extraPct > 0 ? (
                                  <div
                                    className="absolute inset-y-0"
                                    style={{
                                      left: `${basePct}%`,
                                      width: `${Math.min(100 - basePct, extraPct)}%`,
                                      background: 'var(--accent)',
                                    }}
                                  />
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between text-xs" style={{ color: 'var(--muted2)' }}>
                              <span>Meta {formatarMinutosSemSinal(d.meta)}</span>
                              <span>Trabalhado {isAbonado ? 'Abonado' : formatarMinutosSemSinal(d.worked)}</span>
                            </div>

                            {!isAbonado && missingTipos.length > 0 && d.pontosDia.length > 0 ? (
                              <div className="mt-2 text-xs" style={{ color: 'var(--muted2)' }}>
                                Faltam: {missingTipos.map((t) => LABEL_TIPOS[t]).join(', ')}
                              </div>
                            ) : null}
                          </div>

                          {/* ajuste rapido dos pontos */}
                          <div
                            className="rounded-2xl border p-3"
                            style={{ borderColor: 'var(--border)', background: 'var(--card2)' }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                                Ajustar pontos
                              </div>
                              <button
                                onClick={() => salvarAjusteRapidoDia(d.iso)}
                                className="rounded-2xl px-3 py-1 text-xs font-semibold"
                                style={{ background: 'var(--accent)', color: 'var(--accentText)' }}
                              >
                                Salvar
                              </button>
                            </div>

                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              {TIPOS_DIA.map((t) => (
                                <div key={t} className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-semibold" style={{ color: 'var(--muted2)' }}>
                                    {LABEL_TIPOS[t]}
                                  </span>
                                  <TimeField
                                    value={ajusteRapido[t] ?? ''}
                                    onChange={(value) => atualizarHorarioRapido(t, value)}
                                    className="w-24 rounded-xl border px-2 py-1 text-xs outline-none"
                                    style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* ajustes */}
                          <div
                            className="rounded-2xl border p-3"
                            style={{ borderColor: 'var(--border)', background: 'var(--card2)' }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                                Ajustes de saldo
                              </div>

                              <button
                                onClick={() => abrirAjusteParaDia(d.iso)}
                                className="rounded-2xl border px-3 py-1 text-xs font-semibold"
                                style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                              >
                                <Plus className="mr-1 inline h-3 w-3" /> Novo ajuste
                              </button>
                            </div>

                            <div className="mt-2 space-y-2">
                              {ajustesDia.length === 0 ? (
                                <div
                                  className="rounded-2xl border px-3 py-2 text-xs"
                                  style={{
                                    borderColor: 'var(--border)',
                                    background: 'var(--card)',
                                    color: 'var(--muted)',
                                  }}
                                >
                                  Nenhum ajuste lançado.
                                </div>
                              ) : (
                                ajustesDia.map((a) => (
                                  <div
                                    key={a.id}
                                    className="rounded-2xl border px-3 py-2"
                                    style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm font-semibold">
                                        {formatarMinutos(a.tipo === 'CREDITO' ? a.minutos : -a.minutos)}
                                      </div>
                                      <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                                        {fmtTime(new Date(a.atISO))}
                                      </div>
                                    </div>

                                    {a.justificativa ? (
                                      <div className="mt-1 text-xs" style={{ color: 'var(--muted2)' }}>
                                        {a.justificativa}
                                      </div>
                                    ) : null}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* pontos do dia */}
                          <div
                            className="rounded-2xl border p-3"
                            style={{ borderColor: 'var(--border)', background: 'var(--card2)' }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                                Pontos do dia
                              </div>
                              {d.pontosDia.length > 0 && (
                                <button
                                  onClick={() => {
                                    // Delete all points of this day
                                    const pontosRestantes = pontos.filter((p) => toDateKey(p.atISO) !== d.iso);
                                    salvarTudo(pontosRestantes);
                                    setExpandedDay(null); // Close the expanded day
                                  }}
                                  className="rounded-2xl px-3 py-1 text-xs font-semibold"
                                  style={{
                                    background: 'rgba(239,68,68,0.15)',
                                    color: 'var(--neg)',
                                  }}
                                >
                                  <Trash2 className="mr-1 inline h-3 w-3" /> Apagar dia
                                </button>
                              )}
                            </div>

                            <div className="mt-2 space-y-2">
                              {d.pontosDia.length === 0 ? (
                                <div
                                  className="rounded-2xl border px-3 py-2 text-xs"
                                  style={{
                                    borderColor: 'var(--border)',
                                    background: 'var(--card)',
                                    color: 'var(--muted)',
                                  }}
                                >
                                  Nenhum ponto.
                                </div>
                              ) : (
                                d.pontosDia.map((p) => (
                                  <button
                                    key={p.id}
                                    onClick={() => setEdit(p)}
                                    className="flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition active:scale-[.99]"
                                    style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                                  >
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium">{LABEL_TIPOS[p.tipo]}</div>
                                      <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                                        {fmtTime(new Date(p.atISO))}
                                        {p.obs ? <span className="ml-2 opacity-80">• {p.obs}</span> : null}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <Pencil className="h-4 w-4 opacity-70" />
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })
            )
            }
          </div>
        </div>

        <ModalEditarPonto
          ponto={edit}
          pontosTodos={pontos}
          aoFechar={() => setEdit(null)}
          aoSalvar={(novo) => {
            const next = pontos.map((p) => (p.id === novo.id ? novo : p));
            const saved = salvarTudo(next);
            if (saved) setEdit(null);
          }}
          aoApagar={(p) => {
            apagar(p);
            setEdit(null);
          }}
        />

        <ModalNovoAjuste
          aberto={openAjuste}
          initialDate={ajusteDia ?? undefined}
          pontosExistentes={pontos}
          aoFechar={() => setOpenAjuste(false)}
          aoSalvar={(a) => {
            salvarAjuste(a);
            setOpenAjuste(false);
          }}
          aoSalvarPontos={(novosPontos, dateKey) => {
            // Remove existing punches for this date
            const outrosDias = pontos.filter((p) => toDateKey(p.atISO) !== dateKey);
            const novos = [...outrosDias, ...novosPontos].sort(
              (a, b) => +new Date(b.atISO) - +new Date(a.atISO)
            );
            const saved = salvarTudo(novos);
            if (saved) setOpenAjuste(false);
          }}
        />

        <ModalBaseLarge aberto={openCfg} aoFechar={() => setOpenCfg(false)} width="max-w-4xl">
          <ConfigView onClose={() => setOpenCfg(false)} />
        </ModalBaseLarge>

        {/* Modal Marco Zero */}
        <ModalMarcoZero
          aberto={openMarcoZero}
          aoFechar={() => setOpenMarcoZero(false)}
          aoSalvar={salvarMarcoZero}
          marcoAtual={config.marco}
        />

        {/* Modal Confirmação Delete */}
        <ModalBase aberto={confirmDelete} aoFechar={() => setConfirmDelete(false)}>
          <div className="text-center">
            <Trash2 className="mx-auto h-12 w-12" style={{ color: 'var(--neg)' }} />
            <div className="mt-4 text-lg font-semibold">Apagar {diasSelecionados.size} dias?</div>
            <div className="mt-2 text-sm" style={{ color: 'var(--muted2)' }}>
              Esta ação vai remover todos os pontos dos dias selecionados. Não pode ser desfeita.
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-2xl border px-4 py-3 text-sm"
                style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
              >
                Cancelar
              </button>
              <button
                onClick={deletarDiasSelecionados}
                className="rounded-2xl px-4 py-3 text-sm font-semibold"
                style={{ background: 'rgba(251,113,133,.9)', color: '#fff' }}
              >
                Apagar
              </button>
            </div>
          </div>
        </ModalBase>

        {toast ? (
          <div
            className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-2xl border px-4 py-2 text-sm shadow-lg"
            style={{
              borderColor:
                toast.tone === 'success'
                  ? 'rgba(34,197,94,0.4)'
                  : toast.tone === 'warning'
                    ? 'rgba(251,191,36,0.4)'
                    : 'rgba(239,68,68,0.4)',
              background:
                toast.tone === 'success'
                  ? 'rgba(34,197,94,0.15)'
                  : toast.tone === 'warning'
                    ? 'rgba(251,191,36,0.15)'
                    : 'rgba(239,68,68,0.15)',
              color:
                toast.tone === 'success'
                  ? 'var(--pos)'
                  : toast.tone === 'warning'
                    ? '#b45309'
                    : 'var(--neg)',
            }}
          >
            {toast.message}
          </div>
        ) : null}
      </div>

    </motion.div>
  );
}

/* --------- Modal editar ponto --------- */
function ModalEditarPonto({
  ponto,
  pontosTodos,
  aoFechar,
  aoSalvar,
  aoApagar,
}: {
  ponto: Ponto | null;
  pontosTodos: Ponto[];
  aoFechar: () => void;
  aoSalvar: (p: Ponto) => void;
  aoApagar: (p: Ponto) => void;
}) {
  const aberto = !!ponto;
  const [tipo, setTipo] = useState<TipoPonto>('ENTRADA');
  const [date, setDate] = useState('2026-01-01');
  const [time, setTime] = useState('09:00');
  const [obs, setObs] = useState('');

  React.useEffect(() => {
    if (!ponto) return;
    const d = new Date(ponto.atISO);
    setTipo(ponto.tipo);
    setDate(toDateKey(ponto.atISO));
    setTime(new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d));
    setObs(ponto.obs ?? '');
  }, [ponto]);

  const pontosDia = useMemo(() => {
    if (!ponto) return [];
    const iso = toDateKey(ponto.atISO);
    return pontosTodos
      .filter((p) => toDateKey(p.atISO) === iso)
      .sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));
  }, [ponto, pontosTodos]);

  const salvar = () => {
    if (!ponto) return;
    const normalized = normalizeTimeValue(time) ?? time;
    const at = new Date(`${date}T${normalized}`);
    if (Number.isNaN(+at)) return;
    aoSalvar({
      ...ponto,
      tipo,
      atISO: at.toISOString(),
      obs: obs.trim() || undefined,
    });
  };

  return (
    <ModalBase aberto={aberto} aoFechar={aoFechar}>
      {ponto && (
        <>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                Editar ponto
              </div>
              <div className="mt-1 text-lg font-semibold">{fmtBR(toDateKey(ponto.atISO))}</div>
            </div>

            <button
              onClick={aoFechar}
              className="rounded-2xl border p-2"
              style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <div className="text-xs" style={{ color: 'var(--muted2)' }}>
              Pontos do dia
            </div>
            <div className="mt-2 space-y-2">
              {pontosDia.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl border px-3 py-2"
                  style={{ borderColor: 'var(--border)', background: 'var(--card2)' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{LABEL_TIPOS[p.tipo]}</div>
                    <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                      {fmtTime(new Date(p.atISO))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-2xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
            />
            <TimeField
              value={time}
              onChange={setTime}
              className="rounded-2xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
            />
          </div>

          <div className="mt-3">
            <div className="text-xs" style={{ color: 'var(--muted2)' }}>
              Tipo
            </div>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoPonto)}
              className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
            >
              {Object.entries(LABEL_TIPOS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <div className="text-xs" style={{ color: 'var(--muted2)' }}>
              Obs
            </div>
            <input
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
              placeholder='Ex: "Corrigido"'
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              onClick={() => aoApagar(ponto)}
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'rgba(251,113,133,.25)',
                background: 'rgba(251,113,133,.10)',
                color: 'rgba(251,113,133,.95)',
              }}
            >
              <Trash2 className="mr-2 inline h-4 w-4" /> Apagar
            </button>

            <button
              onClick={aoFechar}
              className="rounded-2xl border px-4 py-3 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
              Cancelar
            </button>

            <button
              onClick={salvar}
              className="rounded-2xl px-4 py-3 text-sm font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--accentText)' }}
            >
              Salvar
            </button>
          </div>
        </>
      )}
    </ModalBase>
  );
}

export default function PontosPage() {
  return (
    <ClientOnly fallback={<PontosFallback />}>
      <PontosContent />
    </ClientOnly>
  );
}





/* --------- Modal Marco Zero --------- */
function ModalMarcoZero({
  aberto,
  aoFechar,
  aoSalvar,
  marcoAtual,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: (marco: MarcoSaldo) => void;
  marcoAtual?: MarcoSaldo;
}) {
  const [date, setDate] = useState(marcoAtual?.isoDate ?? nowLocalDateTime().date);
  const [saldoHh, setSaldoHh] = useState(0);
  const [saldoMm, setSaldoMm] = useState(0);
  const [isNegativo, setIsNegativo] = useState(false);

  React.useEffect(() => {
    if (!aberto) return;
    if (marcoAtual) {
      setDate(marcoAtual.isoDate);
      const abs = Math.abs(marcoAtual.saldoMinutos);
      setSaldoHh(Math.floor(abs / 60));
      setSaldoMm(abs % 60);
      setIsNegativo(marcoAtual.saldoMinutos < 0);
    } else {
      setDate(nowLocalDateTime().date);
      setSaldoHh(0);
      setSaldoMm(0);
      setIsNegativo(false);
    }
  }, [aberto, marcoAtual]);

  const salvar = () => {
    const minutos = (Number(saldoHh) || 0) * 60 + (Number(saldoMm) || 0);
    aoSalvar({
      isoDate: date,
      saldoMinutos: isNegativo ? -minutos : minutos,
    });
  };

  return (
    <ModalBase aberto={aberto} aoFechar={aoFechar}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
            Marco Zero
          </div>
          <div className="mt-1 text-lg font-semibold">Reset de Contagem</div>
        </div>

        <button
          onClick={aoFechar}
          className="rounded-2xl border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          Fechar
        </button>
      </div>

      <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--card2)' }}>
        <div className="text-xs" style={{ color: 'var(--muted2)' }}>
          A contagem de saldo vai começar a partir dessa data, ignorando dias anteriores.
        </div>
      </div>

      <div className="mt-3">
        <div className="text-xs" style={{ color: 'var(--muted2)' }}>
          Data inicial
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
        />
      </div>

      <div className="mt-3">
        <div className="text-xs" style={{ color: 'var(--muted2)' }}>
          Saldo inicial (opcional)
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            onClick={() => setIsNegativo(false)}
            className="rounded-2xl border px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--border)',
              background: !isNegativo ? 'var(--accent)' : 'var(--card)',
              color: !isNegativo ? 'var(--accentText)' : 'var(--text)',
            }}
          >
            + Crédito
          </button>
          <button
            onClick={() => setIsNegativo(true)}
            className="rounded-2xl border px-3 py-2 text-sm"
            style={{
              borderColor: 'var(--border)',
              background: isNegativo ? 'var(--accent)' : 'var(--card)',
              color: isNegativo ? 'var(--accentText)' : 'var(--text)',
            }}
          >
            - Débito
          </button>
          <div className="hidden sm:block" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            value={saldoHh}
            onChange={(e) => setSaldoHh(Number(e.target.value))}
            className="rounded-2xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
            placeholder="Horas"
          />
          <input
            type="number"
            min={0}
            max={59}
            value={saldoMm}
            onChange={(e) => setSaldoMm(Number(e.target.value))}
            className="rounded-2xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
            placeholder="Min"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={aoFechar}
          className="rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          Cancelar
        </button>

        <button
          onClick={salvar}
          className="rounded-2xl px-4 py-3 text-sm font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--accentText)' }}
        >
          Salvar Marco
        </button>
      </div>
    </ModalBase>
  );
}


