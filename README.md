# 📍 Meu Ponto

> **Sistema Inteligente de Controle de Jornada e Gestão de Horas**

![Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.4-blue.svg)

---

## 🌐 Acesso ao Sistema

🔗 **Aplicação em produção:**  
👉 https://meupontoha.vercel.app/

---

## 📖 Sobre o Projeto

O **Meu Ponto** é uma aplicação web progressiva (PWA) desenvolvida para simplificar e modernizar o controle de jornada de trabalho. O sistema foi projetado com foco em **experiência do usuário**, **confiabilidade dos dados** e **uso offline**, permitindo que o colaborador registre seus pontos de forma rápida, segura e consistente.

O principal diferencial técnico do projeto está na sua arquitetura **Offline-First**, que permite o registro de ponto mesmo sem conexão com a internet, realizando a sincronização automática assim que a conexão é restabelecida.

---

## 🚀 Funcionalidades Principais

### 🕒 Gestão de Ponto
- Registro de ponto em tempo real (Entrada, Pausa, Retorno e Saída)
- Cálculo automático de horas trabalhadas e saldo diário
- Visualização clara do status do dia
- Solicitação de ajustes retroativos com justificativa

### 📱 Experiência Mobile (PWA)
- Aplicação instalável (Android, iOS e Desktop)
- Funciona como aplicativo nativo
- Totalmente utilizável em modo offline
- Sincronização inteligente de dados
- Interface responsiva e adaptada para celular

### 📊 Relatórios e Exportação
- Dashboard com visualização gráfica de horas e assiduidade
- **Exportação profissional de dados em PDF e Excel**, com layout limpo, organizado e pronto para uso administrativo, auditorias ou envio ao RH
- Espelho de ponto padronizado e legível

### 🔐 Segurança e Autenticação
- Autenticação segura com Supabase Auth
- Login por e-mail ou ID do usuário
- Recuperação de senha
- Proteção de rotas autenticadas

---

## 🛠️ Tecnologias Utilizadas

### ⚙️ Stack Principal

<p align="left">
  <img src="https://skillicons.dev/icons?i=nextjs,react,ts,tailwind,supabase,postgres,vercel" />
</p>

### 📌 Detalhamento Técnico
- **Frontend:** Next.js 16 (App Router)
- **UI:** React 19
- **Linguagem:** TypeScript
- **Estilização:** Tailwind
- **Backend / BaaS:** Supabase (PostgreSQL + Auth)
- **PWA:** Service Workers + Manifest
- **Estado Global:** Context API + Hooks customizados
- **Exportação:** jsPDF / jsPDF-AutoTable (PDF) + ExcelJS (Excel)
- **Deploy:** Vercel

---

## 📂 Estrutura do Projeto

```bash
├── app/
│   ├── auth/           # Login, cadastro e recuperação de senha
│   ├── api/            # API Routes (Serverless)
│   ├── components/     # Componentes reutilizáveis
│   ├── contexts/       # Contextos globais (Auth, Ponto)
│   ├── hooks/          # Hooks customizados
│   ├── lib/            # Utilitários e Supabase
│   ├── services/       # Offline e sincronização
│   └── pages/          # Telas principais
├── public/             # Assets, manifest e service worker
└── migrations/         # Scripts SQL
