# Ponto App (MVP) — Controle de Ponto Offline‑First

Aplicativo de **controle de ponto pessoal** feito em **Next.js (App Router)** com foco em:
- registrar batidas (entrada/saída/almoço),
- calcular **horas trabalhadas**, **meta do dia** e **saldo**,
- funcionar **offline** com persistência local,
- e (opcionalmente) sincronizar com **Supabase** quando estiver logado.

> Status: **em desenvolvimento (MVP)** — o app já roda, registra pontos e calcula saldo, mas ainda existem ajustes/roadmap listados no final.

---

## ✨ O que já existe (por enquanto)

### ✅ Funcionalidades principais
- **Autenticação via Supabase** com login por **ID numérico** (mapeado internamente para `ID@pontoapp.com`)
- **Modo visitante** (Guest Mode) sem login, salvando tudo localmente
- **Home (hoje):**
  - saudação (“**Bem‑vindo ao seu ponto**” no modo visitante)
  - resumo do dia: **meta**, **trabalhado**, **delta do dia**
  - saldo total do ano (atualmente calculado para **2026**)
  - botão para **registrar ponto** com sugestão automática do próximo tipo
  - acesso rápido à **Configurações** (modal)
- **Tela Pontos (histórico):**
  - lista por dia com status (“Pontos OK”, “Faltam X”, etc.)
  - resumo de horários (Entrada / Almoço / Volta / Saída)
  - **filtros** por completude, saldo, período + busca
  - **modo seleção** com seleção múltipla e exclusão em lote (dias apagados vão para “ocultos”)
  - **gráfico de barras** (trabalhado vs meta) por período
  - **Relatório PDF** (jsPDF + autoTable)
  - **Marco Zero** (define um saldo inicial a partir de uma data)
- **Ajustes**
  - **Crédito** e **Débito** de minutos (para correções manuais)
  - **Atestado** (marca o dia na interface)
  - **Ajustes Retroativos** (editar pontos e/ou horas de dias passados, com log)
- **Configurações (modal):**
  - jornada semanal + metas por dia (seg–sex, opcional fim de semana)
  - “distribuir” a carga semanal automaticamente
  - preferências/flags (24h, alertas, etc. — algumas ainda são só UI)
  - seleção de **temas** (CSS variables)
  - **backup** exportar/importar JSON (com validação básica)
  - **reset** local (pontos/ajustes/config)

### ✅ Offline / PWA
- Persistência **localStorage** com **escopo por usuário** (guest / user)
- **PWA básico**:
  - `manifest.json`
  - `sw.js` (cache estático + estratégia network-first)
  - registro do SW apenas em produção (em dev ele limpa SW/caches para não atrapalhar)

---

## 🧱 Stack

- **Next.js** (App Router)
- **React**
- **TypeScript**
- **Tailwind CSS (v4)** + CSS variables para temas
- **Framer Motion** (animações)
- **Supabase** (Auth + Storage de pontos/config)
- **jsPDF + jspdf-autotable** (relatório PDF)
- **date-fns** (datas)

---

## 🚀 Rodando localmente

### Pré‑requisitos
- Node.js **18+** (recomendado **20+**)
- npm / pnpm / yarn

### Instalação
```bash
npm install
npm run dev
```

Abra:
- http://localhost:3000

> A página raiz (`/`) redireciona para `/login`.

---

## 🔐 Variáveis de ambiente (Supabase)

Crie um arquivo `.env.local` na raiz:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
# opcional (server-side)
SUPABASE_SERVICE_ROLE_KEY=...
```

**Sem essas variáveis**, o app continua funcionando **em modo offline/visitante**, mas login/sync ficam indisponíveis.

---

## 🗄️ Supabase (opcional) — estrutura esperada

O app usa Supabase para:
- **Auth** (email/senha, mas o usuário vê só o **ID**)
- tabela `pontos` para salvar batidas
- tabela `config` para salvar configuração por usuário

> No código, ajustes (crédito/débito/atestado) ainda são **locais** (não sincronizam).

### Tabelas sugeridas (SQL)
Use como base no Supabase SQL Editor:

```sql
-- PONTOS
create table if not exists public.pontos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  at_iso timestamptz not null,
  tipo text not null,
  obs text
);

create index if not exists pontos_user_at on public.pontos (user_id, at_iso desc);

-- CONFIG
create table if not exists public.config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.pontos enable row level security;
alter table public.config enable row level security;

create policy "pontos_owner"
on public.pontos
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "config_owner"
on public.config
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

---

## 🧠 Como o app calcula as horas (modelo atual)

### Tipos de ponto
- `ENTRADA`
- `SAIDA_ALMOCO` (**Entrada do Almoço** = início da pausa)
- `VOLTA_ALMOCO` (**Volta do Almoço** = fim da pausa)
- `SAIDA`
- `OUTRO` (extra)

### Cálculo do “trabalhado”
O cálculo percorre os pontos em ordem, somando blocos:
- **ENTRADA → SAIDA_ALMOCO**
- **VOLTA_ALMOCO → SAIDA**
- Se estiver “aberto” (ex.: entrou e ainda não saiu), pode calcular **live** até o horário atual.

### Meta do dia
A meta vem das **metas por dia da semana** em Configurações (`dailyTargets`), com suporte opcional a fim de semana.

### Saldo (atual)
- O saldo “total” é calculado por `calcSaldo2026(...)`
- **Importante:** hoje o saldo está **fixo para o ano de 2026** (de `2026-01-01` até hoje ou `2026-12-31`)
- Existe suporte a **Marco Zero** (data + saldo inicial) e **compactação** de histórico (ex.: manter últimos 120 dias e guardar marco)

---

## 💾 Persistência local (offline‑first)

As chaves do `localStorage` são geradas com escopo:
- `guest`
- `user_<id>`

Exemplos (simplificado):
- `pontoapp.pontos.user_<id>.v1`
- `pontoapp.config.user_<id>.v1`
- `pontoapp.ajustes.user_<id>.v1`
- `pontoapp.pendingOps.user_<id>.v1`

Além disso, existe migração de chaves legadas para o novo padrão escopado.

---

## 🔄 Sincronização (quando logado no Supabase)

O provedor de dados (`PontoProvider`) tenta sincronizar:
- `pontos` (com **fila de operações pendentes**: insert/update/delete)
- `config` (resolve por `updatedAt` e faz upsert)

### Limitações atuais
- **Ajustes** (crédito/débito/atestado) **não sincronizam** ainda
- Merge de pontos é “best-effort” e prioriza o que está pendente localmente

---

## 🎨 Temas / UI

- Tema é aplicado via **CSS variables** em `:root`
- Lista de temas em `app/lib/themes.ts`
- Config salva o `themeId`

---

## 🧾 Relatório PDF

Em “Pontos”, é possível gerar um PDF com:
- data
- batidas do dia
- meta / trabalhado / saldo do dia
- saldo total atual

Implementado em `app/lib/relatorioPdf.ts` com `jspdf` + `jspdf-autotable`.

---

## 🧩 Estrutura do projeto (alto nível)

```
app/
  home/                 # tela principal (hoje)
  pontos/               # histórico + filtros + pdf + ajustes
  login/ signup/        # auth (ID numérico)
  components/           # UI (HomeDisplay, ConfigView, modais...)
  contexts/             # AuthContext / PontoContext
  hooks/                # clock + online status
  lib/
    pontoStore.ts       # tipos + cálculo + storage + saldo + compactação
    backup.ts           # export/import JSON
    relatorioPdf.ts     # gerar PDF
    themes.ts           # temas
    supabase/           # clients browser/server
public/
  sw.js                 # service worker
  manifest.json         # PWA manifest
```

---

## ⚠️ Pontos conhecidos / limitações (MVP)

- **Saldo anual fixo em 2026** (`calcSaldo2026`) — precisa generalizar por ano/período
- **Atestado** hoje é principalmente **visual** (marca o dia), mas ainda não “abona” meta/saldo automaticamente
- **Backup JSON** valida apenas crédito/débito (no estado atual, `ATESTADO` pode falhar na importação)
- Notificações/alertas existem como toggles de UI, mas **não há agendamento real** via Notifications API ainda
- Ajustes ainda são **apenas locais** (sem sync multi‑device)

---

## 🛣️ Roadmap sugerido (próximos passos)

- [ ] Generalizar cálculo de saldo (ano configurável / período)
- [ ] Fazer **ATESTADO abonar o dia** (meta = 0 ou regra específica) e refletir no saldo
- [ ] Sincronizar `ajustes` no Supabase (com RLS)
- [ ] Corrigir import/export do backup para aceitar `ATESTADO`
- [ ] Ajustes de UI (baseados nos anexos):
  - [ ] trocar destaque azul por **vermelho** (com bom contraste)
  - [ ] alinhar ícone e texto (não deixar ícone “em cima” do label)
  - [ ] no resumo do dia, mostrar **Trabalhado** + **Extra (±)** com regra de cores (ex.: neutro até ±20min)
  - [ ] substituir “00:13 / 00:00” por informação mais útil (ex.: jornada alvo ou entrada/saída esperadas)

---

## 📦 Scripts

```bash
npm run dev      # desenvolvimento
npm run build    # build produção
npm run start    # start produção
npm run lint     # lint
```

---

## 🤝 Contribuição

1. Fork / clone
2. Crie uma branch: `feat/minha-feature`
3. Commit com mensagens claras
4. Abra PR descrevendo contexto + prints

