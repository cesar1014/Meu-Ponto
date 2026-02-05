'use client';

import React, { useState, useEffect } from 'react';
import { HeartPulse, Trash2 } from 'lucide-react';
import { ModalBase } from './ModalBase';
import { TimeField } from './TimeField';
import { Ponto, TipoPonto } from '../lib/types';
import { AjusteBanco } from '../lib/pontoStore';
import { uid } from '../lib/utils';
import { normalizeTimeValue } from '@/lib/timeInput';

// Helper to get current local date/time
function nowLocalDateTime() {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
        date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
}

// Helper to get date key from ISO string
function toDateKey(iso: string) {
    return iso.slice(0, 10);
}

const LABEL_TIPOS: Record<TipoPonto, string> = {
    ENTRADA: 'Entrada',
    SAIDA_ALMOCO: 'SaÃ­da almoÃ§o',
    VOLTA_ALMOCO: 'Volta almoÃ§o',
    SAIDA: 'SaÃ­da',
    OUTRO: 'Outro',
};

export interface ModalNovoAjusteProps {
    aberto: boolean;
    aoFechar: () => void;
    aoSalvar: (a: AjusteBanco) => void;
    aoSalvarPontos?: (pontos: Ponto[], date: string) => void;
    initialDate?: string;
    pontosExistentes?: Ponto[];
}

export function ModalNovoAjuste({
    aberto,
    aoFechar,
    aoSalvar,
    aoSalvarPontos,
    initialDate,
    pontosExistentes = [],
}: ModalNovoAjusteProps) {
    const [modo, setModo] = useState<'horas' | 'pontos'>('horas');
    const [tipo, setTipo] = useState<'CREDITO' | 'DEBITO' | 'ATESTADO'>('CREDITO');
    const [hh, setHh] = useState(0);
    const [mm, setMm] = useState(0);
    const [just, setJust] = useState('');
    const [date, setDate] = useState(initialDate ?? nowLocalDateTime().date);
    const [time, setTime] = useState(nowLocalDateTime().time);
    const [erro, setErro] = useState('');

    // State for pontos insertion
    const TIPOS_PONTO: TipoPonto[] = ['ENTRADA', 'SAIDA_ALMOCO', 'VOLTA_ALMOCO', 'SAIDA'];
    const [pontoEntradas, setPontoEntradas] = useState<Record<TipoPonto, string>>({
        ENTRADA: '08:00',
        SAIDA_ALMOCO: '12:00',
        VOLTA_ALMOCO: '13:00',
        SAIDA: '17:00',
        OUTRO: '',
    });
    const [pontosExtras, setPontosExtras] = useState<{ tipo: TipoPonto; time: string }[]>([]);

    useEffect(() => {
        if (!aberto) return;
        const cur = nowLocalDateTime();
        setModo('horas');
        setTipo('CREDITO');
        setHh(0);
        setMm(0);
        setJust('');
        setDate(initialDate ?? cur.date);
        setTime(cur.time);
        setErro('');

        // Reset pontos
        setPontoEntradas({
            ENTRADA: '08:00',
            SAIDA_ALMOCO: '12:00',
            VOLTA_ALMOCO: '13:00',
            SAIDA: '17:00',
            OUTRO: '',
        });
        setPontosExtras([]);
    }, [aberto, initialDate]);

    // When date changes in pontos mode, load existing punches
    useEffect(() => {
        if (modo === 'pontos' && date) {
            const pontosDia = pontosExistentes
                .filter((p) => toDateKey(p.atISO) === date)
                .sort((a, b) => +new Date(a.atISO) - +new Date(b.atISO));

            if (pontosDia.length > 0) {
                const newEntradas: Record<TipoPonto, string> = {
                    ENTRADA: '',
                    SAIDA_ALMOCO: '',
                    VOLTA_ALMOCO: '',
                    SAIDA: '',
                    OUTRO: '',
                };
                const extras: { tipo: TipoPonto; time: string }[] = [];

                for (const p of pontosDia) {
                    const timeStr = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(p.atISO));
                    if (TIPOS_PONTO.includes(p.tipo) && !newEntradas[p.tipo]) {
                        newEntradas[p.tipo] = timeStr;
                    } else {
                        extras.push({ tipo: p.tipo, time: timeStr });
                    }
                }

                setPontoEntradas(newEntradas);
                setPontosExtras(extras);
            }
        }
    }, [date, modo, pontosExistentes]);

    const salvarHoras = () => {
        setErro('');

        // For ATESTADO, we don't need hours - it just marks the day as excused
        if (tipo === 'ATESTADO') {
            const at = new Date(`${date}T12:00`);
            if (Number.isNaN(+at)) {
                setErro('Data invÃ¡lida.');
                return;
            }
            aoSalvar({
                id: uid(),
                atISO: at.toISOString(),
                tipo: 'ATESTADO',
                minutos: 0, // 0 minutes for atestado - it just abonates the day
                justificativa: just.trim() || 'Atestado mÃ©dico',
            });
            return;
        }

        const minutos = (Number(hh) || 0) * 60 + (Number(mm) || 0);
        if (minutos <= 0) {
            setErro('Informe uma quantidade > 0.');
            return;
        }
        const normalizedTime = normalizeTimeValue(time);
        if (!normalizedTime) {
            setErro('Hora invÃ¡lida.');
            return;
        }
        const at = new Date(`${date}T${normalizedTime}`);
        if (Number.isNaN(+at)) {
            setErro('Data/hora invÃ¡lida.');
            return;
        }
        aoSalvar({
            id: uid(),
            atISO: at.toISOString(),
            tipo,
            minutos,
            justificativa: just.trim() || undefined,
        });
    };

    const salvarPontos = () => {
        setErro('');
        if (!aoSalvarPontos) {
            setErro('Funcionalidade nÃ£o disponÃ­vel.');
            return;
        }

        const novosPontos: Ponto[] = [];

        // Main punches
        for (const tipoPonto of TIPOS_PONTO) {
            const timeVal = pontoEntradas[tipoPonto];
            if (timeVal) {
                const normalized = normalizeTimeValue(timeVal);
                if (!normalized) continue;
                const at = new Date(`${date}T${normalized}`);
                if (!Number.isNaN(+at)) {
                    novosPontos.push({
                        id: uid(),
                        atISO: at.toISOString(),
                        tipo: tipoPonto,
                    });
                }
            }
        }

        // Extra punches
        for (const extra of pontosExtras) {
            if (extra.time) {
                const normalized = normalizeTimeValue(extra.time);
                if (!normalized) continue;
                const at = new Date(`${date}T${normalized}`);
                if (!Number.isNaN(+at)) {
                    novosPontos.push({
                        id: uid(),
                        atISO: at.toISOString(),
                        tipo: extra.tipo,
                    });
                }
            }
        }

        if (novosPontos.length === 0) {
            setErro('Informe pelo menos um ponto.');
            return;
        }

        aoSalvarPontos(novosPontos, date);
    };

    const addExtra = () => {
        setPontosExtras([...pontosExtras, { tipo: 'OUTRO', time: '12:00' }]);
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

    return (
        <ModalBase aberto={aberto} aoFechar={aoFechar}>
            <div className="flex items-start justify-between">
                <div>
                    <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                        Ajuste manual
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                        {modo === 'horas' ? (tipo === 'ATESTADO' ? 'Atestado MÃ©dico' : 'CrÃ©dito / DÃ©bito') : 'Inserir Pontos'}
                    </div>
                </div>

                <button
                    onClick={aoFechar}
                    className="rounded-2xl border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                >
                    Fechar
                </button>
            </div>

            {/* Mode Toggle */}
            <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                    onClick={() => setModo('horas')}
                    className="rounded-2xl border px-3 py-2 text-sm font-medium"
                    style={{
                        borderColor: 'var(--border)',
                        background: modo === 'horas' ? 'var(--accent)' : 'var(--card)',
                        color: modo === 'horas' ? 'var(--accentText)' : 'var(--text)',
                    }}
                >
                    â± Ajustar Horas
                </button>

                <button
                    onClick={() => setModo('pontos')}
                    className="rounded-2xl border px-3 py-2 text-sm font-medium"
                    style={{
                        borderColor: 'var(--border)',
                        background: modo === 'pontos' ? 'var(--accent)' : 'var(--card)',
                        color: modo === 'pontos' ? 'var(--accentText)' : 'var(--text)',
                    }}
                >
                    ðŸ“ Inserir Pontos
                </button>
            </div>

            {modo === 'horas' ? (
                /* Hours Mode */
                <>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setTipo('CREDITO')}
                            className="rounded-2xl border px-3 py-2 text-sm"
                            style={{
                                borderColor: tipo === 'CREDITO' ? 'var(--pos)' : 'var(--border)',
                                background: tipo === 'CREDITO' ? 'rgba(34,197,94,0.15)' : 'var(--card)',
                                color: tipo === 'CREDITO' ? 'var(--pos)' : 'var(--text)',
                            }}
                        >
                            + CrÃ©dito
                        </button>

                        <button
                            onClick={() => setTipo('DEBITO')}
                            className="rounded-2xl border px-3 py-2 text-sm"
                            style={{
                                borderColor: tipo === 'DEBITO' ? 'var(--neg)' : 'var(--border)',
                                background: tipo === 'DEBITO' ? 'rgba(239,68,68,0.15)' : 'var(--card)',
                                color: tipo === 'DEBITO' ? 'var(--neg)' : 'var(--text)',
                            }}
                        >
                            - DÃ©bito
                        </button>
                    </div>

                    <button
                        onClick={() => setTipo('ATESTADO')}
                        className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm"
                        style={{
                            borderColor: tipo === 'ATESTADO' ? 'var(--medicalBorder)' : 'var(--border)',
                            background: tipo === 'ATESTADO' ? 'var(--medicalBg)' : 'var(--card)',
                            color: tipo === 'ATESTADO' ? 'var(--medical)' : 'var(--text)',
                        }}
                    >
                        <HeartPulse className="mr-2 inline h-4 w-4" />
                        Atestado MÃ©dico
                    </button>

                    {tipo === 'ATESTADO' ? (
                        /* ATESTADO mode - just date and optional note */
                        <>
                            <div className="mt-3">
                                <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                                    Data do atestado
                                </div>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    max={nowLocalDateTime().date}
                                    className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                                    style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                                />
                            </div>

                            <div
                                className="mt-3 rounded-2xl border px-3 py-2 text-sm"
                                style={{
                                    borderColor: 'var(--medicalBorder)',
                                    background: 'var(--medicalBg)',
                                    color: 'var(--medical)',
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <HeartPulse className="h-4 w-4" />
                                    <span>O dia serÃ¡ abonado (nÃ£o contarÃ¡ como falta)</span>
                                </div>
                            </div>

                            <input
                                value={just}
                                onChange={(e) => setJust(e.target.value)}
                                className="mt-3 w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                                placeholder="ObservaÃ§Ã£o (opcional)"
                            />
                        </>
                    ) : (
                        /* CREDITO/DEBITO mode - normal hours input */
                        <>
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

                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    value={hh}
                                    onChange={(e) => setHh(Number(e.target.value))}
                                    className="rounded-2xl border px-3 py-2 text-sm outline-none"
                                    style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                                    placeholder="Horas"
                                />
                                <input
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={mm}
                                    onChange={(e) => setMm(Number(e.target.value))}
                                    className="rounded-2xl border px-3 py-2 text-sm outline-none"
                                    style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                                    placeholder="Min"
                                />
                            </div>

                            <input
                                value={just}
                                onChange={(e) => setJust(e.target.value)}
                                className="mt-3 w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                                placeholder="Justificativa (opcional)"
                            />
                        </>
                    )}

                    {erro ? (
                        <div
                            className="mt-3 rounded-2xl border px-3 py-2 text-sm"
                            style={{
                                borderColor: 'rgba(251,113,133,.25)',
                                background: 'rgba(251,113,133,.10)',
                                color: 'rgba(251,113,133,.95)',
                            }}
                        >
                            {erro}
                        </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                            onClick={aoFechar}
                            className="rounded-2xl border px-4 py-3 text-sm"
                            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                        >
                            Cancelar
                        </button>

                        <button
                            onClick={salvarHoras}
                            className="rounded-2xl px-4 py-3 text-sm font-semibold"
                            style={{ background: 'var(--accent)', color: 'var(--accentText)' }}
                        >
                            Salvar ajuste
                        </button>
                    </div>
                </>
            ) : (
                /* Points Mode */
                <>
                    <div className="mt-3">
                        <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                            Data dos pontos
                        </div>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            max={nowLocalDateTime().date}
                            className="mt-2 w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                            style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                        />
                    </div>

                    <div className="mt-3 space-y-2">
                        <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                            Pontos do dia (deixe em branco para nÃ£o incluir)
                        </div>

                        {TIPOS_PONTO.map((tipoPonto) => (
                            <div key={tipoPonto} className="flex items-center gap-2">
                                <span className="flex-1 text-sm" style={{ color: 'var(--text)' }}>
                                    {LABEL_TIPOS[tipoPonto]}
                                </span>
                                <TimeField
                                    value={pontoEntradas[tipoPonto]}
                                    onChange={(value) => setPontoEntradas({ ...pontoEntradas, [tipoPonto]: value })}
                                    className="w-24 rounded-xl border px-2 py-1.5 text-sm outline-none"
                                    style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Extra points */}
                    {pontosExtras.length > 0 && (
                        <div className="mt-3 space-y-2">
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
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                    <TimeField
                                        value={extra.time}
                                        onChange={(value) => updateExtra(idx, 'time', value)}
                                        className="w-24 rounded-xl border px-2 py-1.5 text-sm outline-none"
                                        style={{ borderColor: 'var(--border)', background: 'var(--card2)', color: 'var(--text)' }}
                                    />
                                    <button
                                        onClick={() => removeExtra(idx)}
                                        className="rounded-xl p-1.5"
                                        style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--neg)' }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={addExtra}
                        className="mt-3 w-full rounded-2xl border px-3 py-2 text-sm font-medium"
                        style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--accent)' }}
                    >
                        + Adicionar ponto extra
                    </button>

                    {erro ? (
                        <div
                            className="mt-3 rounded-2xl border px-3 py-2 text-sm"
                            style={{
                                borderColor: 'rgba(251,113,133,.25)',
                                background: 'rgba(251,113,133,.10)',
                                color: 'rgba(251,113,133,.95)',
                            }}
                        >
                            {erro}
                        </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                            onClick={aoFechar}
                            className="rounded-2xl border px-4 py-3 text-sm"
                            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                        >
                            Cancelar
                        </button>

                        <button
                            onClick={salvarPontos}
                            className="rounded-2xl px-4 py-3 text-sm font-semibold"
                            style={{ background: 'var(--accent)', color: 'var(--accentText)' }}
                        >
                            Salvar pontos
                        </button>
                    </div>
                </>
            )}
        </ModalBase>
    );
}




