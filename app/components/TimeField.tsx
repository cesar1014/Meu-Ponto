'use client';

import React from 'react';
import { formatTimeDraft, normalizeTimeValue } from '@/lib/timeInput';

type TimeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
};

export function TimeField({
  value,
  onChange,
  className,
  style,
  placeholder = 'HH:MM',
}: TimeFieldProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(formatTimeDraft(e.target.value))}
      onBlur={() => {
        const normalized = normalizeTimeValue(value);
        onChange(normalized ?? '');
      }}
      placeholder={placeholder}
      className={className}
      style={style}
    />
  );
}
