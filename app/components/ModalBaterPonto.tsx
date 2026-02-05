/**
 * Component: ModalBaterPonto - Modal para registrar ponto
 * 
 * UI burra - só recebe props e renderiza
 */

'use client';

import { ModalBase } from './ModalBase';
import { TipoPonto, LABEL_TIPOS } from '../lib/pontoStore';

interface ModalBaterPontoProps {
    aberto: boolean;
    aoFechar: () => void;
    tipo: TipoPonto;
    onTipoChange: (tipo: TipoPonto) => void;
    obs: string;
    onObsChange: (obs: string) => void;
    onConfirmar: () => void;
}

const TIPOS_OPTIONS: { tipo: TipoPonto; icon: string; desc: string }[] = [
    { tipo: 'ENTRADA', icon: '🌅', desc: 'Início do expediente' },
    { tipo: 'SAIDA_ALMOCO', icon: '🍽️', desc: 'Início do almoço' },
    { tipo: 'VOLTA_ALMOCO', icon: '☕', desc: 'Retorno do almoço' },
    { tipo: 'SAIDA', icon: '🌙', desc: 'Fim do expediente' },
];

export function ModalBaterPonto({
    aberto,
    aoFechar,
    tipo,
    onTipoChange,
    obs,
    onObsChange,
    onConfirmar,
}: ModalBaterPontoProps) {
    return (
        <ModalBase aberto={aberto} aoFechar={aoFechar}>
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                            Registro de ponto
                        </div>
                        <h2 className="mt-1 text-lg font-bold">Bater Ponto</h2>
                    </div>
                    <button
                        onClick={aoFechar}
                        className="rounded-2xl border px-3 py-2 text-sm"
                        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                    >
                        Fechar
                    </button>
                </div>

                {/* Type Selector - Beautiful button grid */}
                <div>
                    <div className="text-xs mb-2" style={{ color: 'var(--muted2)' }}>
                        Tipo de registro
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {TIPOS_OPTIONS.map(opt => {
                            const isSelected = tipo === opt.tipo;
                            return (
                                <button
                                    key={opt.tipo}
                                    onClick={() => onTipoChange(opt.tipo)}
                                    className="rounded-2xl border p-3 text-left transition-all"
                                    style={{
                                        borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                                        background: isSelected ? 'rgba(99,102,241,0.15)' : 'var(--card)',
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{opt.icon}</span>
                                        <div>
                                            <div
                                                className="text-sm font-semibold"
                                                style={{ color: isSelected ? 'var(--accent)' : 'var(--text)' }}
                                            >
                                                {LABEL_TIPOS[opt.tipo]}
                                            </div>
                                            <div
                                                className="text-xs"
                                                style={{ color: 'var(--muted2)' }}
                                            >
                                                {opt.desc}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Observation input */}
                <div>
                    <div className="text-xs mb-2" style={{ color: 'var(--muted2)' }}>
                        Observação (opcional)
                    </div>
                    <input
                        placeholder="Ex: reunião externa, home office..."
                        value={obs}
                        onChange={e => onObsChange(e.target.value)}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                        style={{
                            borderColor: 'var(--border)',
                            background: 'var(--card2)',
                            color: 'var(--text)'
                        }}
                    />
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                        onClick={aoFechar}
                        className="rounded-2xl border px-4 py-3 text-sm"
                        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirmar}
                        className="rounded-2xl px-4 py-3 text-sm font-bold"
                        style={{ background: 'var(--accent)', color: 'var(--accentText)' }}
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </ModalBase>
    );
}
