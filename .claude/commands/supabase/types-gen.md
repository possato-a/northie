---
description: Generate TypeScript types from Supabase database schema
model: claude-sonnet-4-6
---

Generate TypeScript types from the Supabase database schema.

## Command

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
```

Or for local Supabase:

```bash
npx supabase gen types typescript --local > src/types/database.types.ts
```

## Setup for Auto-Generation

### Add to package.json

```json
{
  "scripts": {
    "gen-types": "npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types/database.types.ts"
  }
}
```

## Usage in Code

```typescript
import type { Database } from '@/types/database.types'

// Extract table types
type Transaction = Database['public']['Tables']['transactions']['Row']
type TransactionInsert = Database['public']['Tables']['transactions']['Insert']

// Type-safe Supabase client
const supabase = createClient<Database>(url, key)

// Type-safe query
const { data } = await supabase
  .from('transactions')
  .select('*')
  .eq('user_id', profileId)
// data is typed as Transaction[]
```

## Utility Types

```typescript
// src/types/database.helpers.ts
import type { Database } from './database.types'

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

// Usage
type Customer = Tables<'customers'>
type AdMetric = Tables<'ad_metrics'>
```

## When to Regenerate

Run after:
- Creating new tables
- Adding/removing columns
- Changing column types
- Modifying enums

## Best Practices
- Commit generated types to git
- Run after every schema change
- Use in all Supabase queries — never use `any`
- Don't manually edit the generated file
