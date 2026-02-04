import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Ponto } from '../lib/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HomeDisplayProps {
  pontosHoje: Ponto[];
  metaHoje: number;
  workedHoje: number;
  deltaHoje: number;
  saldoTotal?: number;
  onBater: () => void;
  minutesToHHMM: (m: number) => string;
  now: Date; // Recebe a data atual como prop (client-side)
}

export function HomeDisplay({
  pontosHoje,
  metaHoje,
  workedHoje,
  deltaHoje,
  saldoTotal,
  onBater,
  minutesToHHMM,
  now,
}: HomeDisplayProps) {
  // Pulse animation when a punch is open
  const pontosOrdenados = [...pontosHoje].sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));
  const isWorking = pontosOrdenados.length % 2 !== 0;
  const hasRegistros = pontosOrdenados.length > 0;
  const showNeutralSaldo = !hasRegistros && workedHoje === 0;
  const deltaDisplay = showNeutralSaldo ? 0 : deltaHoje;
  const saldoPrefix = deltaDisplay > 0 ? '+' : deltaDisplay < 0 ? '-' : '';
  const saldoText = `${saldoPrefix}${minutesToHHMM(deltaDisplay)}`;
  const saldoTotalPrefix = saldoTotal !== undefined && saldoTotal !== 0 ? (saldoTotal > 0 ? '+' : '-') : '';
  const saldoTotalText = saldoTotal !== undefined ? `${saldoTotalPrefix}${minutesToHHMM(saldoTotal)}` : '';

  return (
    <div className="flex flex-col items-center justify-start py-4 sm:py-6">
      {saldoTotal !== undefined && (
        <div className="w-full mb-4 sm:mb-6">
          <div
            className="rounded-3xl border p-5"
            style={{
              borderColor: 'var(--border)',
              background: 'linear-gradient(135deg, rgba(255,255,255,.05), rgba(255,255,255,0))',
            }}
          >
            <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
              Saldo atual
            </div>
            <div
              className="mt-1 text-4xl font-bold tracking-tight"
              style={{ color: saldoTotal >= 0 ? 'var(--pos)' : 'var(--neg)' }}
            >
              {saldoTotalText}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>
              Banco de horas acumulado
            </div>
          </div>
        </div>
      )}

      {/* Clock + Main button */}
      <div className="flex w-full flex-col items-center gap-4">
        <div className="text-center relative">
          <div className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--muted2)' }}>
            {format(now, "eeee, d 'de' MMMM", { locale: ptBR })}
          </div>
          <div
            className="text-[clamp(2.6rem,6vw,4.5rem)] font-bold leading-none tracking-tighter tabular-nums text-[var(--text)]"
            style={{ textShadow: '0 0 40px rgba(var(--accent-rgb), 0.1)' }}
          >
            {format(now, 'HH:mm:ss')}
          </div>
          {isWorking && (
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -right-4 top-4 w-3 h-3 rounded-full bg-[var(--pos)] shadow-[0_0_10px_var(--pos)]"
            />
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBater}
          className="group relative flex items-center justify-center rounded-full w-[clamp(9.5rem,18vw,12rem)] h-[clamp(9.5rem,18vw,12rem)] shadow-[0_0_50px_-12px_var(--accent)] transition-all bg-[var(--accent)] text-[var(--accentText)]"
        >
          <div className="absolute inset-0 rounded-full border-2 border-white/20 scale-90 group-hover:scale-95 transition-transform" />
          <div className="flex flex-col items-center gap-2">
            <Plus className="w-12 h-12 stroke-[3]" />
            <span className="text-lg font-bold tracking-tight">Bater Ponto</span>
          </div>
        </motion.button>
      </div>

      {/* Summary cards */}
      <div className="mt-8 sm:mt-10 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="TRABALHADO" value={minutesToHHMM(workedHoje)} />
        <SummaryCard label="META" value={minutesToHHMM(metaHoje)} />
        <SummaryCard
          label="SALDO DO DIA"
          value={saldoText}
          color={showNeutralSaldo ? 'var(--text)' : deltaDisplay >= 0 ? 'var(--pos)' : 'var(--neg)'}
        />
      </div>

      {/* Punch timeline */}
      <div className="mt-8 sm:mt-10 w-full">
        <div className="text-[10px] uppercase tracking-[0.4em] text-center mb-4" style={{ color: 'var(--muted2)' }}>
          PONTOS DE HOJE
        </div>
        <div className="flex justify-center">
          <div
            className="flex flex-wrap items-start justify-center gap-4 sm:gap-6 rounded-2xl border px-6 py-4"
            style={{
              borderColor: 'var(--border)',
              background: 'linear-gradient(135deg, rgba(255,255,255,.04), rgba(255,255,255,0))',
            }}
          >
            {pontosOrdenados.length === 0 ? (
              <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                Nenhum ponto batido ainda
              </div>
            ) : (
              pontosOrdenados.map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-2 animate-in fade-in zoom-in duration-300">
                  <div className="w-3 h-3 rounded-full bg-[var(--pos)] shadow-[0_0_10px_var(--pos)]" />
                  <div className="text-sm font-mono tabular-nums">{format(new Date(p.atISO), 'HH:mm')}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-3 flex flex-col items-center justify-center text-center">
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">{label}</span>
      <span className="text-lg font-bold tabular-nums" style={{ color: color || 'var(--text)' }}>
        {value}
      </span>
    </div>
  );
}
