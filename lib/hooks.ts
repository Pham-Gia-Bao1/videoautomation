import { useEffect } from 'react'
export function useTick(active: boolean, fn: () => void, ms = 120) {
  useEffect(() => {
    if (!active) return
    const t = setInterval(fn, ms)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ms])
}
