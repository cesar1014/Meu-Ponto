'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePonto } from '@/contexts/PontoContext';
import { useAuth } from '@/contexts/AuthContext';
import { THEMES } from '@/lib/themes';
import type { Config, DailyTargets } from '@/lib/pontoStore';
import { calcSaldo2026, DEFAULT_CONFIG, formatarMinutos, saveAjustes, saveConfig, savePontos } from '@/lib/pontoStore';
import { createBackup, restoreBackup } from '@/lib/backup';
import { gerarRelatorioPDF } from '@/lib/relatorioPdf';
import { gerarRelatorioCSV, gerarRelatorioExcel } from '@/lib/relatorioExport';
import type { StorageScope } from '@/lib/storage';
import {
  ChevronLeft,
  Briefcase,
  Bell,
  Palette,
  Database,
  RotateCcw,
  Sun,
  Moon,
  Edit,
  FileDown,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { AjustesRetroativosView } from './AjustesRetroativosView';

// === Utility Functions ===
function splitMinutes(total: number) {
  const safe = Number.isFinite(total) && total > 0 ? Math.round(total) : 0;
  return { h: Math.floor(safe / 60), m: safe % 60 };
}

function toMinutes(h: number, m: number) {
  const hh = Number.isFinite(h) && h >= 0 ? Math.floor(h) : 0;
  const mm = Number.isFinite(m) && m >= 0 ? Math.floor(m) : 0;
  return hh * 60 + Math.min(59, mm);
}

// === Types ===
type SettingsView = 'main' | 'jornada' | 'notificacoes' | 'temas' | 'temas-lista' | 'backup' | 'reset' | 'ajustes' | 'export';

// === Individual View Components ===

function SettingsButton({
  icon,
  label,
  description,
  onClick,
  disabled = false,
  variant = 'default'
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}) {
  return (
    <button
      onClick={() => {
        void onClick();
      }}
      disabled={disabled}
      className="w-full rounded-2xl border p-4 text-left transition-all active:scale-[0.98] disabled:opacity-50"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--card)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-xl"
          style={{
            background: variant === 'danger' ? 'rgba(239,68,68,0.15)' : 'var(--card2)',
            color: variant === 'danger' ? 'var(--neg)' : 'var(--accent)'
          }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-semibold" style={{ color: variant === 'danger' ? 'var(--neg)' : 'var(--text)' }}>
            {label}
          </div>
          {description && (
            <div className="text-xs mt-0.5" style={{ color: 'var(--muted2)' }}>
              {description}
            </div>
          )}
        </div>
        <ChevronLeft className="w-4 h-4 rotate-180 opacity-50" />
      </div>
    </button>
  );
}

function BackButton({ onClick, label = 'Voltar' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-sm font-medium mb-4 hover:opacity-80 transition"
      style={{ color: 'var(--accent)' }}
    >
      <ChevronLeft className="w-4 h-4" />
      {label}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  disabled = false
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="relative w-11 h-6 rounded-full transition-all duration-200"
      style={{
        background: checked ? 'var(--accent)' : 'var(--card2)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      <div
        className="absolute top-1 w-4 h-4 rounded-full transition-all duration-200"
        style={{
          background: checked ? 'var(--accentText)' : 'var(--muted)',
          left: checked ? '24px' : '4px'
        }}
      />
    </button>
  );
}

function JornadaDayInput({
  day,
  minutes,
  onChange,
}: {
  day: { key: keyof DailyTargets; label: string };
  minutes: number;
  onChange: (day: keyof DailyTargets, h: number, m: number) => void;
}) {
  const split = splitMinutes(minutes ?? 0);
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--card2)' }}>
      <div className="text-xs font-semibold" style={{ color: 'var(--muted2)' }}>
        {day.label}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={24}
          value={split.h}
          onChange={(e) => onChange(day.key, Math.max(0, Number(e.target.value)), split.m)}
          className="w-14 rounded-xl border px-2 py-1 text-center text-sm outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
        />
        <span className="text-xs" style={{ color: 'var(--muted2)' }}>h</span>
        <input
          type="number"
          min={0}
          max={59}
          value={split.m}
          onChange={(e) => onChange(day.key, split.h, Math.max(0, Math.min(59, Number(e.target.value))))}
          className="w-14 rounded-xl border px-2 py-1 text-center text-sm outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
        />
        <span className="text-xs" style={{ color: 'var(--muted2)' }}>min</span>
      </div>
    </div>
  );
}

// === Jornada View ===
function JornadaView({
  config,
  setConfig,
  onBack
}: {
  config: Config;
  setConfig: (c: Config) => void;
  onBack: () => void;
}) {
  const sumWeeklyTargets = (targets: DailyTargets, weekendEnabled: boolean) => {
    let total = (targets.mon ?? 0) + (targets.tue ?? 0) + (targets.wed ?? 0) + (targets.thu ?? 0) + (targets.fri ?? 0);
    if (weekendEnabled) {
      total += (targets.sat ?? 0) + (targets.sun ?? 0);
    }
    return total;
  };

  const weekdays: { key: keyof DailyTargets; label: string }[] = [
    { key: 'mon', label: 'Segunda' },
    { key: 'tue', label: 'Terça' },
    { key: 'wed', label: 'Quarta' },
    { key: 'thu', label: 'Quinta' },
    { key: 'fri', label: 'Sexta' },
  ];

  const weekendDays: { key: keyof DailyTargets; label: string }[] = [
    { key: 'sat', label: 'Sábado' },
    { key: 'sun', label: 'Domingo' },
  ];

  // Calculate weekly total in real-time
  const weeklyTotal = useMemo(() => {
    return sumWeeklyTargets(config.dailyTargets, config.weekendEnabled);
  }, [config.dailyTargets, config.weekendEnabled]);

  const [weeklyDraft, setWeeklyDraft] = useState(() => weeklyTotal);

  useEffect(() => {
    setWeeklyDraft(weeklyTotal);
  }, [weeklyTotal]);

  const updateDaily = (day: keyof DailyTargets, h: number, m: number) => {
    const minutes = toMinutes(h, m);
    const nextDaily = { ...config.dailyTargets, [day]: minutes };
    setConfig({
      ...config,
      dailyTargets: nextDaily,
      weeklyTargetMinutes: sumWeeklyTargets(nextDaily, config.weekendEnabled),
    });
  };

  const toggleWeekend = (enabled: boolean) => {
    const nextDaily = enabled
      ? config.dailyTargets
      : { ...config.dailyTargets, sat: 0, sun: 0 };
    setConfig({
      ...config,
      weekendEnabled: enabled,
      dailyTargets: nextDaily,
      weeklyTargetMinutes: sumWeeklyTargets(nextDaily, enabled),
    });
  };

  const distributeWeekly = () => {
    const total = Number.isFinite(weeklyDraft) && weeklyDraft > 0 ? Math.round(weeklyDraft) : 0;
    const days: (keyof DailyTargets)[] = config.weekendEnabled
      ? ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
      : ['mon', 'tue', 'wed', 'thu', 'fri'];
    const base = days.length > 0 ? Math.floor(total / days.length) : 0;
    let remainder = days.length > 0 ? total % days.length : 0;
    const nextDaily: DailyTargets = { ...config.dailyTargets };

    for (const day of days) {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      nextDaily[day] = base + extra;
    }

    if (!config.weekendEnabled) {
      nextDaily.sat = 0;
      nextDaily.sun = 0;
    }

    setConfig({
      ...config,
      dailyTargets: nextDaily,
      weeklyTargetMinutes: total,
    });
  };

  const handleSave = () => {
    setConfig({
      ...config,
      jornadaConfigurada: true,
      weeklyTargetMinutes: weeklyTotal,
    });
    onBack();
  };

  const weeklySplit = splitMinutes(weeklyTotal);
  const weeklyDraftSplit = splitMinutes(weeklyDraft);
  const weeklyTotalLabel = weeklySplit.m > 0 ? `${weeklySplit.h}h ${weeklySplit.m}min` : `${weeklySplit.h}h`;

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />

      <div>
        <div className="text-lg font-bold">Jornada de Trabalho</div>
        <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>
          Configure as horas de trabalho para cada dia
        </div>
      </div>

      {/* Weekly Total / Distribution */}
      <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--accent)', color: 'var(--accentText)' }}>
        <div className="text-xs font-medium opacity-80">Total Semanal</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            max={168}
            value={weeklyDraftSplit.h}
            onChange={(e) => setWeeklyDraft(toMinutes(Math.max(0, Number(e.target.value)), weeklyDraftSplit.m))}
            className="w-16 rounded-xl border px-2 py-1 text-center text-sm outline-none"
            style={{ borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.1)', color: 'var(--accentText)' }}
          />
          <span className="text-xs opacity-90">h</span>
          <input
            type="number"
            min={0}
            max={59}
            value={weeklyDraftSplit.m}
            onChange={(e) => setWeeklyDraft(toMinutes(weeklyDraftSplit.h, Math.max(0, Math.min(59, Number(e.target.value)))))}
            className="w-16 rounded-xl border px-2 py-1 text-center text-sm outline-none"
            style={{ borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(0,0,0,0.1)', color: 'var(--accentText)' }}
          />
          <span className="text-xs opacity-90">min</span>
          <button
            onClick={distributeWeekly}
            disabled={weeklyDraft <= 0}
            className="ml-auto rounded-xl px-3 py-2 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-60"
            style={{ background: 'rgba(255,255,255,0.18)', color: 'var(--accentText)' }}
          >
            Distribuir
          </button>
        </div>
        <div className="text-xs opacity-80 mt-2">Soma atual dos dias: {weeklyTotalLabel}</div>
        <div className="text-[10px] opacity-80 mt-1">
          {config.weekendEnabled ? 'Inclui sábado e domingo' : 'Somente dias úteis'}
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid gap-3 sm:grid-cols-2">
        {weekdays.map((day) => (
          <JornadaDayInput
            key={day.key}
            day={day}
            minutes={config.dailyTargets[day.key] ?? 0}
            onChange={updateDaily}
          />
        ))}
      </div>

      {/* Weekend Toggle */}
      <div
        className="rounded-2xl border p-4 flex items-center justify-between"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        <div>
          <div className="font-semibold text-sm">Ativar fim de semana</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--muted2)' }}>
            Incluir sábado e domingo na jornada
          </div>
        </div>
        <Toggle checked={config.weekendEnabled} onChange={toggleWeekend} />
      </div>

      {/* Weekend Days (when enabled) */}
      {config.weekendEnabled && (
        <div className="grid gap-3 sm:grid-cols-2">
          {weekendDays.map((day) => (
            <JornadaDayInput
              key={day.key}
              day={day}
              minutes={config.dailyTargets[day.key] ?? 0}
              onChange={updateDaily}
            />
          ))}
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full rounded-2xl p-4 text-center font-bold transition active:scale-[0.98]"
        style={{ background: 'var(--accent)', color: 'var(--accentText)' }}
      >
        Salvar Jornada
      </button>
    </div>
  );
}

// === Notificações View ===
function NotificacoesView({
  config,
  setConfig,
  onBack
}: {
  config: Config;
  setConfig: (c: Config) => void;
  onBack: () => void;
}) {
  const notifications = [
    {
      key: 'notificacoes' as const,
      label: 'Lembrar de bater ponto',
      description: 'Receba lembretes para registrar entrada e saída'
    },
    {
      key: 'alertaAlmoco' as const,
      label: 'Alerta de almoço',
      description: 'Aviso quando o horário de almoço estiver próximo'
    },
    {
      key: 'alertaHoraExtra' as const,
      label: 'Alerta de hora extra',
      description: 'Notificação ao ultrapassar a jornada diária'
    },
  ];

  const generalEnabled = config.notificacoes || config.alertaAlmoco || config.alertaHoraExtra;

  const toggleAll = (enabled: boolean) => {
    setConfig({
      ...config,
      notificacoes: enabled,
      alertaAlmoco: enabled,
      alertaHoraExtra: enabled,
    });
  };

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />

      <div>
        <div className="text-lg font-bold">Notificações</div>
        <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>
          Configure lembretes e alertas
        </div>
      </div>

      {/* General Toggles */}
      <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Notificações (geral)</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--muted2)' }}>
              Ativar ou desativar todas as notificações
            </div>
          </div>
          <Toggle checked={generalEnabled} onChange={toggleAll} />
        </div>

        <div className="border-t" style={{ borderColor: 'var(--border)' }} />

        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Alarmes (geral)</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--muted2)' }}>
              Sons e alertas sonoros
            </div>
          </div>
          <Toggle
            checked={config.alarmesGeral}
            onChange={(v) => setConfig({ ...config, alarmesGeral: v })}
          />
        </div>
      </div>

      {/* Individual Notifications */}
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
        Notificações individuais
      </div>

      <div className="space-y-3">
        {notifications.map((notif) => (
          <div
            key={notif.key}
            className="rounded-2xl border p-4 flex items-center justify-between"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--card)',
              opacity: generalEnabled ? 1 : 0.5
            }}
          >
            <div>
              <div className="font-semibold text-sm">{notif.label}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted2)' }}>
                {notif.description}
              </div>
            </div>
            <Toggle
              checked={config[notif.key]}
              onChange={(v) => setConfig({ ...config, [notif.key]: v })}
              disabled={!generalEnabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// === Temas View ===
function TemasView({
  onSelectMode,
  onBack
}: {
  onSelectMode: (mode: 'light' | 'dark') => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />

      <div>
        <div className="text-lg font-bold">Temas</div>
        <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>
          Escolha o modo de aparência
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onSelectMode('light')}
          className="rounded-2xl border p-6 flex flex-col items-center gap-3 transition-all active:scale-[0.98]"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: '#f5f5f7' }}
          >
            <Sun className="w-8 h-8" style={{ color: '#f59e0b' }} />
          </div>
          <div className="font-semibold">Claro</div>
        </button>

        <button
          onClick={() => onSelectMode('dark')}
          className="rounded-2xl border p-6 flex flex-col items-center gap-3 transition-all active:scale-[0.98]"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: '#1a1a2e' }}
          >
            <Moon className="w-8 h-8" style={{ color: '#a78bfa' }} />
          </div>
          <div className="font-semibold">Escuro</div>
        </button>
      </div>
    </div>
  );
}

// === Temas Lista View ===
function TemasListaView({
  mode,
  config,
  setConfig,
  onBack
}: {
  mode: 'light' | 'dark';
  config: Config;
  setConfig: (c: Config) => void;
  onBack: () => void;
}) {
  const filteredThemes = THEMES.filter(t =>
    mode === 'light' ? t.id.endsWith('Light') : !t.id.endsWith('Light')
  );

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} label={mode === 'light' ? 'Voltar (Claro)' : 'Voltar (Escuro)'} />

      <div>
        <div className="text-lg font-bold">Temas {mode === 'light' ? 'Claros' : 'Escuros'}</div>
        <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>
          Selecione um tema para aplicar
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filteredThemes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setConfig({ ...config, themeId: theme.id as Config['themeId'] })}
            className="rounded-2xl border p-4 flex items-center gap-3 transition-all active:scale-[0.98]"
            style={{
              borderColor: config.themeId === theme.id ? 'var(--accent)' : 'var(--border)',
              background: config.themeId === theme.id ? 'var(--accent)' : 'var(--card)',
              color: config.themeId === theme.id ? 'var(--accentText)' : 'var(--text)'
            }}
          >
            <div
              className="w-10 h-10 rounded-xl border"
              style={{
                background: theme.vars['--bg'],
                borderColor: theme.vars['--border']
              }}
            >
              <div
                className="w-full h-full rounded-xl flex items-center justify-center text-xs font-bold"
                style={{ color: theme.vars['--accent'] }}
              >
                Aa
              </div>
            </div>
            <div className="font-semibold text-sm">{theme.nome}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// === Backup View ===
function BackupView({
  onBack,
  scope
}: {
  onBack: () => void;
  scope: StorageScope;
}) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleExport = () => {
    try {
      const data = createBackup(scope);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pontoapp-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('success');
      setMessage('Backup exportado com sucesso!');
    } catch {
      setStatus('error');
      setMessage('Erro ao exportar backup');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = restoreBackup(scope, reader.result as string);
        if (result.ok) {
          setStatus('success');
          setMessage('Backup restaurado! Recarregue a página.');
        } else {
          setStatus('error');
          setMessage(result.error ?? 'Arquivo inválido');
        }
      } catch {
        setStatus('error');
        setMessage('Erro ao restaurar backup');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />

      <div>
        <div className="text-lg font-bold">Backup</div>
        <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>
          Exporte ou importe seus dados
        </div>
      </div>

      {status !== 'idle' && (
        <div
          className="rounded-2xl p-3 text-sm"
          style={{
            background: status === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: status === 'success' ? 'var(--pos)' : 'var(--neg)'
          }}
        >
          {message}
        </div>
      )}

      <button
        onClick={handleExport}
        className="w-full rounded-2xl border p-4 font-semibold transition active:scale-[0.98]"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        Exportar Backup
      </button>

      <label
        className="block w-full rounded-2xl border p-4 text-center font-semibold cursor-pointer transition active:scale-[0.98]"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        Importar Backup
        <input type="file" accept=".json" onChange={handleImport} className="hidden" />
      </label>
    </div>
  );
}

// === Export View ===
function ExportView({
  onBack,
  onPdf,
  onExcel,
  onCsv,
  status,
  message
}: {
  onBack: () => void;
  onPdf: () => void | Promise<void>;
  onExcel: () => void | Promise<void>;
  onCsv: () => void | Promise<void>;
  status: 'idle' | 'success' | 'error';
  message: string;
}) {
  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />

      <div>
        <div className="text-lg font-bold">Exportar dados</div>
        <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>
          Escolha o formato de download
        </div>
      </div>

      <div className="space-y-3">
        <SettingsButton
          icon={<FileDown className="w-5 h-5" />}
          label="PDF"
          description="Relatório completo"
          onClick={onPdf}
        />
        <SettingsButton
          icon={<FileSpreadsheet className="w-5 h-5" />}
          label="Excel"
          description="Planilha .xlsx"
          onClick={onExcel}
        />
        <SettingsButton
          icon={<FileText className="w-5 h-5" />}
          label="CSV"
          description="Arquivo de dados"
          onClick={onCsv}
        />
      </div>

      {status !== 'idle' && (
        <div
          className="rounded-2xl p-3 text-sm"
          style={{
            background: status === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: status === 'success' ? 'var(--pos)' : 'var(--neg)'
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}

// === Reset View ===
function ResetView({
  onBack,
  onReset,
  scope
}: {
  onBack: () => void;
  onReset: () => void;
  scope: StorageScope;
}) {
  const [confirmed, setConfirmed] = useState(false);

  const handleReset = () => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }

    // Reset all data
    saveConfig(scope, DEFAULT_CONFIG);
    savePontos(scope, []);
    saveAjustes(scope, []);
    onReset();
  };

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />

      <div>
        <div className="text-lg font-bold" style={{ color: 'var(--neg)' }}>Resetar Tudo</div>
        <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>
          Apagar todos os dados do app
        </div>
      </div>

      <div
        className="rounded-2xl p-4 text-sm"
        style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--neg)' }}
      >
        ?? Esta ação é irreversível! Todos os seus registros de ponto, configurações e ajustes serão perdidos permanentemente.
      </div>

      {confirmed && (
        <div
          className="rounded-2xl p-4 text-sm font-medium"
          style={{ background: 'rgba(239,68,68,0.25)', color: 'var(--neg)' }}
        >
          Clique novamente para confirmar a exclusão
        </div>
      )}

      <button
        onClick={handleReset}
        className="w-full rounded-2xl p-4 font-bold transition active:scale-[0.98]"
        style={{ background: 'var(--neg)', color: 'white' }}
      >
        {confirmed ? 'Confirmar Reset' : 'Resetar Tudo'}
      </button>
    </div>
  );
}

// === Main ConfigView ===
export function ConfigView({ onClose }: { onClose?: () => void }) {
  const { config, setConfig, pontos, ajustes } = usePonto();
  const { signOut, user, isGuest, profile } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<SettingsView>(() => (config.jornadaConfigurada ? 'main' : 'jornada'));
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [exportMessage, setExportMessage] = useState('');
  const scope = useMemo<StorageScope>(
    () => ({ userId: user?.id ?? undefined, isGuest }),
    [user?.id, isGuest]
  );

  // First use: only show Jornada if not configured
  const isFirstUse = !config.jornadaConfigurada;

  const handleThemeMode = (mode: 'light' | 'dark') => {
    setThemeMode(mode);
    setView('temas-lista');
  };

  const handleExportPdf = () => {
    try {
      const { saldoMinutos } = calcSaldo2026(pontos, ajustes, config.marco, config);
      const saldoLabel = formatarMinutos(saldoMinutos);
      const userName =
        profile?.nome ||
        (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name ||
        (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.name ||
        user?.email ||
        (isGuest ? 'Visitante' : undefined);
      gerarRelatorioPDF(pontos, ajustes, saldoLabel, config, userName);
      setExportStatus('success');
      setExportMessage('PDF gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar PDF', err);
      setExportStatus('error');
      setExportMessage('Erro ao gerar o PDF');
    }
  };

  const handleExportCsv = () => {
    try {
      const { saldoMinutos } = calcSaldo2026(pontos, ajustes, config.marco, config);
      const saldoLabel = formatarMinutos(saldoMinutos);
      gerarRelatorioCSV(pontos, ajustes, saldoLabel, config);
      setExportStatus('success');
      setExportMessage('CSV gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar CSV', err);
      setExportStatus('error');
      setExportMessage('Erro ao gerar o CSV');
    }
  };

  const handleExportExcel = async () => {
    try {
      const { saldoMinutos } = calcSaldo2026(pontos, ajustes, config.marco, config);
      const saldoLabel = formatarMinutos(saldoMinutos);
      await gerarRelatorioExcel(pontos, ajustes, saldoLabel, config);
      setExportStatus('success');
      setExportMessage('Excel gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar Excel', err);
      setExportStatus('error');
      setExportMessage('Erro ao gerar o Excel');
    }
  };

  // Main settings view
  if (view === 'main') {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
              Ajustes
            </div>
            <div className="mt-1 text-lg font-semibold">Configurações</div>
            {isFirstUse && (
              <div className="mt-1 text-xs" style={{ color: 'var(--accent)' }}>
                Configure sua jornada para começar
              </div>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-2xl border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
              Fechar
            </button>
          )}
        </div>

        <div className="space-y-3">
          {/* Always show Jornada */}
          <SettingsButton
            icon={<Briefcase className="w-5 h-5" />}
            label="Jornada de trabalho"
            description={isFirstUse ? "Configure para desbloquear outras opções" : "Defina suas horas diárias"}
            onClick={() => setView('jornada')}
          />

          {/* Only show other options after first use */}
          {!isFirstUse && (
            <>
              <SettingsButton
                icon={<Bell className="w-5 h-5" />}
                label="Notificações"
                description="Lembretes e alertas"
                onClick={() => setView('notificacoes')}
              />

              <SettingsButton
                icon={<Edit className="w-5 h-5" />}
                label="Ajustes Retroativos"
                description="Editar pontos e horas de dias passados"
                onClick={() => setView('ajustes')}
              />

              <SettingsButton
                icon={<Palette className="w-5 h-5" />}
                label="Temas"
                description="Personalize a aparência"
                onClick={() => setView('temas')}
              />

              <SettingsButton
                icon={<Database className="w-5 h-5" />}
                label="Backup"
                description="Exporte ou importe dados"
                onClick={() => setView('backup')}
              />

              <SettingsButton
                icon={<FileDown className="w-5 h-5" />}
                label="Exportar dados"
                description="PDF, Excel e CSV"
                onClick={() => setView('export')}
              />

              <SettingsButton
                icon={<RotateCcw className="w-5 h-5" />}
                label="Resetar tudo"
                description="Apagar todos os dados"
                onClick={() => setView('reset')}
                variant="danger"
              />
            </>
          )}
        </div>

        {/* User session */}
        {user && !isFirstUse && (
          <div className="rounded-2xl border p-3 mt-6" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Sessão</div>
                <div className="mt-1 text-xs" style={{ color: 'var(--muted2)' }}>
                  Encerre a sessão do usuário logado
                </div>
              </div>
              <button
                onClick={() => {
                  onClose?.();
                  router.replace('/login');
                  void signOut();
                }}
                className="rounded-2xl border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: 'var(--border)', background: 'var(--card2)' }}
              >
                Sair
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sub-views
  if (view === 'jornada') {
    return <JornadaView config={config} setConfig={setConfig} onBack={() => setView('main')} />;
  }

  if (view === 'notificacoes') {
    return <NotificacoesView config={config} setConfig={setConfig} onBack={() => setView('main')} />;
  }

  if (view === 'temas') {
    return <TemasView onSelectMode={handleThemeMode} onBack={() => setView('main')} />;
  }

  if (view === 'temas-lista') {
    return <TemasListaView mode={themeMode} config={config} setConfig={setConfig} onBack={() => setView('temas')} />;
  }

  if (view === 'backup') {
    return <BackupView onBack={() => setView('main')} scope={scope} />;
  }

  if (view === 'export') {
    return (
      <ExportView
        onBack={() => setView('main')}
        onPdf={handleExportPdf}
        onExcel={handleExportExcel}
        onCsv={handleExportCsv}
        status={exportStatus}
        message={exportMessage}
      />
    );
  }

  if (view === 'reset') {
    return <ResetView onBack={() => setView('main')} onReset={() => window.location.reload()} scope={scope} />;
  }

  if (view === 'ajustes') {
    return <AjustesRetroativosView onBack={() => setView('main')} />;
  }

  return null;
}

