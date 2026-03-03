---
description: Generate tests for API endpoints
model: claude-sonnet-4-6
---

Generate comprehensive tests for the following API endpoint.

## Endpoint to Test

$ARGUMENTS

## Testing Strategy

### 1. **Test Structure**

```typescript
describe('POST /api/example', () => {
  describe('Success cases', () => {
    it('returns 200 with valid input', async () => { ... })
    it('creates resource and returns it', async () => { ... })
  })

  describe('Validation', () => {
    it('returns 400 when required field is missing', async () => { ... })
    it('returns 400 when field type is invalid', async () => { ... })
  })

  describe('Auth', () => {
    it('returns 401 when x-profile-id header is missing', async () => { ... })
    it('returns 403 when accessing another user\'s data', async () => { ... })
  })

  describe('Error handling', () => {
    it('returns 404 when resource not found', async () => { ... })
    it('returns 500 on unexpected error', async () => { ... })
  })
})
```

### 2. **Coverage Areas**

**Happy paths**
- Valid inputs return expected data and status
- Created resources are persisted correctly

**Validation**
- Missing required fields
- Wrong data types
- Out-of-range values
- Empty strings

**Auth**
- Missing auth header
- Invalid profile ID
- Accessing other user's resources

**Edge cases**
- Empty results (should return [] not null)
- Concurrent requests
- Large payloads

### 3. **Test Helpers**

```typescript
// Mock Supabase response
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: mockData, error: null })
      })
    })
  }
}))

// Request helper
const makeRequest = (overrides = {}) => ({
  headers: { 'x-profile-id': 'test-uuid' },
  body: { ...defaultBody, ...overrides }
})
```

### 4. **Test with curl**

```bash
# Success case
curl -X POST https://northie.vercel.app/api/example \
  -H "x-profile-id: YOUR_UUID" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'

# Missing auth
curl -X POST https://northie.vercel.app/api/example \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

## Output

Generate ready-to-run test file with all cases above, realistic mock data, and setup/teardown.
