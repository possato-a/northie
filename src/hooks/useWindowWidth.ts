import { useState, useEffect } from 'react'

export function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return width
}

export const isMobile = (width: number) => width < 768
export const isTablet = (width: number) => width >= 768 && width < 1024
