import { useEffect, useRef } from 'react'

// One cycle per page. Invalidations during a request are coalesced into one follow-up.
export function useAdminPolling(refresh, key, enabled = true, intervalMs = 10000) {
  const latest = useRef(refresh)
  latest.current = refresh
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let busy = false
    let pending = false
    const run = async (manual = false) => {
      if (controller.signal.aborted || document.hidden) return
      if (busy) { pending = true; return }
      busy = true
      try { await latest.current(controller.signal, manual === true) } catch { /* Retain valid data; retry next tick. */ }
      finally {
        busy = false
        if (pending && !controller.signal.aborted) { pending = false; run() }
      }
    }
    const tick = () => { if (!busy) run() }
    run(true)
    const timer = intervalMs ? setInterval(tick, intervalMs) : null
    document.addEventListener('visibilitychange', run)
    window.addEventListener('queue-data-changed', run)
    const onStorage = event => { if (event.key === 'queue-data-changed') run() }
    window.addEventListener('storage', onStorage)
    return () => {
      controller.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener('queue-data-changed', run)
      window.removeEventListener('storage', onStorage)
    }
  }, [key, enabled, intervalMs])
}

export const retainEqual = (previous, next) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next
