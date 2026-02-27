# CLAUDE.md

Este arquivo fornece orientações para o Antigravity (e outros agentes de IA) ao trabalhar neste repositório. Ele contém as regras de design, arquitetura e infraestrutura estabelecidas.

## Comandos Úteis

```bash
npm run dev       # Inicia servidor de dev em http://localhost:5173
npm run build     # Type-check + build de produção
npm run preview   # Preview do build de produção
git push          # Dispara build automático na Vercel (branch main)
```

## Stack Tecnológica

- **Core**: React 18 + TypeScript via Vite 6.
- **Animações**: Framer Motion (uso obrigatório para micro-interações e transições).
- **Tipografia**: 
    - `Poppins`: Interface geral e títulos.
    - `Geist Mono`: Dados, números, tabelas e saídas de IA (estética técnica).
- **Cores**: Base `#FCF8F8`, Texto/Ícones `#1E1E1E`.

## Arquitetura e Componentes Chave

### 1. Sistema de Chat IA (Ask Northie)
- **Componente**: `src/components/ChatSidebar.tsx`.
- **Modos de Exibição**:
    - **Sidebar (380px)**: Empurra o conteúdo do `App.tsx` via `paddingRight`.
    - **Workstation (Full-Screen)**: Modo tela inteira para análise profunda de dados, centralizado em 800px.
- **Estética de Dados**: Uso de blocos de "Intelligence Output", efeito de scanline sutil e animação de "Thinking" técnica.
- **Sugestões**: Chips contextuais dinâmicos baseados na página ativa (`context` prop).

### 2. Layout Principal (`App.tsx`)
- Sidebar fixa (`marginLeft` dinâmico).
- Gerenciamento de estado global para `activePage`, `chatOpen` e `isChatFull`.
- Transições de página suaves com `AnimatePresence`.

### 3. Ícones (`src/icons.tsx`)
- Centralizados em um arquivo, exportados como componentes React.
- Devem usar `fill="currentColor"` para controle de cor/opacidade via pai.

## Convenções de Código e Design

- **Design Premium**: Evitar cores genéricas. Usar micro-interações (`whileHover`, `whileTap`) em todos os elementos interativos.
- **Internacionalização**: Números e moedas sempre formatados para `pt-BR`.
- **Easings de Animação**: 
    - Layout: `[0.4, 0, 0.2, 1]`.
    - Fades/Entradas: `[0.25, 0.1, 0.25, 1]`.
- **Git/Vercel**: O projeto está conectado ao repositório `possato-a/northie` e deployado na Vercel. Commits na `main` são deploys automáticos.

## Estrutura de Pastas

```
src/
  components/
    charts/           # Gráficos reutilizáveis (RevenueChart, SalesHeatmap, ChannelChart)
    layout/           # Estrutura global (Sidebar, TopBar, ChatSidebar)
    ui/               # Elementos de UI reutilizáveis (KpiCard, DatePicker, TopClients)
  pages/              # Páginas completas (Dashboard, Vendas, Clientes, Canais, Criadores, AppStore, Login)
  lib/                # Utilitários (api.ts → axios client, supabase.ts → auth client)
  types/              # Tipos TypeScript compartilhados (index.ts)
  icons.tsx           # Repositório de ícones SVG
  App.tsx             # Orquestrador de estado e layout
  main.tsx            # Entry point React

server/src/
  controllers/        # Handlers de requisição HTTP (um por domínio)
  routes/             # Definição de rotas Express (um por domínio)
  services/           # Lógica de negócio (ai, integration, normalization)
  lib/                # Clientes de infraestrutura (supabase.ts)
  utils/              # Utilitários (encryption, pixel-snippet)
  jobs/               # Cron jobs (token-refresh)
  types/              # Tipos TypeScript compartilhados do backend (index.ts)
  index.ts            # Entry point Express

supabase/
  migrations/         # SQL migrations versionadas
```
