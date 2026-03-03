---
description: Create a new React component following Northie design system
model: claude-sonnet-4-6
---

Create a new React component for the Northie frontend.

## Component Specification

$ARGUMENTS

## Northie Component Standards

### 1. **Stack**
- React 18 + TypeScript (strict, no `any`)
- Framer Motion for ALL micro-interactions
- Poppins for UI text, Geist Mono for numbers/data
- Base color: `#FCF8F8`, Text: `#1E1E1E`
- Easings: layout `[0.4, 0, 0.2, 1]`, fades `[0.25, 0.1, 0.25, 1]`

### 2. **Component Template**

```tsx
import { motion } from 'framer-motion'

interface Props {
  /** Description of prop */
  value: number
  /** Optional callback */
  onAction?: () => void
}

export function ComponentName({ value, onAction }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="..."
    >
      {/* Numbers always in Geist Mono */}
      <span style={{ fontFamily: 'Geist Mono' }}>
        {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </span>
    </motion.div>
  )
}
```

### 3. **Micro-interactions (required)**

```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.15 }}
>
  Action
</motion.button>
```

### 4. **Data Always Has Context**

Never show a number alone — always include comparativo, tendência ou significado:

```tsx
// Wrong
<span>R$ 45.000</span>

// Right
<span>R$ 45.000</span>
<span>+12% vs mês anterior</span>
```

### 5. **Numbers Format**

Always `pt-BR` locale:
```typescript
// Currency
value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Percentage
(value / 100).toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 1 })
```

### 6. **Checklist**
- [ ] TypeScript props interface
- [ ] Framer Motion on interactive elements
- [ ] Geist Mono for all numbers
- [ ] pt-BR number formatting
- [ ] Loading and empty states
- [ ] No hardcoded colors outside design system

## Output

Generate the complete component file ready to drop into `src/components/`.
