# Design System -- Northie

> Design system oficial da plataforma Northie. Baseado em shadcn/ui new-york-v4 + identidade visual propria.

---

## Paleta de Cores

### Brand -- Northie Orange (oklch)

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-primary` | `oklch(0.646 0.222 41.116)` | Botoes primarios, links, accent |
| `--color-primary-fg` | `oklch(0.985 0.008 70)` | Texto sobre fundo primario |
| `--color-primary-hover` | `oklch(0.58 0.222 41.116)` | Hover em elementos primarios |
| `--color-primary-light` | `oklch(0.97 0.04 70)` | Background de selecao, tints |

### Cores Base (Light Mode -- Primario)

| Token | Hex | Uso |
|-------|-----|-----|
| `--bg` | `#FAFAF9` | Fundo da pagina |
| `--fg` | `#1C1917` | Texto principal |
| `--color-text-primary` | `#1C1917` | Texto principal, titulos |
| `--color-text-secondary` | `#78716C` | Texto secundario, placeholders |
| `--color-text-tertiary` | `#A8A29E` | Texto desabilitado, hints |
| `--color-bg-primary` | `#FFFFFF` | Fundo de cards, modais |
| `--color-bg-secondary` | `#F5F5F4` | Fundo secundario, hover |
| `--color-bg-tertiary` | `#E7E5E4` | Hover states, dividers |
| `--color-border` | `#E2E0DD` | Bordas, separadores |

### Dark Mode (Warm Carbon)

| Token | Valor | Uso |
|-------|-------|-----|
| `--bg` | `#0C0A09` | Fundo da pagina |
| `--fg` | `#FAF9F8` | Texto principal |
| `--color-bg-primary` | `#1C1917` | Cards, modais |
| `--color-bg-secondary` | `#292524` | Fundo secundario |
| `--color-bg-tertiary` | `#3C3533` | Hover states |
| `--color-border` | `rgba(250,249,248,0.08)` | Bordas |
| `--color-primary` | `oklch(0.705 0.213 47.604)` | Laranja mais claro para acessibilidade |

### Status Colors

| Token | Valor | Background | Uso |
|-------|-------|------------|-----|
| `--status-not-started` | `#78716C` | `#F5F5F4` | Nao iniciado |
| `--status-planning` | `oklch(0.75 0.183 55.934)` | `oklch(0.97 0.04 70)` | Planejamento (amber) |
| `--status-in-progress` | `#3B82F6` | `#EFF6FF` | Em progresso (azul) |
| `--status-complete` | `#0F7B6C` | `#DCFCE7` | Completo (verde) |

### Priority Colors

| Token | Valor | Background |
|-------|-------|------------|
| `--priority-low` | `#1C1917` | `#E7E5E4` |
| `--priority-medium` | `oklch(0.646 0.222 41.116)` | `oklch(0.97 0.04 70)` |
| `--priority-high` | `oklch(0.577 0.245 27.325)` | `oklch(0.97 0.06 27)` |

### Chart Palette (Amber Ramp)

```css
--color-chart-1: oklch(0.837 0.128 66.29);   /* amber claro */
--color-chart-2: oklch(0.705 0.213 47.604);  /* orange medio */
--color-chart-3: oklch(0.646 0.222 41.116);  /* northie orange (brand) */
--color-chart-4: oklch(0.553 0.195 38.402);  /* orange escuro */
--color-chart-5: oklch(0.47 0.157 37.304);   /* amber profundo */
```

### Accent Colors

```css
--accent-red:    oklch(0.577 0.245 27.325);
--accent-orange: oklch(0.646 0.222 41.116);  /* = brand primary */
--accent-amber:  oklch(0.75  0.183 55.934);
--accent-yellow: oklch(0.85  0.17  85);
--accent-green:  #0F7B6C;
--accent-blue:   #3B82F6;
--accent-purple: #7C3AED;
```

---

## Tipografia

| Token | Fonte | Uso |
|-------|-------|-----|
| `--font-sans` | Inter | Corpo de texto, interface geral |
| `--font-display` | Poppins | Titulos, KPI values |
| `--font-mono` | Geist Mono | Dados, numeros, tabelas, saidas de IA |
| `--font-serif` | Lora | Decorativo (uso raro) |

### Type Scale

| Token | Size | Uso |
|-------|------|-----|
| `--text-xs` | 11px | Badges, tags |
| `--text-sm` | 12px | Labels, metadados |
| `--text-base` | 14px | Corpo padrao |
| `--text-md` | 16px | Destaque |
| `--text-lg` | 18px | Subtitulos |
| `--text-xl` | 20px | Titulos de secao |
| `--text-2xl` | 24px | Titulos de pagina |
| `--text-3xl` | 32px | Titulos principais |
| `--text-4xl` | 40px | Hero titles |

---

## Espacamento (8px Grid)

| Token | Value |
|-------|-------|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-12` | 48px |
| `--space-16` | 64px |

---

## Componentes

Todos os componentes UI estao em `src/components/ui/shadcn/` (56 componentes new-york-v4).

Primitivos: `radix-ui` | Variantes: `class-variance-authority` | Utilidades: `cn()` (clsx + tailwind-merge)

### Componentes chave

- **Card**: `data-slot="card"`, suporta `CardHeader`, `CardAction`, `CardFooter`
- **Button**: `variant` (default/outline/secondary/ghost/destructive/link) + `size` (default/sm/lg/icon)
- **Badge**: `variant` (default/secondary/destructive/outline)
- **Sidebar**: 726 linhas, colapsivel, responsivo com `useIsMobile()`
- **Chart**: Wrapper recharts com `ChartContainer`, `ChartTooltip`, `ChartLegend`
- **Table**: Composicao `Table` > `TableHeader` > `TableRow` > `TableCell`
- **Command**: Command palette via `cmdk`
- **Dialog/Sheet/Drawer**: Overlays

### Padroes visuais (shadcn dashboard)

- Container queries: `@container/card`, `@xl/main:grid-cols-2`
- Gradient overlay em cards: `bg-gradient-to-t from-primary/5 to-card`
- Descendant selectors: `*:data-[slot=card]:shadow-xs`
- Tabular nums: `tabular-nums` em valores numericos
- Line clamp: `line-clamp-1` para truncamento
- Muted foreground: `text-muted-foreground` para contexto secundario

---

## Shadows

```css
--shadow-sm:   0 1px 2px rgba(28, 25, 23, 0.07);
--shadow-md:   0 0 0 1px rgba(28, 25, 23, 0.07), 0 1px 3px rgba(28, 25, 23, 0.07);
--shadow-lg:   0 0 0 1px rgba(28, 25, 23, 0.07), 0 4px 12px rgba(28, 25, 23, 0.1);
--shadow-card: 0 0 0 1px rgba(28, 25, 23, 0.05), 0 1px 3px rgba(28, 25, 23, 0.05);
```

---

## Efeitos Visuais

- **Grain texture**: `body::after` com SVG fractal noise (opacity 0.032)
- **Spotlight amber**: `body::before` com radial-gradient oklch amber
- **Shimmer skeleton**: keyframe `shimmer` com gradiente animado
- **Reduced motion**: `prefers-reduced-motion` desabilita animacoes

---

## Border Radius

| Token | Value |
|-------|-------|
| `--radius-sm` | 3px |
| `--radius-md` | 6px |
| `--radius-lg` | 10px |
| `--radius-xl` | 14px |
| `--radius-full` | 9999px |
