---
description: Clean up and refactor code to improve quality and reduce technical debt
model: claude-sonnet-4-6
---

Clean up and refactor the following code to improve quality.

## Code to Clean Up

$ARGUMENTS

## Cleanup Checklist

### 1. **Code Smells to Fix**
- Unclear or misleading names → rename to be descriptive
- Functions doing more than one thing → split by responsibility
- Duplicated logic → extract into shared utility
- Excessive complexity → simplify with early returns
- `any` types in TypeScript → replace with proper types

### 2. **Modern Patterns**
```typescript
// Optional chaining
const value = obj?.nested?.property

// Nullish coalescing
const result = value ?? 'default'

// Destructuring
const { name, email } = user

// Template literals
const message = `Hello, ${name}!`

// Functional array methods
const active = users.filter(u => u.active).map(u => u.name)
```

### 3. **Refactoring Techniques**

**Extract functions** for readability:
```typescript
// Before
if (user.role === 'admin' && user.active && user.verified) { ... }

// After
const canAccess = (user: User) => user.role === 'admin' && user.active && user.verified
if (canAccess(user)) { ... }
```

**Replace conditionals with object maps**:
```typescript
// Before
if (status === 'active') return 'green'
if (status === 'inactive') return 'red'
if (status === 'pending') return 'yellow'

// After
const statusColors = { active: 'green', inactive: 'red', pending: 'yellow' }
return statusColors[status]
```

### 4. **Common Cleanup Tasks**
- Remove unused imports and variables
- Add proper error handling
- Remove console.log statements
- Replace TODO comments with actual fixes
- Ensure consistent formatting

### 5. **React/Next.js Specific**
- Extract reusable logic into custom hooks
- Move server-side data fetching to Server Components
- Use proper loading and error states

## Output Format

1. **Issues Found** - List of problems identified
2. **Refactored Code** - Clean version with improvements
3. **Explanation** - What changed and why
4. **Before/After Comparison** - Key improvements highlighted
