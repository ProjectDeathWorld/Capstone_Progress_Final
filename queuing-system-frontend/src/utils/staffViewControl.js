// Presentation ownership only: never store tickets, transactions or credentials.
export function createStaffViewControl(host, staffId, mode, onChange) {
  const key = `qms-staff-view-${staffId}`
  const id = host.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
  const storage = host.localStorage
  let channel
  try { channel = host.BroadcastChannel ? new host.BroadcastChannel(key) : null } catch { channel = null }
  let disposed = false
  let suspended = false
  let lastActive
  const notify = value => { if (value !== lastActive) { lastActive = value; onChange(value) } }
  const read = () => {
    try { return JSON.parse(storage.getItem(key) || 'null') } catch { return null }
  }
  const active = () => !disposed && !suspended && read()?.id === id
  const sync = () => {
    if (disposed) return
    if (suspended) { notify(false); return }
    // A surviving Full tab takes over when the active Mini is closed.
    if (!read() && mode === 'full') claim()
    else notify(active())
  }
  const publish = owner => {
    storage.setItem(key, JSON.stringify(owner))
    notify(active())
    channel?.postMessage({ type: owner ? `${owner.mode.toUpperCase()}_ACTIVE` : 'MINI_CLOSED' })
  }
  const claim = () => publish({ id, mode })
  const onStorage = event => { if (event.key === key) sync() }
  const release = () => {
    if (read()?.id === id) publish(null)
  }
  const onPageHide = () => { release(); notify(false) }
  const onPageShow = () => { if (!read()) claim(); else sync() }
  channel && (channel.onmessage = sync)
  host.addEventListener('storage', onStorage)
  host.addEventListener('pagehide', onPageHide)
  host.addEventListener('pageshow', onPageShow)
  if (!read() || (mode === 'full' && !host.opener)) claim()
  else sync()
  return {
    id, active, claim,
    suspend() { suspended = true; notify(false) },
    resume() { suspended = false; sync() },
    ready() { channel?.postMessage({ type: `${mode.toUpperCase()}_READY`, id }) },
    transfer: (targetId, targetMode) => publish({ id: targetId, mode: targetMode }),
    dispose() {
      release()
      disposed = true
      channel?.close()
      host.removeEventListener('storage', onStorage)
      host.removeEventListener('pagehide', onPageHide)
      host.removeEventListener('pageshow', onPageShow)
    },
  }
}
