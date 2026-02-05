'use client';

import React, { useMemo } from 'react';

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  lineColor?: string;  // ex: 'var(--accent)'
  fillColor?: string;  // ex: 'rgba(255,255,255,.06)'
};

export function Sparkline({
  values,
  width = 140,
  height = 40,
  strokeWidth = 2,
  className,
  lineColor = 'var(--accent)',
  fillColor = 'rgba(255,255,255,.06)',
}: SparklineProps) {
  const { dLine, dArea } = useMemo(() => {
    const v = values?.length ? values : [0];

    const min = Math.min(...v);
    const max = Math.max(...v);
    const span = Math.max(1e-9, max - min);

    const padX = 4;
    const padY = 4;

    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const xFor = (i: number) => padX + (i / Math.max(1, v.length - 1)) * innerW;
    const yFor = (val: number) => padY + (1 - (val - min) / span) * innerH;

    const pts = v.map((val, i) => [xFor(i), yFor(val)] as const);

    const line = pts
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`)
      .join(' ');

    const area = [
      line,
      `L ${(padX + innerW).toFixed(2)} ${(padY + innerH).toFixed(2)}`,
      `L ${padX.toFixed(2)} ${(padY + innerH).toFixed(2)}`,
      'Z',
    ].join(' ');

    return { dLine: line, dArea: area };
  }, [values, width, height]);

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="sparkline"
    >
      <path d={dArea} fill={fillColor} />
      <path d={dLine} fill="none" stroke={lineColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
