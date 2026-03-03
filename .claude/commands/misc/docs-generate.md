---
description: Generate documentation for code, APIs, and components
model: claude-sonnet-4-6
---

Generate comprehensive documentation for the following.

## Target

$ARGUMENTS

## Documentation Strategy

### 1. **Code Documentation (JSDoc/TSDoc)**

```typescript
/**
 * Calculates the Capital Score for a founder based on financial metrics.
 *
 * @param profileId - The founder's profile UUID
 * @param period - Period to calculate (defaults to current month)
 * @returns Capital Score between 0-1000
 * @throws {NotFoundError} When profile does not exist
 *
 * @example
 * const score = await calculateCapitalScore('uuid-here')
 * console.log(score) // 750
 */
export async function calculateCapitalScore(profileId: string, period?: Date): Promise<number>
```

### 2. **API Documentation**

For each endpoint document:
- Method + path
- Authentication required
- Request body schema
- Response format
- Error codes
- curl example

```markdown
### POST /api/integrations/connect/:platform

Initiates OAuth flow for a platform integration.

**Auth**: Required (x-profile-id header)

**Params**: `platform` — one of: meta, google, stripe, hotmart, shopify

**Response 200**:
{ "authUrl": "https://..." }

**Response 400**:
{ "error": "Platform not supported" }
```

### 3. **Component Documentation**

```typescript
interface Props {
  /** Score value between 0-1000 */
  score: number
  /** Whether to show historical trend */
  showTrend?: boolean
  /** Callback when user requests card */
  onApply?: () => void
}
```

### 4. **README Sections**

When generating README content include:
- Project overview
- Features list
- Tech stack
- Installation steps
- Environment variables table
- Available scripts
- Project structure
- Deployment info

### 5. **Inline Comments**

Document *why*, not *what*:
```typescript
// Use sliding window instead of fixed period to avoid
// end-of-month spikes skewing the Capital Score
const revenueWindow = getLastNDays(90)
```

## Output Format

1. **JSDoc comments** for all exported functions
2. **README section** if applicable
3. **API spec** for endpoints
4. **Props interface** for components
5. **Usage examples** showing real scenarios
