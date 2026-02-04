/**
 * Component: OnlineIndicator - Indicador visual de status online/offline
 */

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { SyncStatus } from '../contexts/PontoContext';

interface OnlineIndicatorProps {
    isOnline: boolean;
    syncStatus?: SyncStatus;
    pendingCount?: number;
    onClick?: () => void;
}

export function OnlineIndicator({
    isOnline,
    syncStatus = 'idle',
    pendingCount = 0,
    onClick,
}: OnlineIndicatorProps) {
    const showBadge = pendingCount > 0;

    const getIcon = () => {
        if (!isOnline) return <WifiOff className="w-4 h-4" />;
        if (syncStatus === 'syncing') return <RefreshCw className="w-4 h-4 animate-spin" />;
        if (syncStatus === 'error') return <CloudOff className="w-4 h-4" />;
        if (pendingCount > 0) return <Cloud className="w-4 h-4" />;
        return <Wifi className="w-4 h-4" />;
    };

    const getColor = () => {
        if (!isOnline) return 'var(--neg)';
        if (syncStatus === 'syncing') return 'var(--muted)';
        if (syncStatus === 'error') return 'var(--neg)';
        if (pendingCount > 0) return '#FCD34D'; // Yellow
        return 'var(--pos)';
    };

    const getTooltip = () => {
        if (!isOnline) return 'Offline - dados salvos localmente';
        if (syncStatus === 'syncing') return 'Sincronizando...';
        if (syncStatus === 'error') return 'Erro na sincronização';
        if (pendingCount > 0) return `${pendingCount} alteração(ões) pendente(s)`;
        return 'Sincronizado';
    };

    return (
        <motion.button
            onClick={onClick}
            title={getTooltip()}
            className="relative p-2 rounded-xl border transition-all hover:scale-105 active:scale-95"
            style={{
                borderColor: 'var(--border)',
                background: 'var(--card)',
                color: getColor(),
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
        >
            {getIcon()}

            <AnimatePresence>
                {showBadge && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ background: 'var(--neg)', color: 'white' }}
                    >
                        {pendingCount > 9 ? '9+' : pendingCount}
                    </motion.span>
                )}
            </AnimatePresence>
        </motion.button>
    );
}

/**
 * Barra de status offline (aparece no topo quando offline)
 */
export function OfflineBanner({ isOnline }: { isOnline: boolean }) {
    return (
        <AnimatePresence>
            {!isOnline && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                >
                    <div
                        className="px-4 py-2 text-center text-xs font-medium"
                        style={{ background: 'var(--neg)', color: 'white' }}
                    >
                        <WifiOff className="w-3 h-3 inline-block mr-2" />
                        Você está offline. As alterações serão sincronizadas quando voltar.
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
