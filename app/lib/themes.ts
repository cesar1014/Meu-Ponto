// app/lib/themes.ts
export type Theme = {
  id: string;
  nome: string;
  vars: Record<string, string>;
};

export type ThemeId = Theme['id'];

export const THEMES: Theme[] = [
  {
    id: 'obsidian',
    nome: 'Obsidian',
    vars: {
      '--bg': '#0b0b10',
      '--text': 'rgba(255,255,255,.92)',
      '--muted': 'rgba(255,255,255,.75)',
      '--muted2': 'rgba(255,255,255,.55)',
      '--border': 'rgba(255,255,255,.10)',
      '--card': 'rgba(255,255,255,.06)',
      '--card2': 'rgba(255,255,255,.04)',
      '--accent': '#60a5fa',
      '--accentText': '#071018',
      '--pos': 'rgba(52,211,153,.95)',
      '--neg': 'rgba(251,113,133,.95)',
    },
  },
  {
    id: 'graphite',
    nome: 'Graphite',
    vars: {
      '--bg': '#0a0a0a',
      '--text': 'rgba(255,255,255,.92)',
      '--muted': 'rgba(255,255,255,.70)',
      '--muted2': 'rgba(255,255,255,.50)',
      '--border': 'rgba(255,255,255,.11)',
      '--card': 'rgba(255,255,255,.07)',
      '--card2': 'rgba(255,255,255,.05)',
      '--accent': '#a78bfa',
      '--accentText': '#0e081a',
      '--pos': 'rgba(52,211,153,.95)',
      '--neg': 'rgba(251,113,133,.95)',
    },
  },
  {
    id: 'aurora',
    nome: 'Aurora',
    vars: {
      '--bg': '#071018',
      '--text': 'rgba(255,255,255,.92)',
      '--muted': 'rgba(255,255,255,.72)',
      '--muted2': 'rgba(255,255,255,.52)',
      '--border': 'rgba(255,255,255,.12)',
      '--card': 'rgba(255,255,255,.06)',
      '--card2': 'rgba(255,255,255,.04)',
      '--accent': '#22c55e',
      '--accentText': '#06130b',
      '--pos': 'rgba(52,211,153,.95)',
      '--neg': 'rgba(251,113,133,.95)',
    },
  },
  {
    id: 'emerald',
    nome: 'Emerald',
    vars: {
      '--bg': '#07110b',
      '--text': 'rgba(255,255,255,.92)',
      '--muted': 'rgba(255,255,255,.72)',
      '--muted2': 'rgba(255,255,255,.54)',
      '--border': 'rgba(255,255,255,.12)',
      '--card': 'rgba(255,255,255,.06)',
      '--card2': 'rgba(255,255,255,.04)',
      '--accent': 'rgba(34,197,94,.95)',
      '--accentText': '#06100a',
      '--pos': 'rgba(52,211,153,.95)',
      '--neg': 'rgba(251,113,133,.95)',
    },
  },
  {
    id: 'sunset',
    nome: 'Sunset',
    vars: {
      '--bg': '#120a07',
      '--text': 'rgba(255,255,255,.92)',
      '--muted': 'rgba(255,255,255,.72)',
      '--muted2': 'rgba(255,255,255,.54)',
      '--border': 'rgba(255,255,255,.12)',
      '--card': 'rgba(255,255,255,.06)',
      '--card2': 'rgba(255,255,255,.04)',
      '--accent': 'rgba(249,115,22,.95)',
      '--accentText': '#120a07',
      '--pos': 'rgba(52,211,153,.95)',
      '--neg': 'rgba(251,113,133,.95)',
    },
  },
  {
    id: 'ha',
    nome: 'HA',
    vars: {
      '--bg': '#0b0f12',
      '--text': 'rgba(255,255,255,.92)',
      '--muted': 'rgba(255,255,255,.72)',
      '--muted2': 'rgba(255,255,255,.54)',
      '--border': 'rgba(255,255,255,.12)',
      '--card': 'rgba(255,255,255,.06)',
      '--card2': 'rgba(255,255,255,.04)',
      '--accent': 'rgba(59,130,246,.95)',
      '--accentText': '#0b0f12',
      '--pos': 'rgba(52,211,153,.95)',
      '--neg': 'rgba(251,113,133,.95)',
    },
  },
  {
    id: 'obsidianLight',
    nome: 'Obsidian Light',
    vars: {
      '--bg': '#f5f5f7',
      '--text': 'rgba(0,0,0,.92)',
      '--muted': 'rgba(0,0,0,.72)',
      '--muted2': 'rgba(0,0,0,.52)',
      '--border': 'rgba(0,0,0,.12)',
      '--card': 'rgba(255,255,255,.95)',
      '--card2': 'rgba(0,0,0,.02)',
      '--accent': 'rgba(139,92,246,.95)',
      '--accentText': '#ffffff',
      '--pos': 'rgba(34,197,94,.95)',
      '--neg': 'rgba(239,68,68,.95)',
    },
  },
  {
    id: 'emeraldLight',
    nome: 'Emerald Light',
    vars: {
      '--bg': '#f0fdf4',
      '--text': 'rgba(0,0,0,.92)',
      '--muted': 'rgba(0,0,0,.72)',
      '--muted2': 'rgba(0,0,0,.54)',
      '--border': 'rgba(0,0,0,.12)',
      '--card': 'rgba(255,255,255,.95)',
      '--card2': 'rgba(0,0,0,.02)',
      '--accent': 'rgba(34,197,94,.95)',
      '--accentText': '#ffffff',
      '--pos': 'rgba(34,197,94,.95)',
      '--neg': 'rgba(239,68,68,.95)',
    },
  },
  {
    id: 'sunsetLight',
    nome: 'Sunset Light',
    vars: {
      '--bg': '#fff7ed',
      '--text': 'rgba(0,0,0,.92)',
      '--muted': 'rgba(0,0,0,.72)',
      '--muted2': 'rgba(0,0,0,.54)',
      '--border': 'rgba(0,0,0,.12)',
      '--card': 'rgba(255,255,255,.95)',
      '--card2': 'rgba(0,0,0,.02)',
      '--accent': 'rgba(249,115,22,.95)',
      '--accentText': '#ffffff',
      '--pos': 'rgba(34,197,94,.95)',
      '--neg': 'rgba(239,68,68,.95)',
    },
  },
  {
    id: 'haLight',
    nome: 'HA Light',
    vars: {
      '--bg': '#f0f9ff',
      '--text': 'rgba(0,0,0,.92)',
      '--muted': 'rgba(0,0,0,.72)',
      '--muted2': 'rgba(0,0,0,.54)',
      '--border': 'rgba(0,0,0,.12)',
      '--card': 'rgba(255,255,255,.95)',
      '--card2': 'rgba(0,0,0,.02)',
      '--accent': 'rgba(59,130,246,.95)',
      '--accentText': '#ffffff',
      '--pos': 'rgba(34,197,94,.95)',
      '--neg': 'rgba(239,68,68,.95)',
    },
  },
];

export function getTheme(id: string) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function applyThemeToRoot(theme: ReturnType<typeof getTheme>) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) {
    root.style.setProperty(k, v);
  }
}
