export function prepareStaffMiniWindow(host, staffId) {
  try {
    const popup = host.open('', `qms-staff-mini-${staffId}`,
      'popup=yes,width=480,height=760,resizable=no,scrollbars=yes,location=yes,toolbar=yes')
    popup?.focus()
    return popup
  } catch { return null }
}

export function isMiniStaffUser(user) {
  return String(user?.role || '').trim().toLowerCase() === 'staff'
    && ['cashier', 'registrar', 'itm', 'admission'].includes(String(user.position || '').trim().toLowerCase())
}

export function returnToStaffLogin(host) {
  const opener = host.opener && !host.opener.closed ? host.opener : null
  if (opener) {
    try {
      opener.postMessage({ type: 'STAFF_MINI_LOGOUT_COMPLETE', token: host.__staffLogoutToken }, host.location.origin)
      opener.focus()
      return opener
    } catch { /* The opener may no longer be reachable. */ }
  }

  try {
    const loginWindow = host.open(
      '/login',
      'qms-staff-login',
      'popup=yes,resizable=yes,scrollbars=yes,location=yes,toolbar=yes'
    )
    loginWindow?.focus()
    return loginWindow
  } catch { return null }
}

export function openStaffMiniWindow(host, staffId, existing) {
  try {
    if (existing && !existing.closed) { existing.focus(); return existing }
    const popup = host.open('/staff?view=mini', `qms-staff-mini-${staffId}`,
      'popup=yes,width=480,height=760,resizable=no,scrollbars=yes,location=yes,toolbar=yes')
    popup?.focus()
    return popup
  } catch { return null }
}

export function openStaffFullWindow(host, staffId) {
  try {
    // Full is a separate, script-created operational window. Never resize the
    // login window or reuse Mini's size. Size only this newly opened window.
    const screen = host.screen
    const width = screen?.availWidth || 1280
    const height = screen?.availHeight || 900
    const full = host.open('/staff', `qms-staff-full-${staffId}`,
      `popup=yes,width=${width},height=${height},left=${screen?.availLeft || 0},top=${screen?.availTop || 0},resizable=yes,scrollbars=yes,location=yes,toolbar=yes`)
    if (!full || full.closed) return null
    full.focus()
    return full
  } catch { return null }
}

export const restoreStaffWindow = openStaffFullWindow

export function isStaffOperationalWindow(host, staffId) {
  return host.name === `qms-staff-full-${staffId}` || host.name === `qms-staff-mini-${staffId}`
}

// Announce only mounted, authenticated presentation readiness; never queue data.
export function announceStaffReady(host, ready) {
  host.__staffPresentationReady = ready
  try { host.opener?.postMessage({ type: 'STAFF_READY', ...ready }, host.location.origin) } catch { /* Opener may already be gone. */ }
}

export function handoffStaffWindow(host, target, staffId, mode, onFailure, onReady) {
  let done = false
  const stop = () => {
    done = true
    clearTimeout(deadline)
    host.removeEventListener('message', receive)
  }
  const accept = ready => {
    if (done || target?.closed || ready?.staffId !== staffId || ready.mode !== mode) return
    stop()
    onReady?.(ready.instanceId)
    try { target.focus() } catch { /* Focus restrictions must not delay handoff. */ }
    if (isStaffOperationalWindow(host, staffId)) {
      try { host.close() } catch { /* Browser retains final control over closure. */ }
    }
  }
  const receive = event => {
    if (event.origin !== host.location.origin || event.source !== target || event.data?.type !== 'STAFF_READY') return
    // StrictMode can mount/clean up/remount before the queued message arrives.
    // Accept only the currently mounted instance, never the discarded first one.
    try {
      if (target.__staffPresentationReady?.instanceId === event.data.instanceId) accept(target.__staffPresentationReady)
    } catch { /* Target navigated away from our origin. */ }
  }
  // Failure deadline only: successful readiness never waits for a timer.
  const deadline = setTimeout(() => {
    stop()
    try { target?.close() } catch { /* Already closed. */ }
    onFailure('The Staff view could not initialize. Please try again.')
  }, 30000)
  host.addEventListener('message', receive)
  // Covers a reused window whose mount event arrived before this listener.
  try { accept(target?.__staffPresentationReady) } catch { /* Navigation still in progress. */ }
  return stop
}

export function withStaffWindowLock(staffId, action) {
  if (globalThis.navigator?.locks) {
    return navigator.locks.request(`qms-staff-action-${staffId}`, { ifAvailable: true },
      lock => lock ? action() : undefined)
  }
  return action()
}
