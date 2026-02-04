# 📍 Meu Ponto

> **Sistema Inteligente de Controle de Jornada e Gestão de Horas**

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)

---

## 📖 Sobre o Projeto

O **Meu Ponto** é uma aplicação web progressiva (PWA) desenvolvida para simplificar e modernizar o controle de jornada de trabalho. O sistema foi projetado com foco em **experiência do usuário**, **confiabilidade dos dados** e **uso offline**, permitindo que o colaborador registre seus pontos de forma rápida, segura e consistente.

O grande diferencial técnico do projeto está na sua arquitetura **Offline-First**, que permite o registro de ponto mesmo sem conexão com a internet, realizando a sincronização automática assim que a conexão é restabelecida.

---

## 🚀 Funcionalidades Principais

### 🕒 Gestão de Ponto
- Registro de ponto em tempo real (Entrada, Pausa, Retorno e Saída)
- Cálculo automático de horas trabalhadas e saldo diário
- Visualização clara e imediata do status do dia
- Solicitação de ajustes retroativos com justificativa (ponto esquecido, atestado, etc.)

### 📱 Experiência Mobile (PWA)
- Aplicação instalável (Android, iOS e Desktop)
- Funciona como app nativo
- Totalmente utilizável em modo offline
- Sincronização inteligente com fila de eventos offline
- Interface responsiva e adaptada para uso em celular

### 📊 Relatórios e Exportação
- Dashboard com visualização gráfica de horas e assiduidade
- **Exportação profissional de dados em PDF e Excel**, com layout limpo, organizado e pronto para uso administrativo, auditorias ou envio para RH
- Espelho de ponto com formatação clara e padronizada

### 🔐 Segurança e Autenticação
- Autenticação segura com Supabase Auth
- Login por e-mail ou ID do usuário
- Fluxo completo de recuperação de senha
- Proteção de rotas para acesso apenas de usuários autenticados

---

## 🛠️ Tecnologias Utilizadas

Este projeto utiliza tecnologias modernas e consolidadas do ecossistema React:

- **Frontend:** Next.js 14/15 (App Router)
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS
- **Backend / BaaS:** Supabase (PostgreSQL + Auth)
- **PWA:** Service Workers customizados + Manifest
- **Exportação:** jsPDF / jsPDF-AutoTable (PDF) e exportação em Excel
- **Estado Global:** Context API + Hooks customizados
- **Deploy:** Vercel

---

## 📂 Estrutura do Projeto

A estrutura segue as boas práticas do App Router do Next.js:

```bash
├── app/
│   ├── auth/           # Rotas de autenticação (Login, Cadastro, Reset)
│   ├── api/            # API Routes (Serverless)
│   ├── components/     # Componentes reutilizáveis
│   ├── contexts/       # Contextos globais (Auth, Ponto)
│   ├── hooks/          # Hooks customizados
│   ├── lib/            # Utilitários e configuração do Supabase
│   ├── services/       # Lógica de sincronização e offline
│   └── pages/          # Telas principais da aplicação
├── public/             # Assets estáticos, manifest e service worker
└── migrations/         # Scripts SQL do banco de dados
