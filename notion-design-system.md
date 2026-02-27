# Design System — Notion-Style Interface

> Documentação extraída para implementação com IA. Baseado em análise de interface real.

---

## 🎨 Paleta de Cores

### Cores Base

| Token | Hex | Uso |
|-------|-----|-----|
| `--color-text-primary` | `#37352F` | Texto principal, títulos |
| `--color-text-secondary` | `#787774` | Texto secundário, placeholders |
| `--color-text-tertiary` | `#9B9A97` | Texto desabilitado, hints |
| `--color-bg-primary` | `#FFFFFF` | Fundo de cards, modais |
| `--color-bg-secondary` | `#F7F6F3` | Fundo da página |
| `--color-bg-tertiary` | `#EFEEEB` | Hover states, dividers |
| `--color-border` | `#E3E2E0` | Bordas, separadores |

### Cores de Ação

| Token | Hex | Uso |
|-------|-----|-----|
| `--color-primary` | `#2383E2` | Botões primários, links |
| `--color-primary-hover` | `#0B6BCB` | Hover em elementos primários |
| `--color-primary-light` | `#E7F3FF` | Background de seleção |

### Escala de Cinzas (Neutrals)

```css
--gray-900: #191919;  /* Texto em dark mode */
--gray-800: #37352F;  /* Texto principal */
--gray-700: #55534E;  /* Texto secundário forte */
--gray-600: #787774;  /* Texto secundário */
--gray-500: #9B9A97;  /* Texto terciário */
--gray-400: #C4C4C4;  /* Bordas fortes */
--gray-300: #E3E2E0;  /* Bordas padrão */
--gray-200: #EFEEEB;  /* Backgrounds hover */
--gray-100: #F7F6F3;  /* Background secundário */
--gray-50:  #FFFFFF;  /* Background primário */
```

### Status Colors

| Token | Hex | Background | Uso |
|-------|-----|------------|-----|
| `--status-not-started` | `#787774` | `#F1F1EF` | Não iniciado |
| `--status-planning` | `#D9730D` | `#FBF3DB` | Planejamento (amarelo) |
| `--status-in-progress` | `#2383E2` | `#E7F3FF` | Em progresso (azul) |
| `--status-waiting` | `#9065B0` | `#F6F3F8` | Aguardando (roxo) |
| `--status-complete` | `#0F7B6C` | `#DBEDDB` | Completo (verde) |

### Priority Colors

| Token | Hex | Background | Label |
|-------|-----|------------|-------|
| `--priority-low` | `#37352F` | `#E3E2E0` | Low |
| `--priority-medium` | `#D9730D` | `#FBF3DB` | Medium |
| `--priority-high` | `#E03E3E` | `#FFE2DD` | High 🔥 |

### Accent Colors (Semantic)

```css
--accent-red:     #E16259;  /* Alertas, erros, prioridade alta */
--accent-orange:  #D9730D;  /* Warnings, em andamento */
--accent-yellow:  #DFAB01;  /* Destaque, planning */
--accent-green:   #4DAB9A;  /* Sucesso, completo */
--accent-blue:    #2383E2;  /* Primário, links, in progress */
--accent-purple:  #9065B0;  /* Especial, waiting */
--accent-pink:    #E255A1;  /* Decorativo */
--accent-brown:   #9F6B53;  /* Arquivado */
```

---

## 📝 Tipografia

### Font Family

```css
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: ui-monospace, 'SFMono-Regular', Consolas, monospace;
```

### Font Weights

| Token | Weight | Uso |
|-------|--------|-----|
| `--font-light` | 300 | Texto grande decorativo |
| `--font-regular` | 400 | Corpo de texto |
| `--font-medium` | 500 | Subtítulos, labels |
| `--font-bold` | 700 | Títulos, ênfase |

### Type Scale

| Token | Size | Line Height | Uso |
|-------|------|-------------|-----|
| `--text-xs` | 11px | 16px | Badges, tags pequenas |
| `--text-sm` | 12px | 18px | Labels, metadados |
| `--text-base` | 14px | 22px | Corpo de texto padrão |
| `--text-md` | 16px | 24px | Texto de destaque |
| `--text-lg` | 18px | 28px | Subtítulos |
| `--text-xl` | 20px | 28px | Títulos de seção |
| `--text-2xl` | 24px | 32px | Títulos de página |
| `--text-3xl` | 32px | 40px | Títulos principais |
| `--text-4xl` | 40px | 48px | Hero titles |

### Aplicação Prática

```css
/* Page Title */
.page-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--color-text-primary);
  line-height: 1.25;
  letter-spacing: -0.02em;
}

/* Card Title */
.card-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

/* Metadata / Secondary */
.text-secondary {
  font-size: var(--text-sm);
  font-weight: var(--font-regular);
  color: var(--color-text-secondary);
}

/* Tags / Badges */
.tag-text {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: capitalize;
}
```

---

## 📐 Espaçamento (8px Grid)

### Spacing Scale

| Token | Value | Uso |
|-------|-------|-----|
| `--space-0` | 0px | Reset |
| `--space-1` | 4px | Micro spacing (icon gaps) |
| `--space-2` | 8px | Tight spacing (entre elementos inline) |
| `--space-3` | 12px | Default gap (entre itens de lista) |
| `--space-4` | 16px | Section padding interno |
| `--space-5` | 20px | Card padding |
| `--space-6` | 24px | Entre seções |
| `--space-8` | 32px | Entre grupos de conteúdo |
| `--space-10` | 40px | Page margins |
| `--space-12` | 48px | Large section gaps |
| `--space-16` | 64px | Hero spacing |

### Layout Constants

```css
--sidebar-width: 240px;
--content-max-width: 900px;
--kanban-column-width: 280px;
--kanban-column-gap: 12px;
--card-gap: 8px;
--table-row-height: 42px;
--avatar-size-sm: 20px;
--avatar-size-md: 24px;
--avatar-size-lg: 32px;
```

---

## 🧱 Componentes

### Button

```css
/* Primary Button */
.btn-primary {
  background: var(--color-primary);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  border: none;
  cursor: pointer;
  transition: background 120ms ease;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: var(--color-text-secondary);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: var(--text-sm);
  font-weight: var(--font-regular);
  border: none;
  cursor: pointer;
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* Icon Button */
.btn-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
}

.btn-icon:hover {
  background: var(--color-bg-tertiary);
}
```

### Card (Kanban)

```css
.card {
  background: var(--color-bg-primary);
  border-radius: 4px;
  padding: var(--space-3);
  box-shadow: 
    0 0 0 1px rgba(55, 53, 47, 0.09),
    0 1px 2px rgba(55, 53, 47, 0.08);
  cursor: pointer;
  transition: box-shadow 120ms ease, background 120ms ease;
}

.card:hover {
  background: var(--color-bg-secondary);
}

.card-icon {
  width: 20px;
  height: 20px;
  margin-right: var(--space-2);
}

.card-title {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  margin-bottom: var(--space-2);
}

.card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.card-avatar {
  width: var(--avatar-size-sm);
  height: var(--avatar-size-sm);
  border-radius: 50%;
}
```

### Tag / Badge

```css
.tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  white-space: nowrap;
}

/* Status Tags */
.tag-planning {
  background: #FBF3DB;
  color: #D9730D;
}

.tag-in-progress {
  background: #E7F3FF;
  color: #2383E2;
}

.tag-complete {
  background: #DBEDDB;
  color: #0F7B6C;
}

/* Priority Tags */
.tag-low {
  background: #E3E2E0;
  color: #37352F;
}

.tag-medium {
  background: #FBF3DB;
  color: #D9730D;
}

.tag-high {
  background: #FFE2DD;
  color: #E03E3E;
}
```

### Kanban Column

```css
.kanban-board {
  display: flex;
  gap: var(--kanban-column-gap);
  padding: var(--space-4);
  overflow-x: auto;
}

.kanban-column {
  flex-shrink: 0;
  width: var(--kanban-column-width);
}

.kanban-column-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  margin-bottom: var(--space-2);
}

.kanban-column-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.kanban-column-count {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.kanban-column-cards {
  display: flex;
  flex-direction: column;
  gap: var(--card-gap);
}
```

### Table Row

```css
.table {
  width: 100%;
  border-collapse: collapse;
}

.table-row {
  height: var(--table-row-height);
  border-bottom: 1px solid var(--color-border);
  transition: background 60ms ease;
}

.table-row:hover {
  background: var(--color-bg-secondary);
}

.table-cell {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
  color: var(--color-text-primary);
  vertical-align: middle;
}

.table-header {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}
```

### Avatar

```css
.avatar {
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.avatar-sm { width: 20px; height: 20px; }
.avatar-md { width: 24px; height: 24px; }
.avatar-lg { width: 32px; height: 32px; }

.avatar-placeholder {
  background: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}
```

### Input / Search

```css
.input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.input::placeholder {
  color: var(--color-text-tertiary);
}

.input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.search-input {
  padding-left: 32px;
  background-image: url('search-icon.svg');
  background-repeat: no-repeat;
  background-position: 10px center;
  background-size: 14px;
}
```

---

## 🖼️ Iconografia

### Tamanhos de Ícone

| Token | Size | Uso |
|-------|------|-----|
| `--icon-xs` | 12px | Inline com texto pequeno |
| `--icon-sm` | 14px | Botões, labels |
| `--icon-md` | 16px | Padrão em UI |
| `--icon-lg` | 20px | Headers, navegação |
| `--icon-xl` | 24px | Destaque, empty states |

### Ícones Comuns (Lucide/Feather style)

```
Navigation: menu, arrow-left, arrow-right, chevron-down
Actions: plus, search, filter, sort, more-horizontal
Content: file-text, image, link, lock
Status: check, x, alert-circle, info
Social: user, users, message-circle
```

---

## 🌗 Dark Mode (Opcional)

```css
[data-theme="dark"] {
  --color-text-primary: #FFFFFFDE;
  --color-text-secondary: #FFFFFF9E;
  --color-text-tertiary: #FFFFFF5E;
  --color-bg-primary: #2F3437;
  --color-bg-secondary: #25282A;
  --color-bg-tertiary: #373C3F;
  --color-border: #FFFFFF14;
}
```

---

## 📱 Breakpoints

```css
--breakpoint-sm: 640px;   /* Mobile */
--breakpoint-md: 768px;   /* Tablet */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Wide */
```

### Mobile Adaptations

```css
@media (max-width: 768px) {
  --kanban-column-width: 260px;
  --space-4: 12px;
  --space-6: 16px;
  --text-3xl: 24px;
  --text-2xl: 20px;
}
```

---

## 🎯 Tokens CSS Completos (Copy-Paste Ready)

```css
:root {
  /* Colors - Base */
  --color-text-primary: #37352F;
  --color-text-secondary: #787774;
  --color-text-tertiary: #9B9A97;
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F7F6F3;
  --color-bg-tertiary: #EFEEEB;
  --color-border: #E3E2E0;
  
  /* Colors - Action */
  --color-primary: #2383E2;
  --color-primary-hover: #0B6BCB;
  --color-primary-light: #E7F3FF;
  
  /* Colors - Status */
  --status-not-started: #787774;
  --status-not-started-bg: #F1F1EF;
  --status-planning: #D9730D;
  --status-planning-bg: #FBF3DB;
  --status-in-progress: #2383E2;
  --status-in-progress-bg: #E7F3FF;
  --status-complete: #0F7B6C;
  --status-complete-bg: #DBEDDB;
  
  /* Colors - Priority */
  --priority-low: #37352F;
  --priority-low-bg: #E3E2E0;
  --priority-medium: #D9730D;
  --priority-medium-bg: #FBF3DB;
  --priority-high: #E03E3E;
  --priority-high-bg: #FFE2DD;
  
  /* Colors - Accent */
  --accent-red: #E16259;
  --accent-orange: #D9730D;
  --accent-yellow: #DFAB01;
  --accent-green: #4DAB9A;
  --accent-blue: #2383E2;
  --accent-purple: #9065B0;
  
  /* Typography */
  --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: ui-monospace, 'SFMono-Regular', Consolas, monospace;
  --font-light: 300;
  --font-regular: 400;
  --font-medium: 500;
  --font-bold: 700;
  
  /* Type Scale */
  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 14px;
  --text-md: 16px;
  --text-lg: 18px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 32px;
  --text-4xl: 40px;
  
  /* Spacing (8px grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  
  /* Layout */
  --sidebar-width: 240px;
  --content-max-width: 900px;
  --kanban-column-width: 280px;
  --table-row-height: 42px;
  --avatar-size-sm: 20px;
  --avatar-size-md: 24px;
  --avatar-size-lg: 32px;
  
  /* Borders */
  --radius-sm: 3px;
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(55, 53, 47, 0.08);
  --shadow-md: 0 0 0 1px rgba(55, 53, 47, 0.09), 0 1px 2px rgba(55, 53, 47, 0.08);
  --shadow-lg: 0 0 0 1px rgba(55, 53, 47, 0.09), 0 4px 12px rgba(55, 53, 47, 0.12);
  
  /* Transitions */
  --transition-fast: 60ms ease;
  --transition-base: 120ms ease;
  --transition-slow: 200ms ease;
}
```

