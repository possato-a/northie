# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server at http://localhost:5173
npm run build     # type-check + production build
npm run preview   # preview production build
```

## Stack

- **React 18 + TypeScript** via Vite 6
- **Framer Motion** for all animations (micro-interactions, count-up, layout transitions)
- Fonts loaded from Google Fonts: **Poppins**, **Lora**, **Geist Mono**
- Colors: `#FCF8F8` (background) · `#1E1E1E` (text/icons)

## Structure

```
src/
  icons.tsx              # All SVG icons inlined as React components (fill="currentColor")
  components/
    Sidebar.tsx          # Collapsible sidebar with Framer Motion layout animation
    Dashboard.tsx        # KPI dashboard — DatePicker, AnimatedNumber, KpiCard
  App.tsx                # Root — sidebar state (collapsed, activePage), motion.main
  index.css              # Global reset only
svg-icons/               # Source SVG files (reference for any new icons)
```

## Architecture

- **Sidebar** is `position: fixed`, width animates between 70px (collapsed) and 250px via `motion.main`'s `marginLeft`.
- All icons use `fill="currentColor"` so opacity is controlled at the container level via Framer Motion `animate={{ opacity }}`.
- `AnimatedNumber` uses Framer Motion's `animate()` function (not a component) for count-up, formatted with `Intl.NumberFormat('pt-BR', ...)`.
- New pages: add a `Page` union type value in `Sidebar.tsx` and a nav entry in `mainNav` or `bottomNav`; handle rendering in `App.tsx`.

## Conventions

- All icon components live in `src/icons.tsx`; SVG paths are sourced from `svg-icons/`.
- Brazilian number format throughout (`pt-BR` locale).
- Easing: `[0.4, 0, 0.2, 1]` for layout transitions, `[0.25, 0.1, 0.25, 1]` for content fades.
