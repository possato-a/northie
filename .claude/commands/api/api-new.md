---
description: Create a new production-ready API endpoint in the Express backend
model: claude-sonnet-4-6
---

Create a new API endpoint for the Northie backend.

## Endpoint Specification

$ARGUMENTS

## Northie Backend Patterns

All endpoints live in `server/src/` following this structure:
- `routes/` — Express router definitions
- `controllers/` — Handler functions
- `services/` — Business logic

### 1. **Route Definition**

```typescript
// server/src/routes/example.routes.ts
import { Router } from 'express'
import { ExampleController } from '../controllers/example.controller'

const router = Router()
const controller = new ExampleController()

router.get('/', controller.getAll)
router.get('/:id', controller.getById)
router.post('/', controller.create)

export default router
```

### 2. **Controller**

```typescript
// server/src/controllers/example.controller.ts
import { Request, Response } from 'express'
import { ExampleService } from '../services/example.service'

export class ExampleController {
  private service = new ExampleService()

  getAll = async (req: Request, res: Response) => {
    try {
      const profileId = req.headers['x-profile-id'] as string
      if (!profileId) return res.status(401).json({ error: 'Unauthorized' })

      const data = await this.service.getAll(profileId)
      res.json({ data })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}
```

### 3. **Service**

```typescript
// server/src/services/example.service.ts
import { supabase } from '../lib/supabase'

export class ExampleService {
  async getAll(profileId: string) {
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('user_id', profileId)

    if (error) throw new Error(error.message)
    return data
  }
}
```

### 4. **Register Route in index.ts**

```typescript
import exampleRoutes from './routes/example.routes'
app.use('/api/example', exampleRoutes)
```

### 5. **Standards**
- Always validate `x-profile-id` header
- Use try/catch in all controllers
- Consistent response: `{ data }` for success, `{ error }` for failure
- Appropriate HTTP status codes: 200, 201, 400, 401, 404, 500
- Never expose stack traces in production

## Output

Generate all three files (route, controller, service) ready to use.
