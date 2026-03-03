---
description: Create a new Supabase Edge Function with Deno
model: claude-sonnet-4-6
---

Create a new Supabase Edge Function.

## Function Specification

$ARGUMENTS

## Supabase Edge Functions Overview

Edge Functions run on Deno Deploy (not Node.js):
- TypeScript/JavaScript support
- Run globally at the edge
- Access to Supabase client
- HTTP triggers
- Fast cold starts

## Create Edge Function

### 1. **Initialize Function**

```bash
npx supabase functions new function-name
```

### 2. **Function Structure**

```typescript
// supabase/functions/function-name/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req: Request) => {
  try {
    const { data } = await req.json()

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const result = await processData(data, user)

    return new Response(JSON.stringify({ data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
```

### 3. **Testing Locally**

```bash
npx supabase start
npx supabase functions serve function-name

curl -X POST http://localhost:54321/functions/v1/function-name \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

### 4. **Deploy**

```bash
npx supabase functions deploy function-name
npx supabase secrets set API_KEY=your-secret-key
```

### 5. **Call from Frontend**

```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { key: 'value' }
})
```

### 6. **CORS Handler**

```typescript
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type'
      }
    })
  }
  // Handle request
})
```

Generate production-ready Edge Functions with proper error handling, authentication, and type safety.
