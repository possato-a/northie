---
description: Create a new page following Northie layout and design patterns
model: claude-sonnet-4-6
---

Create a new page for the Northie frontend.

## Page Specification

$ARGUMENTS

## Northie Page Standards

### 1. **File Location**
Pages live in `src/pages/`. Each page is a single `.tsx` file exported as default.

### 2. **Page Template**

```tsx
import { motion } from 'framer-motion'
import { useState } from 'react'

export default function PageName() {
  const [loading, setLoading] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ padding: '32px' }}
    >
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'Poppins', fontSize: '24px', fontWeight: 600, color: '#1E1E1E' }}>
          Page Title
        </h1>
        <p style={{ fontFamily: 'Poppins', fontSize: '14px', color: '#666', marginTop: '4px' }}>
          Context description — what this page does for the founder
        </p>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {/* KpiCard components */}
      </div>

      {/* Main Content */}
      <div>
        {loading ? <LoadingState /> : <MainContent />}
      </div>
    </motion.div>
  )
}
```

### 3. **Register in App.tsx**

After creating the page, add to `src/App.tsx`:
```tsx
import PageName from './pages/PageName'

// In the page render logic:
{activePage === 'pagename' && <PageName />}
```

### 4. **Add to Sidebar**

Add navigation item in `src/components/layout/Sidebar.tsx`.

### 5. **Design Rules**
- Every metric needs context (trend, comparison, meaning)
- Empty states must be helpful — explain what will appear when data arrives
- Loading states use skeleton placeholders, not spinners
- Confirmation dialogs before any destructive action
- AnimatePresence for conditional content

### 6. **Data Fetching Pattern**

```tsx
useEffect(() => {
  const loadData = async () => {
    setLoading(true)
    try {
      const response = await api.get('/endpoint', {
        headers: { 'x-profile-id': profileId }
      })
      setData(response.data)
    } catch (err) {
      setError('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }
  loadData()
}, [profileId])
```

## Output

Generate the complete page file with proper structure, loading states, and empty states.
