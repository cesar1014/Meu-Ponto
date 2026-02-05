?'use client';

import React, { useState, useMemo } from 'react';
import { usePonto } from '@/contexts/PontoContext';
import { ChevronLeft, Calendar, Clock, Plus, Minus, History, AlertTriangle } from 'lucide-react';
import {
    id as genId,
    Ponto,
    TipoPonto,
    LABEL_TIPOS,
    AjusteBanco,
    diffPontos,
    workedMinutesFromPunches,
    metaMinutosDoDia,
    formatarMinutosSemSinal,
} from '@/lib/pontoStore';
import { dateKeyLocal, parseISODate, toDateKey } from '@/lib/dates';
import { normalizeTimeValue } from '@/lib/timeInput';
import { TimeField } from './TimeField';

type AjustesTab = 'pontos' | 'horas' | 'historico';

function parseTimeToDate(dateISO: string, time: string): Date {
    const normalized = normalizeTimeValue(time) ?? '00:00';
    const [h, m] = normalized.split(':').map(Number);
    const d = parseISODate(dateISO);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
}

function formatTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDate(isoDate: string): string {
    const d = parseISODate(isoDate);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

// === Back Button ===
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

// === Tab Button ===
function TabButton({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition"
            style={{
                background: active ? 'var(--accent)' : 'var(--card2)',
                color: active ? 'var(--accentText)' : 'var(--text)',
            }}
        >
            {icon}
            {label}
        </button>
    );
}

// === Pontos Tab ===
function PontosTab({
    selectedDate,
    pontosDoDia,
    onSave,
}: {
    selectedDate: string;
    pontosDoDia: Ponto[];
    onSave: (pontos: Ponto[], justificativa: string) => void;
}) {
    const [entries, setEntries] = useState<{ tipo: TipoPonto; time: string }[]>(() =>
        pontosDoDia.length > 0
            ? pontosDoDia.map((p) => ({ tipo: p.tipo, time: formatTime(new Date(p.atISO)) }))
            : [
                { tipo: 'ENTRADA' as TipoPonto, time: '08:00' },
                { tipo: 'SAIDA_ALMOCO' as TipoPonto, time: '12:00' },
                { tipo: 'VOLTA_ALMOCO' as TipoPonto, time: '13:00' },
                { tipo: 'SAIDA' as TipoPonto, time: '17:00' },
            ]
    );
    const [justificativa, setJustificativa] = useState('');
    const [error, setError] = useState<string | null>(null);

    const updateEntry = (index: number, field: 'tipo' | 'time', value: string) => {
        const updated = [...entries];
        if (field === 'tipo') {
            updated[index] = { ...updated[index], tipo: value as TipoPonto };
        } else {
            updated[index] = { ...updated[index], time: value };
        }
        setEntries(updated);
    };

    const addEntry = () => {
        setEntries([...entries, { tipo: 'OUTRO', time: '12:00' }]);
    };

    const removeEntry = (index: number) => {
        if (entries.length > 1) {
            setEntries(entries.filter((_, i) => i !== index));
        }
    };

    const handleSave = () => {
        setError(null);

        if (!justificativa.trim()) {
            setError('Justificativa é obrigatória.');
            return;
        }

        if (justificativa.trim().length < 5) {
            setError('Justificativa deve ter pelo menos 5 caracteres.');
            return;
        }

        // Convert entries to Ponto objects
        const novos: Ponto[] = entries.map((e) => ({
            id: genId(),
            atISO: parseTimeToDate(selectedDate, e.time).toISOString(),
            tipo: e.tipo,
        }));

        onSave(novos, justificativa.trim());
        setJustificativa('');
    };

    return (
        <div className="space-y-4">
            <div className="text-xs font-medium" style={{ color: 'var(--muted2)' }}>
                Configure os pontos do dia {formatDate(selectedDate)}
            </div>

            <div className="space-y-3">
                {entries.map((entry, idx) => (
                    <div
                        key={idx}
                        className="rounded-2xl border p-3 flex items-center gap-3"
                        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                    >
                        <select
                            value={entry.tipo}
                            onChange={(e) => updateEntry(idx, 'tipo', e.target.value)}
                            className="flex-1 rounded-xl border px-2 py-2 text-sm outline-none"
                            style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                        >
                            {Object.entries(LABEL_TIPOS).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>

                        <TimeField
                            value={entry.time}
                            onChange={(value) => updateEntry(idx, 'time', value)}
                            className="w-24 rounded-xl border px-2 py-2 text-sm text-center outline-none"
                            style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                        />

                        <button
                            onClick={() => removeEntry(idx)}
                            disabled={entries.length === 1}
                            className="p-2 rounded-xl transition disabled:opacity-30"
                            style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--neg)' }}
                        >
                            <Minus className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            <button
                onClick={addEntry}
                className="w-full rounded-2xl border p-3 flex items-center justify-center gap-2 text-sm font-medium transition hover:opacity-80"
                style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--accent)' }}
            >
                <Plus className="w-4 h-4" />
                Adicionar ponto extra
            </button>

            <div className="space-y-2">
                <div className="text-xs font-medium" style={{ color: 'var(--muted2)' }}>
                    Justificativa (obrigatória)
                </div>
                <textarea
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Ex: Esqueci de registrar os pontos do dia..."
                    rows={3}
                    className="w-full rounded-2xl border px-3 py-2 text-sm outline-none resize-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                />
            </div>

            {error && (
                <div
                    className="rounded-2xl p-3 text-sm flex items-center gap-2"
                    style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--neg)' }}
                >
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                </div>
            )}

            <button
                onClick={handleSave}
                className="w-full rounded-2xl p-4 text-center font-bold transition active:scale-[0.98]"
                style={{ background: 'var(--accent)', color: 'var(--accentText)' }}
            >
                Salvar Pontos
            </button>
        </div>
    );
}

// === Horas Tab ===
function HorasTab({
    selectedDate,
    config,
    pontosDoDia,
    onSave,
}: {
    selectedDate: string;
    config: { dailyTargets?: Record<string, number>; weekendEnabled?: boolean };
    pontosDoDia: Ponto[];
    onSave: (ajuste: AjusteBanco) => void;
}) {
    const [tipo, setTipo] = useState<'CREDITO' | 'DEBITO'>('CREDITO');
    const [horas, setHoras] = useState(0);
    const [minutos, setMinutos] = useState(30);
    const [justificativa, setJustificativa] = useState('');
    const [error, setError] = useState<string | null>(null);

    const meta = metaMinutosDoDia(selectedDate, config as Parameters<typeof metaMinutosDoDia>[1]);
    const trabalhado = workedMinutesFromPunches(pontosDoDia);
    const saldoDia = trabalhado - meta;

    const handleSave = () => {
        setError(null);

        if (!justificativa.trim()) {
            setError('Justificativa é obrigatória.');
            return;
        }

        if (justificativa.trim().length < 5) {
            setError('Justificativa deve ter pelo menos 5 caracteres.');
            return;
        }

        const totalMinutos = horas * 60 + minutos;
        if (totalMinutos <= 0) {
            setError('Informe um tempo maior que zero.');
            return;
        }

        if (totalMinutos > 480) {
            setError('Ajuste máximo de 8 horas por operação.');
            return;
        }

        const ajuste: AjusteBanco = {
            id: genId(),
            atISO: new Date().toISOString(),
            tipo,
            minutos: totalMinutos,
            justificativa: `[${selectedDate}] ${justificativa.trim()}`,
        };

        onSave(ajuste);
        setJustificativa('');
        setHoras(0);
        setMinutos(30);
    };

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div
                className="rounded-2xl border p-4"
                style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
                <div className="text-xs font-medium mb-2" style={{ color: 'var(--muted2)' }}>
                    Resumo do dia {formatDate(selectedDate)}
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-lg font-bold">{formatarMinutosSemSinal(meta)}</div>
                        <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                            Meta
                        </div>
                    </div>
                    <div>
                        <div className="text-lg font-bold">{formatarMinutosSemSinal(trabalhado)}</div>
                        <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                            Trabalhado
                        </div>
                    </div>
                    <div>
                        <div
                            className="text-lg font-bold"
                            style={{ color: saldoDia >= 0 ? 'var(--pos)' : 'var(--neg)' }}
                        >
                            {saldoDia >= 0 ? '+' : ''}{formatarMinutosSemSinal(saldoDia)}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                            Saldo
                        </div>
                    </div>
                </div>
            </div>

            {/* Tipo de ajuste */}
            <div className="flex gap-2">
                <button
                    onClick={() => setTipo('CREDITO')}
                    className="flex-1 rounded-2xl p-3 flex items-center justify-center gap-2 font-semibold text-sm transition"
                    style={{
                        background: tipo === 'CREDITO' ? 'rgba(34,197,94,0.2)' : 'var(--card)',
                        color: tipo === 'CREDITO' ? 'var(--pos)' : 'var(--text)',
                        borderWidth: 1,
                        borderColor: tipo === 'CREDITO' ? 'var(--pos)' : 'var(--border)',
                    }}
                >
                    <Plus className="w-4 h-4" />
                    Adicionar horas
                </button>
                <button
                    onClick={() => setTipo('DEBITO')}
                    className="flex-1 rounded-2xl p-3 flex items-center justify-center gap-2 font-semibold text-sm transition"
                    style={{
                        background: tipo === 'DEBITO' ? 'rgba(239,68,68,0.2)' : 'var(--card)',
                        color: tipo === 'DEBITO' ? 'var(--neg)' : 'var(--text)',
                        borderWidth: 1,
                        borderColor: tipo === 'DEBITO' ? 'var(--neg)' : 'var(--border)',
                    }}
                >
                    <Minus className="w-4 h-4" />
                    Remover horas
                </button>
            </div>

            {/* Time input */}
            <div
                className="rounded-2xl border p-4"
                style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
                <div className="text-xs font-medium mb-3" style={{ color: 'var(--muted2)' }}>
                    Tempo a {tipo === 'CREDITO' ? 'adicionar' : 'remover'}
                </div>
                <div className="flex items-center justify-center gap-3">
                    <input
                        type="number"
                        min={0}
                        max={8}
                        value={horas}
                        onChange={(e) => setHoras(Math.max(0, Math.min(8, Number(e.target.value))))}
                        className="w-16 rounded-xl border px-2 py-2 text-center text-lg font-bold outline-none"
                        style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--muted2)' }}>h</span>
                    <input
                        type="number"
                        min={0}
                        max={59}
                        value={minutos}
                        onChange={(e) => setMinutos(Math.max(0, Math.min(59, Number(e.target.value))))}
                        className="w-16 rounded-xl border px-2 py-2 text-center text-lg font-bold outline-none"
                        style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--muted2)' }}>min</span>
                </div>
            </div>

            {/* Justificativa */}
            <div className="space-y-2">
                <div className="text-xs font-medium" style={{ color: 'var(--muted2)' }}>
                    Justificativa (obrigatória)
                </div>
                <textarea
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Ex: Hora extra não registrada no sistema..."
                    rows={3}
                    className="w-full rounded-2xl border px-3 py-2 text-sm outline-none resize-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                />
            </div>

            {error && (
                <div
                    className="rounded-2xl p-3 text-sm flex items-center gap-2"
                    style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--neg)' }}
                >
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                </div>
            )}

            <button
                onClick={handleSave}
                className="w-full rounded-2xl p-4 text-center font-bold transition active:scale-[0.98]"
                style={{ background: 'var(--accent)', color: 'var(--accentText)' }}
            >
                Salvar Ajuste de Horas
            </button>
        </div>
    );
}

// === Historico Tab ===
function HistoricoTab({ ajustes }: { ajustes: AjusteBanco[] }) {
    const sortedAjustes = useMemo(
        () => [...ajustes].sort((a, b) => +new Date(b.atISO) - +new Date(a.atISO)),
        [ajustes]
    );

    if (sortedAjustes.length === 0) {
        return (
            <div
                className="rounded-2xl border p-6 text-center"
                style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <div className="text-sm font-medium" style={{ color: 'var(--muted2)' }}>
                    Nenhum ajuste realizado ainda
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {sortedAjustes.map((ajuste) => (
                <div
                    key={ajuste.id}
                    className="rounded-2xl border p-3"
                    style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div
                            className="text-sm font-semibold"
                            style={{ color: ajuste.tipo === 'CREDITO' ? 'var(--pos)' : 'var(--neg)' }}
                        >
                            {ajuste.tipo === 'CREDITO' ? '+' : '-'} {formatarMinutosSemSinal(ajuste.minutos)}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                            {new Date(ajuste.atISO).toLocaleDateString('pt-BR')}
                        </div>
                    </div>
                    {ajuste.justificativa && (
                        <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                            {ajuste.justificativa}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// === Main Component ===
export function AjustesRetroativosView({ onBack }: { onBack: () => void }) {
    const { pontos, ajustes, config, addPonto, updatePonto, deletePonto, addAjuste } = usePonto();
    const [tab, setTab] = useState<AjustesTab>('pontos');
    const [selectedDate, setSelectedDate] = useState(() => {
        // Default to yesterday
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return toDateKey(d.toISOString());
    });
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const today = dateKeyLocal();

    // Get available dates (past 60 days)
    const availableDates = useMemo(() => {
        const dates: string[] = [];
        const start = new Date();
        start.setDate(start.getDate() - 60);
        for (let i = 0; i < 60; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const key = toDateKey(d.toISOString());
            if (key < today) {
                dates.push(key);
            }
        }
        return dates.reverse();
    }, [today]);

    const pontosDoDia = useMemo(
        () => pontos.filter((p) => toDateKey(p.atISO) === selectedDate),
        [pontos, selectedDate]
    );

    const aplicarPontos = (next: Ponto[]) => {
        const { toAdd, toUpdate, toDelete } = diffPontos(pontos, next);
        toDelete.forEach((id) => deletePonto(id));
        toAdd.forEach((p) => addPonto(p));
        toUpdate.forEach((p) => updatePonto(p));
    };

    const handleSavePontos = (novosPontos: Ponto[], justificativa: string) => {
        // Remove old punches from this day
        const outrosDias = pontos.filter((p) => toDateKey(p.atISO) !== selectedDate);
        const novos = [...outrosDias, ...novosPontos].sort(
            (a, b) => +new Date(b.atISO) - +new Date(a.atISO)
        );
        aplicarPontos(novos);

        // Add to ajustes log (for audit)
        const ajuste: AjusteBanco = {
            id: genId(),
            atISO: new Date().toISOString(),
            tipo: 'CREDITO',
            minutos: 0, // No hour change, just logging
            justificativa: `[PONTOS ${selectedDate}] ${justificativa} - ${novosPontos.length} pontos`,
        };
        addAjuste(ajuste);

        setSuccessMessage('Pontos salvos com sucesso!');
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const handleSaveAjusteHoras = (ajuste: AjusteBanco) => {
        addAjuste(ajuste);
        setSuccessMessage('Ajuste de horas salvo com sucesso!');
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    return (
        <div className="space-y-4">
            <BackButton onClick={onBack} />

            <div>
                <div className="text-lg font-bold">Ajustes Retroativos</div>
                <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>
                    Edite pontos ou horas de dias passados
                </div>
            </div>

            {/* Success message */}
            {successMessage && (
                <div
                    className="rounded-2xl p-3 text-sm"
                    style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--pos)' }}
                >
                    ✓ {successMessage}
                </div>
            )}

            {/* Date selector */}
            <div
                className="rounded-2xl border p-3 flex items-center gap-3"
                style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
                <Calendar className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                >
                    {availableDates.map((date) => (
                        <option key={date} value={date}>
                            {formatDate(date)} ({date})
                        </option>
                    ))}
                </select>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <TabButton
                    active={tab === 'pontos'}
                    onClick={() => setTab('pontos')}
                    icon={<Clock className="w-4 h-4" />}
                    label="Pontos"
                />
                <TabButton
                    active={tab === 'horas'}
                    onClick={() => setTab('horas')}
                    icon={<Plus className="w-4 h-4" />}
                    label="Horas"
                />
                <TabButton
                    active={tab === 'historico'}
                    onClick={() => setTab('historico')}
                    icon={<History className="w-4 h-4" />}
                    label="Histórico"
                />
            </div>

            {/* Tab content */}
            {tab === 'pontos' && (
                <PontosTab
                    selectedDate={selectedDate}
                    pontosDoDia={pontosDoDia}
                    onSave={handleSavePontos}
                />
            )}

            {tab === 'horas' && (
                <HorasTab
                    selectedDate={selectedDate}
                    config={config}
                    pontosDoDia={pontosDoDia}
                    onSave={handleSaveAjusteHoras}
                />
            )}

            {tab === 'historico' && <HistoricoTab ajustes={ajustes} />}
        </div>
    );
}

