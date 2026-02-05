'use client';

import { useEffect, useRef, useState } from 'react';

interface UseOnlineStatusResult {
    isOnline: boolean;
    wasOffline: boolean; // true apenas no "momento" em que volta do offline
}

export function useOnlineStatus(): UseOnlineStatusResult {
    // Start undefined to avoid SSR hydration mismatch
    const [isOnline, setIsOnline] = useState<boolean | undefined>(undefined);
    const [wasOffline, setWasOffline] = useState(false);
    const prevOnlineRef = useRef<boolean | undefined>(undefined);
    const mountedRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Set initial state on mount
        const initial = navigator.onLine;
        setIsOnline(initial);
        prevOnlineRef.current = initial;
        mountedRef.current = true;

        const handleOnline = () => {
            // se antes estava offline e agora ficou online => wasOffline true
            const cameBack = prevOnlineRef.current === false;
            prevOnlineRef.current = true;

            setIsOnline(true);
            setWasOffline(cameBack);

            // "pulse": volta pra false logo depois, pra não ficar travado em true
            if (cameBack) setTimeout(() => setWasOffline(false), 0);
        };

        const handleOffline = () => {
            prevOnlineRef.current = false;
            setIsOnline(false);
            setWasOffline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Return true as default before hydration to avoid UI flicker
    return { isOnline: isOnline ?? true, wasOffline };
}

export function useIsOnline(): boolean {
    return useOnlineStatus().isOnline;
}
