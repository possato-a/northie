---
description: Run linting and fix code quality issues
model: claude-sonnet-4-6
---

Run linting and fix code quality issues in the codebase.

## Target

$ARGUMENTS

## Lint Strategy

### 1. **Run Linting Commands**

```bash
# TypeScript type check
npx tsc --noEmit

# ESLint
npm run lint

# Fix auto-fixable issues
npx eslint . --fix
```

### 2. **Common Issues**

**TypeScript**
- Missing type annotations
- `any` types used
- Unused variables
- Missing return types

**React/Next.js**
- Missing keys in lists
- Unsafe useEffect dependencies
- Missing alt text on images

**Code Quality**
- Unused imports
- Console.log statements left in
- TODO comments unresolved

### 3. **Priority Fixes**

**High** (fix immediately)
- Type errors blocking build
- Runtime errors
- Security vulnerabilities

**Medium** (fix before commit)
- Missing type annotations
- Unused variables
- Code style violations

**Low** (fix when convenient)
- Formatting inconsistencies
- Minor refactoring opportunities

### 4. **Auto-Fix**

```bash
# Fix formatting
npx prettier --write .

# Fix ESLint auto-fixable rules
npx eslint --fix .
```

### 5. **Common Fixes**

**Remove unused imports**
```typescript
// Before
import { A, B, C } from 'lib'
// B is unused

// After
import { A, C } from 'lib'
```

**Add type annotations**
```typescript
// Before
function process(data) {
  return data.map(x => x.value)
}

// After
function process(data: DataItem[]): number[] {
  return data.map(x => x.value)
}
```

## Output

1. **Lint Report** - All issues found
2. **Auto-Fix Results** - What was automatically fixed
3. **Manual Fix Suggestions** - Issues requiring intervention
4. **Priority List** - Ordered by severity
