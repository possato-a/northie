---
description: Add authentication, authorization and security to API endpoints
model: claude-sonnet-4-6
---

Add security layers to the following API endpoint.

## Endpoint to Secure

$ARGUMENTS

## Security Layers

### 1. **Authentication** — Verify identity

```typescript
// Middleware: validate x-profile-id
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const profileId = req.headers['x-profile-id'] as string
  if (!profileId) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  req.profileId = profileId
  next()
}
```

### 2. **Authorization** — Verify ownership

```typescript
// Verify resource belongs to the requesting profile
const { data, error } = await supabase
  .from('transactions')
  .select('id')
  .eq('id', req.params.id)
  .eq('user_id', req.profileId)
  .single()

if (!data) return res.status(403).json({ error: 'Forbidden' })
```

### 3. **Input Validation** — Prevent injection

```typescript
import { z } from 'zod'

const schema = z.object({
  amount: z.number().positive(),
  platform: z.enum(['stripe', 'hotmart', 'shopify']),
  description: z.string().max(500).optional()
})

const result = schema.safeParse(req.body)
if (!result.success) {
  return res.status(400).json({ error: result.error.flatten() })
}
```

### 4. **Rate Limiting**

```typescript
import rateLimit from 'express-rate-limit'

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' }
})
```

### 5. **Supabase RLS** (Row Level Security)

```sql
-- Policy: users can only see their own data
CREATE POLICY "users_own_data" ON transactions
  FOR ALL USING (auth.uid() = user_id);
```

### 6. **Security Checklist**
- [ ] Auth header validated
- [ ] Resource ownership verified
- [ ] Input validated with Zod
- [ ] No sensitive data in error responses
- [ ] Rate limiting applied
- [ ] RLS policy exists for table

## Output

Provide the secured version of the endpoint with all layers applied.
