/**
 * Hook: useClock - Relógio em tempo real
 * 
 * Resolve o erro de hydration mismatch ao garantir que
 * o Date só é criado no client-side
 */

'use client';

import { useState, useEffect } from 'react';

interface UseClockOptions {
    intervalMs?: number;
    enabled?: boolean;
}

/**
 * Hook que retorna a data/hora atual, atualizada a cada intervalo
 * 
 * @param options.intervalMs - Intervalo de atualização em ms (padrão: 1000)
 * @param options.enabled - Se o relógio deve estar ativo (padrão: true)
 * @returns Data atual (null no SSR até hidratar)
 */
export function useClock(options: UseClockOptions = {}): Date | null {
    const { intervalMs = 1000, enabled = true } = options;

    // Inicia como null para evitar hydration mismatch
    const [now, setNow] = useState<Date | null>(null);

    useEffect(() => {
        // Primeira atualização imediata (client-side only)
        setNow(new Date());

        if (!enabled) return;

        const timer = setInterval(() => {
            setNow(new Date());
        }, intervalMs);

        return () => clearInterval(timer);
    }, [intervalMs, enabled]);

    return now;
}

/**
 * Hook que retorna a data atual com fallback para SSR
 * Útil quando você precisa de um Date mesmo no SSR
 */
export function useClockWithFallback(options: UseClockOptions = {}): Date {
    const now = useClock(options);
    // Fallback para SSR - será substituído no client
    return now ?? new Date(0);
}

/**
 * Hook que retorna apenas a parte de hora:minuto:segundo
 * Otimizado para displays de relógio
 */
export function useClockDisplay(options: UseClockOptions = {}): string {
    const now = useClock(options);

    if (!now) return '--:--:--';

    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');

    return `${h}:${m}:${s}`;
}
