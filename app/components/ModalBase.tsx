'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export function ModalBase({
  aberto,
  aoFechar,
  children,
  width = 'max-w-xl',
}: {
  aberto: boolean;
  aoFechar: () => void;
  children: React.ReactNode;
  width?: string;
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
            className={`relative w-full ${width} max-h-[90dvh] overflow-y-auto rounded-3xl border p-5 shadow-2xl`}
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
