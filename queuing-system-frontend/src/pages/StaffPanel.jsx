import { departmentFor } from '../utils/departments'
import { useState, useEffect, useRef } from 'react'
import { announceStaffReady, handoffStaffWindow, openStaffMiniWindow, restoreStaffWindow, withStaffWindowLock } from '../utils/staffMiniWindow'
import { createStaffViewControl } from '../utils/staffViewControl'
import { attachMiniWindowDrag } from '../utils/staffMiniDrag'
import { callNextTicket, completeTicket, cancelTicket, getWaitingTickets, getCurrentStaffTicket, getCurrentStaffWindow, setAssignedWindowStatus, getStaffQueueHistory } from '../api'
import { getTicketNumber } from '../utils/queueNumber'

function isGuestCustomer(studentNumber) {
  const value = String(studentNumber ?? '').trim()
  return value === '' || value.toLowerCase() === 'guest'
}

function RecentActivity({ activities = [] }) {
  return (
    <details className="staff-recent-activity">
      <summary>Recent activity</summary>
      {activities.length === 0 ? <p>No recent activity.</p> : (
        <ul>{activities.map(log => (
          <li key={log.log_id}><span>{log.action}</span> <time>{new Date(log.created_at).toLocaleTimeString()}</time></li>
        ))}</ul>
      )}
    </details>
  )
}

function StaffPanel({ user, onLogout, logoutPending = false, logoutError = '' }) {
  const isRegistrarStaff = user.role === 'staff' && String(user.position || '').toLowerCase() === 'registrar'
  const hasWindowControls = isRegistrarStaff
  const [departmentAccessible, setDepartmentAccessible] = useState(false)
  const [currentTicket, setCurrentTicket] = useState(null)
  const [transaction, setTransaction] = useState(null)
  const [currentTicketLoading, setCurrentTicketLoading] = useState(true)
  const [waitingCount, setWaitingCount] = useState(0)
  const [waitingTickets, setWaitingTickets] = useState([])
  const [message, setMessage] = useState('')
  const [activeAction, setActiveAction] = useState(null)
  const [windowStatus, setWindowStatus] = useState(null)
  const [assignedWindow, setAssignedWindow] = useState(null)
  const [windowStatusLoading, setWindowStatusLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [duration, setDuration] = useState(0)
  const actionLockRef = useRef(false)
  const refreshInFlightRef = useRef(false)
  const actionVersionRef = useRef(0)
  const miniTriggerRef = useRef(null)
  const miniDragHandleRef = useRef(null)
  const isMiniView = new URLSearchParams(window.location.search).get('view') === 'mini'
  const miniWindowRef = useRef(null)
  const refreshRef = useRef(null)
  const refreshControllerRef = useRef(null)
  const handoffCleanupRef = useRef(null)
  const handoffPendingRef = useRef(false)
  const [handoffPending, setHandoffPending] = useState(false)

  const [historyTransactions, setHistoryTransactions] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyPeriod, setHistoryPeriod] = useState('today')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [historySearchInput, setHistorySearchInput] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPerPage, setHistoryPerPage] = useState(10)
  const [historyPagination, setHistoryPagination] = useState({
    total: 0,
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    from: 0,
    to: 0,
  })
  const [historyError, setHistoryError] = useState('')

  const controlRef = useRef(null)
  const [operational, setOperational] = useState(false)

  useEffect(() => {
    const control = createStaffViewControl(window, user.user_id, isMiniView ? 'mini' : 'full', active => {
      setOperational(active)
      if (active) {
        setCurrentTicketLoading(true)
        setWindowStatusLoading(true)
        setMessage('')
      }
      if (!active) {
        actionVersionRef.current += 1
        refreshControllerRef.current?.abort()
      }
    })
    controlRef.current = control
    window.__staffActivate = () => control.claim()
    window.__staffPause = () => { handoffCleanupRef.current?.(); control.suspend() }
    window.__staffResume = () => control.resume()
    announceStaffReady(window, { staffId: user.user_id, mode: isMiniView ? 'mini' : 'full', instanceId: control.id })
    return () => {
      handoffCleanupRef.current?.()
      refreshControllerRef.current?.abort()
      refreshInFlightRef.current = false
      delete window.__staffActivate
      delete window.__staffPause
      delete window.__staffResume
      delete window.__staffPresentationReady
      control.dispose()
      controlRef.current = null
    }
  }, [user.user_id, isMiniView])

  useEffect(() => { if (logoutError) setMessage(logoutError) }, [logoutError])

  const getWindowNumber = () => {
    if (assignedWindow?.window_number) {
      return Number(assignedWindow.window_number)
    }

    const staffMatch = user.username.match(/(\d+)/)
    return staffMatch ? Number(staffMatch[1]) : 1
  }

  const getWindowDisplay = () => {
    const windowNum = getWindowNumber()
    if (user.position === 'itm') return `Window ${windowNum}`
    return user.position === 'registrar' ? `Registrar Window ${windowNum}` : `Window ${windowNum}`
  }

  const getServiceLabel = () => {
    if (user.position === 'cashier') return 'Cashier Service'
    if (user.position === 'registrar') return 'Registrar Service'
    return `${departmentFor(user.position)?.name || 'Department'} Service`
  }

  const getServiceLabelShort = () => {
    if (user.position === 'cashier') return 'Cashier'
    if (user.position === 'registrar') return 'Registrar'
    return departmentFor(user.position)?.name || 'Department'
  }

  const sortWaitingTickets = (tickets = []) => [...tickets].sort((a, b) => {
    const priorityOrder = { P: 1, R: 2 }
    const aPriority = priorityOrder[a?.priority_type] ?? 99
    const bPriority = priorityOrder[b?.priority_type] ?? 99

    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }

    const aTime = new Date(a?.created_at || 0).getTime()
    const bTime = new Date(b?.created_at || 0).getTime()
    return aTime - bTime
  })

  const serviceType = departmentFor(user.position)?.type
  const positionLabel = departmentFor(user.position)?.name
  const currentDateLabel = currentTime.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const staffDisplayName = user?.full_name?.trim() || 'Staff Member'
  const orderedWaitingTickets = sortWaitingTickets(waitingTickets)

  useEffect(() => {
    if (!isMiniView || !miniDragHandleRef.current) return undefined
    return attachMiniWindowDrag(window, miniDragHandleRef.current)
  }, [isMiniView])

  const switchView = (mode) => {
    if (!controlRef.current?.active()) { miniWindowRef.current?.focus(); return }
    if (handoffPendingRef.current || actionLockRef.current) return
    // Keep window.open in the click stack, before any asynchronous work.
    const popup = mode === 'mini'
      ? openStaffMiniWindow(window, user.user_id, miniWindowRef.current)
      : restoreStaffWindow(window, user.user_id)
    if (!popup || popup.closed) {
      setMessage('Please allow popups for this site, then try again.')
      return
    }
    if (mode === 'mini') miniWindowRef.current = popup
    handoffPendingRef.current = true
    setHandoffPending(true)
    actionVersionRef.current += 1
    handoffCleanupRef.current = handoffStaffWindow(window, popup, user.user_id, mode, message => {
      handoffPendingRef.current = false
      setHandoffPending(false)
      miniWindowRef.current = null
      setMessage(message)
    }, instanceId => {
      controlRef.current?.transfer(instanceId, mode)
      handoffPendingRef.current = false
      setHandoffPending(false)
      setMessage(mode === 'mini' ? 'Mini View is active. This Staff view is paused.' : '')
    })
  }
  const openMiniView = () => switchView('mini')
  const restoreFullView = () => switchView('full')
  const closeMiniView = restoreFullView

  useEffect(() => {
    if (operational || isMiniView) return
    // Closed-window monitoring is coordination only, never Staff API polling.
    const timer = setInterval(() => {
      if (miniWindowRef.current?.closed) {
        miniWindowRef.current = null
        controlRef.current?.claim()
        setMessage('')
      }
    }, 500)
    return () => clearInterval(timer)
  }, [operational, isMiniView])

  const formatMiniWait = (createdAt) => {
    if (!createdAt) return 'Queued'
    const minutes = Math.max(0, Math.floor((currentTime.getTime() - new Date(createdAt).getTime()) / 60000))
    return `${minutes}m`
  }

  useEffect(() => {
    if (!operational) return
    setCurrentTime(new Date())
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [operational])

  useEffect(() => {
    if (!transaction) { setDuration(0); return }
    const updateDuration = () => {
      const start = new Date(transaction.start_time)
      setDuration(Math.floor((Date.now() - start.getTime()) / 1000))
    }
    updateDuration()
    if (!operational) return
    const tick = setInterval(updateDuration, 1000)
    return () => clearInterval(tick)
  }, [transaction, operational])

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}m ${s}s`
  }

  const fetchStaffHistory = async (overrides = {}) => {
    const period = overrides.period !== undefined ? overrides.period : historyPeriod
    const startDate = overrides.startDate !== undefined ? overrides.startDate : (period === 'custom' ? customStartDate : null)
    const endDate = overrides.endDate !== undefined ? overrides.endDate : (period === 'custom' ? customEndDate : null)
    const search = overrides.search !== undefined ? overrides.search : historySearch
    const page = overrides.page !== undefined ? overrides.page : historyPage
    const perPage = overrides.perPage !== undefined ? overrides.perPage : historyPerPage

    setHistoryLoading(true)
    setHistoryError('')
    try {
      const res = await getStaffQueueHistory({
        period,
        startDate,
        endDate,
        search,
        page,
        perPage,
      })
      if (res && Array.isArray(res.data)) {
        setHistoryTransactions(res.data)
        setHistoryPagination({
          total: Number(res.total ?? 0),
          currentPage: Number(res.current_page ?? page),
          lastPage: Number(res.last_page ?? 1),
          perPage: Number(res.per_page ?? perPage),
          from: Number(res.from ?? (res.data.length ? 1 : 0)),
          to: Number(res.to ?? res.data.length),
        })
      } else {
        setHistoryTransactions([])
      }
    } catch (err) {
      setHistoryError(err?.message || 'Failed to load queue history.')
    } finally {
      setHistoryLoading(false)
    }
  }

  const silentRefreshHistory = async () => {
    try {
      const res = await getStaffQueueHistory({
        period: historyPeriod,
        startDate: historyPeriod === 'custom' ? customStartDate : null,
        endDate: historyPeriod === 'custom' ? customEndDate : null,
        search: historySearch,
        page: historyPage,
        perPage: historyPerPage,
      })
      if (res && Array.isArray(res.data)) {
        setHistoryTransactions(res.data)
        setHistoryPagination({
          total: Number(res.total ?? 0),
          currentPage: Number(res.current_page ?? historyPage),
          lastPage: Number(res.last_page ?? 1),
          perPage: Number(res.per_page ?? historyPerPage),
          from: Number(res.from ?? (res.data.length ? 1 : 0)),
          to: Number(res.to ?? res.data.length),
        })
      }
    } catch {
      // Ignore background errors
    }
  }

  const refreshStaffData = async () => {
    if ((!controlRef.current?.active()) || refreshInFlightRef.current || actionLockRef.current) return
    refreshInFlightRef.current = true
    const controller = new AbortController()
    refreshControllerRef.current = controller
    const refreshVersion = actionVersionRef.current
    const windowParam = user.position === 'registrar' ? getWindowNumber() : null

    try {
      const [dataResult, currentResult, windowResult] = await Promise.allSettled([
        getWaitingTickets(serviceType, windowParam, user.position, controller.signal),
        getCurrentStaffTicket(controller.signal),
        getCurrentStaffWindow(controller.signal),
      ])

      if (controller.signal.aborted || actionLockRef.current || actionVersionRef.current !== refreshVersion) return
      if (dataResult.status === 'rejected') throw dataResult.reason
      if (currentResult.status === 'rejected') throw currentResult.reason

      const windowError = windowResult.status === 'rejected' ? windowResult.reason : null
      const missingItmWindow = String(user.position || '').toLowerCase() === 'itm'
        && windowError?.status === 403
        && /not assigned to a service window/i.test(windowError.message || '')
      if (windowError && !missingItmWindow) throw windowError

      setDepartmentAccessible(true)
      setCurrentTicket(currentResult.value.ticket || null)
      setTransaction(currentResult.value.transaction || null)
      if (windowResult.status === 'fulfilled') {
        const windowData = windowResult.value
        setAssignedWindow(windowData?.window_number ? windowData : null)
        setWindowStatus(String(windowData.status || (windowData.is_available ? 'open' : 'closed')).toLowerCase())
      } else {
        setAssignedWindow(null)
        setWindowStatus(null)
      }
      const list = Array.isArray(dataResult.value) ? dataResult.value : []
      setWaitingTickets(list)
      setWaitingCount(list.length)
      setCurrentTicketLoading(false)
      setWindowStatusLoading(false)
      setMessage(previous => previous === 'Request timed out. Please try again.' ? '' : previous)
      if (!isMiniView) {
        silentRefreshHistory()
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setDepartmentAccessible(false)
        setWaitingTickets([])
        setWaitingCount(0)
        setMessage(err?.message || 'Unable to restore staff state. Retrying...')
      }
    } finally {
      if (refreshControllerRef.current === controller) refreshInFlightRef.current = false
    }
  }

  refreshRef.current = refreshStaffData
  useEffect(() => {
    if (!operational) return
    refreshStaffData()
    const interval = setInterval(() => refreshRef.current?.(), 5000)
    const onFocus = () => refreshRef.current?.()
    const onQueueChange = event => {
      if (event.type !== 'storage' || event.key === 'queue-data-changed') refreshRef.current?.()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('queue-data-changed', onQueueChange)
    window.addEventListener('storage', onQueueChange)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('queue-data-changed', onQueueChange)
      window.removeEventListener('storage', onQueueChange)
      refreshControllerRef.current?.abort()
    }
  }, [serviceType, user.position, operational])

  useEffect(() => {
    if (!operational || isMiniView) return
    fetchStaffHistory()
  }, [operational, isMiniView, historyPeriod, historySearch, historyPage, historyPerPage])

  const handleWindowToggle = () => {
    if (!isRegistrarStaff) return

    return withStaffWindowLock(user.user_id, async () => {
      if (!isRegistrarStaff || !departmentAccessible || windowStatusLoading || !windowStatus || actionLockRef.current || handoffPendingRef.current || !controlRef.current?.active()) return
      actionLockRef.current = true
      actionVersionRef.current += 1
      const nextStatus = windowStatus === 'open' ? 'closed' : 'open'
      setWindowStatusLoading(true)
      setMessage('')
      try {
        const data = await setAssignedWindowStatus(nextStatus)
        const updatedStatus = String(data?.window?.status || data?.status || nextStatus).toLowerCase()
        setWindowStatus(updatedStatus)
        if (data?.window?.window_number) {
          setAssignedWindow(prev => ({ ...(prev || {}), window_number: Number(data.window.window_number), department: data.window.department || prev?.department, status: updatedStatus }))
        }
      } catch (err) {
        setMessage(err?.message || 'Unable to update window status.')
      } finally {
        actionLockRef.current = false
        setWindowStatusLoading(false)
      }
    })
  }

  const handleCallNext = () => withStaffWindowLock(user.user_id, async () => {
    if (!departmentAccessible || currentTicketLoading || currentTicket || actionLockRef.current || handoffPendingRef.current || !controlRef.current?.active()) return
    actionLockRef.current = true
    actionVersionRef.current += 1
    setActiveAction('call')
    setMessage('')
    try {
      const data = await callNextTicket(serviceType)
      if (data.ticket) {
        setCurrentTicket(data.ticket)
        setTransaction(data.transaction)
        const nextWaitingTickets = waitingTickets.filter(ticketItem => ticketItem.ticket_id !== data.ticket.ticket_id)
        setWaitingTickets(nextWaitingTickets)
        setWaitingCount(nextWaitingTickets.length)
        if (!isMiniView) fetchStaffHistory()
      } else {
        setMessage(data.message || 'Unable to call the next ticket. Please try again.')
        setCurrentTicket(null)
        setTransaction(null)
      }
    } catch (err) {
      setMessage(err?.message || 'Unable to call the next ticket. Please try again.')
    } finally {
      actionLockRef.current = false
      setActiveAction(null)
    }
  })

  const handleComplete = () => withStaffWindowLock(user.user_id, async () => {
    if (!departmentAccessible || currentTicketLoading || !currentTicket || actionLockRef.current || handoffPendingRef.current || !controlRef.current?.active()) return
    actionLockRef.current = true
    actionVersionRef.current += 1
    setActiveAction('complete')
    setMessage('')
    try {
      const data = await completeTicket(currentTicket.ticket_id)
      if (data.ticket) {
        setCurrentTicket(null)
        setTransaction(null)
        if (!isMiniView) fetchStaffHistory()
      } else {
        setMessage(data.message || 'Error completing ticket')
      }
    } catch (err) {
      setMessage(err?.message || 'Error completing ticket')
    } finally {
      actionLockRef.current = false
      setActiveAction(null)
    }
  })

  const handleCancel = () => withStaffWindowLock(user.user_id, async () => {
    if (!departmentAccessible || currentTicketLoading || !currentTicket || actionLockRef.current || handoffPendingRef.current || !controlRef.current?.active()) return
    actionLockRef.current = true
    actionVersionRef.current += 1
    setActiveAction('cancel')
    setMessage('')
    try {
      const data = await cancelTicket(currentTicket.ticket_id)
      if (data.ticket) {
        setCurrentTicket(null)
        setTransaction(null)
        if (!isMiniView) fetchStaffHistory()
      } else {
        setMessage(data.message || 'Unable to mark the ticket as no show.')
      }
    } catch (err) {
      setMessage(err?.message || 'Unable to mark the ticket as no show.')
    } finally {
      actionLockRef.current = false
      setActiveAction(null)
    }
  })

  return (
    <div className={isMiniView ? 'staff-mini-stage staff-mini-window' : 'staff-page'}>
      <>
          <header className="kiosk-app-header kiosk-app-branding" style={isMiniView ? { display: 'none' } : undefined}>
        <div className="kiosk-brand-group kiosk-brand-centered">
          <div className="kiosk-brand-logo">
            <img src="/loa-logo.png" alt="Lyceum logo" />
          </div>
          <div className="kiosk-brand-copy">
            <span className="kiosk-brand-name">LYCEUM OF ALABANG</span>
            <span className="kiosk-brand-tag">QUEUE MANAGEMENT SYSTEM</span>
          </div>
        </div>
      </header>

      <div className="staff-shell" style={isMiniView ? { display: 'none' } : undefined}>
        <section className="staff-user-bar" aria-label="Logged-in staff information">
          <div className="staff-user-welcome">
            <h1>Welcome, {staffDisplayName}</h1>
            <p>{positionLabel}</p>
          </div>
          <div className="staff-header-actions">
            {hasWindowControls && (
              <div className="staff-window-control" aria-label={`${getWindowDisplay()} status and controls`}>
                <div className="staff-window-status-copy">
                  <span className="staff-window-status-label">Window Status</span>
                  <span className={`staff-window-status-value ${windowStatus === 'closed' ? 'is-closed' : 'is-open'}`}>
                    <span className="status-dot" />
                    {windowStatusLoading ? 'Checking' : windowStatus === 'open' ? 'Open' : 'Closed'}
                  </span>
                </div>
                <button
                  type="button"
                  className={`staff-window-toggle ${windowStatus === 'closed' ? 'is-closed' : 'is-open'}`}
                  onClick={handleWindowToggle}
                  disabled={!departmentAccessible || !operational || handoffPending || windowStatusLoading || !windowStatus}
                  aria-label={`${windowStatus === 'open' ? 'Close' : 'Open'} ${getWindowDisplay()}`}
                >
                  {windowStatusLoading ? (windowStatus === 'closed' ? 'Opening...' : 'Closing...') : windowStatus === 'closed' ? 'Open Window' : 'Close Window'}
                </button>
              </div>
            )}
            <button ref={miniTriggerRef} type="button" className="staff-mini-link" onClick={openMiniView}>
              Mini View
            </button>
            <button className="staff-logout-btn" onClick={onLogout} disabled={logoutPending}>
              <span className="material-symbols-outlined">logout</span>
              {logoutPending ? 'Logging out?' : 'Logout'}
            </button>
          </div>
        </section>

        <div className="staff-dashboard-grid">
          <div className="staff-dashboard-left">
            <div className="staff-summary-card">
              <div className="staff-summary-section staff-stat-card">
                <div className="staff-stat-icon">
                  <span className="material-symbols-outlined">groups</span>
                </div>
                <div>
                  <div className="staff-stat-header">Waiting in Queue</div>
                  <div className="staff-stat-number">{waitingCount}</div>
                  <div className="staff-stat-sub">Customers</div>
                </div>
              </div>

              <div className="staff-summary-divider" aria-hidden="true" />

              <div className="staff-summary-section staff-stat-card">
                <div className="staff-stat-icon">
                  <span className="material-symbols-outlined">schedule</span>
                </div>
                <div>
                  <div className="staff-stat-header">Current Time</div>
                  <div className="staff-stat-number staff-stat-time">
                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="staff-stat-sub">{currentDateLabel}</div>
                </div>
              </div>
            </div>

            {message && (
              <div className="staff-message-banner">
                <span className="material-symbols-outlined">info</span>
                {message}
              </div>
            )}

            {!currentTicket ? (
              <div className="staff-ready-card">
                <div className="staff-ready-header">
                  <div className="staff-ready-icon">
                    <span className="material-symbols-outlined">confirmation_number</span>
                  </div>
                  <div className="staff-ready-title">{getWindowDisplay()} — Ready to Serve</div>
                </div>
                <p>{waitingCount} customer{waitingCount !== 1 ? 's' : ''} waiting</p>
                <button
                  className="staff-call-btn"
                  onClick={handleCallNext}
                  disabled={!departmentAccessible || !operational || handoffPending || currentTicketLoading || waitingCount === 0 || (['itm', 'admission'].includes(user.position) && windowStatus !== 'open')}
                >
                  <span className="material-symbols-outlined">notifications_active</span>
                  Call Next Ticket
                </button>
              </div>
            ) : (
              <div className="staff-serving-card">
                <div className="staff-serving-header">
                  <div className="staff-serving-label">Now Serving</div>
                  <span className={`staff-badge ${currentTicket.priority_type === 'P' ? 'badge-priority' : 'badge-regular'}`}>
                    {currentTicket.priority_type === 'P' ? 'PRIORITY' : 'REGULAR'}
                  </span>
                </div>

                <div className="staff-serving-main">
                  <div className="staff-serving-number">{getTicketNumber(currentTicket)}</div>
                  <div className="staff-serving-detail">{currentTicket.student_number || 'Guest'}</div>
                  <div className="staff-serving-detail muted">{getServiceLabel()}</div>
                </div>

                {transaction && (
                  <div className="staff-serving-meta">
                    <div className="staff-serving-meta-item">
                      <span className="staff-serving-meta-label">Started</span>
                      <span className="staff-serving-meta-value">
                        {new Date(transaction.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="staff-serving-meta-item">
                      <span className="staff-serving-meta-label">Duration</span>
                      <span className="staff-serving-meta-value">{formatDuration(duration)}</span>
                    </div>
                  </div>
                )}

                <div className="staff-serving-actions">
                  <button className="staff-complete-btn" onClick={handleComplete} disabled={!departmentAccessible || !operational || handoffPending || currentTicketLoading || activeAction !== null}>
                    <span className="material-symbols-outlined">check_circle</span>
                    {activeAction === 'complete' ? 'Completing...' : 'Complete'}
                  </button>
                  <button className="staff-cancel-btn" onClick={handleCancel} disabled={!departmentAccessible || !operational || handoffPending || currentTicketLoading || activeAction !== null}>
                    {activeAction === 'cancel' ? 'Skipping...' : 'Skip / No Show'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="staff-waiting-list-section">
          <div className="staff-waiting-header">
            <h3>Waiting Customers ({orderedWaitingTickets.length})</h3>
            <span className="staff-live-indicator">
              <span className="status-dot status-dot-online" />
              Real-Time Live Queue
            </span>
          </div>

          <div className="staff-waiting-table">
            <div className="staff-waiting-row staff-waiting-header-row">
              <span>#</span>
              <span>Ticket No.</span>
              <span>Customer</span>
              <span>Ticket Type</span>
              <span>Time in Queue</span>
            </div>

            {orderedWaitingTickets.length === 0 ? (
              <div className="staff-empty-row">
                <div className="staff-empty-state">
                  <span className="material-symbols-outlined">inbox</span>
                  <div>No customers waiting in queue right now.</div>
                  <small>The list will update automatically.</small>
                </div>
              </div>
            ) : (
              orderedWaitingTickets.map((t, idx) => (
                <div key={t.ticket_id || idx} className={`staff-waiting-row ${idx === 0 ? 'is-priority' : ''}`}>
                  <span className="staff-waiting-index">{idx + 1}</span>
                  <span className="staff-waiting-ticket">{getTicketNumber(t)}</span>
                  <span className="staff-waiting-customer">
                    <strong>{isGuestCustomer(t.student_number) ? 'Guest' : t.student_number}</strong>
                    {!isGuestCustomer(t.student_number) && <small>{`Student #: ${t.student_number}`}</small>}
                  </span>
                  <span>
                    <span className={`staff-badge ${t.priority_type === 'P' ? 'badge-priority' : 'badge-regular'}`}>
                      {t.priority_type === 'P' ? 'PRIORITY' : 'REGULAR'}
                    </span>
                  </span>
                  <span>
                    {t.created_at ? new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Queued'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

        <section className="staff-queue-history-section" aria-label="Queue History">
          <div className="staff-queue-history-header">
            <div className="staff-queue-history-title-group">
              <div className="staff-queue-history-title-icon">
                <span className="material-symbols-outlined">history</span>
              </div>
              <div>
                <h2 className="staff-queue-history-title">QUEUE HISTORY</h2>
                <p className="staff-queue-history-subtitle">
                  Your handled queue transactions
                </p>
              </div>
            </div>
            <button
              type="button"
              className="staff-history-refresh-btn"
              onClick={() => fetchStaffHistory()}
              disabled={historyLoading}
              title="Refresh queue history"
            >
              <span className={`material-symbols-outlined ${historyLoading ? 'spin-icon' : ''}`}>refresh</span>
              <span>Refresh</span>
            </button>
          </div>

          {historyError && (
            <div className="staff-history-error-banner">
              <span className="material-symbols-outlined">warning</span>
              <span>{historyError}</span>
              <button type="button" onClick={() => fetchStaffHistory()}>Retry</button>
            </div>
          )}

          <div className="staff-history-controls">
            <div className="staff-history-filters">
              <span className="staff-history-filter-label">Filter:</span>
              <div className="staff-history-pill-group">
                <button
                  type="button"
                  className={`staff-filter-pill ${historyPeriod === 'today' ? 'active' : ''}`}
                  onClick={() => { setHistoryPeriod('today'); setHistoryPage(1); }}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={`staff-filter-pill ${historyPeriod === 'week' ? 'active' : ''}`}
                  onClick={() => { setHistoryPeriod('week'); setHistoryPage(1); }}
                >
                  This Week
                </button>
                <button
                  type="button"
                  className={`staff-filter-pill ${historyPeriod === 'month' ? 'active' : ''}`}
                  onClick={() => { setHistoryPeriod('month'); setHistoryPage(1); }}
                >
                  This Month
                </button>
                <button
                  type="button"
                  className={`staff-filter-pill ${historyPeriod === 'custom' ? 'active' : ''}`}
                  onClick={() => { setHistoryPeriod('custom'); setHistoryPage(1); }}
                >
                  Custom Date
                </button>
              </div>

              {historyPeriod === 'custom' && (
                <form
                  className="staff-history-custom-dates"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setHistoryPage(1);
                    fetchStaffHistory({ period: 'custom', startDate: customStartDate, endDate: customEndDate, page: 1 });
                  }}
                >
                  <div className="staff-date-field">
                    <label htmlFor="staff-history-start">From:</label>
                    <input
                      id="staff-history-start"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="staff-date-input"
                    />
                  </div>
                  <div className="staff-date-field">
                    <label htmlFor="staff-history-end">To:</label>
                    <input
                      id="staff-history-end"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="staff-date-input"
                    />
                  </div>
                  <button type="submit" className="staff-date-apply-btn">
                    Apply
                  </button>
                </form>
              )}
            </div>

            <div className="staff-history-search-bar">
              <div className="staff-search-input-wrap">
                <span className="material-symbols-outlined staff-search-icon">search</span>
                <input
                  type="text"
                  placeholder="Search Queue # or Client Name..."
                  value={historySearchInput}
                  onChange={(e) => setHistorySearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setHistorySearch(historySearchInput.trim());
                      setHistoryPage(1);
                    }
                  }}
                  className="staff-search-input"
                  aria-label="Search by Queue number or client name"
                />
                {historySearchInput && (
                  <button
                    type="button"
                    className="staff-search-clear-btn"
                    onClick={() => {
                      setHistorySearchInput('');
                      setHistorySearch('');
                      setHistoryPage(1);
                    }}
                    aria-label="Clear search"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                className="staff-search-btn"
                onClick={() => {
                  setHistorySearch(historySearchInput.trim());
                  setHistoryPage(1);
                }}
              >
                Search
              </button>
            </div>
          </div>

          <div className="staff-history-table-container">
            <table className="staff-history-table">
              <thead>
                <tr>
                  <th>Queue Number</th>
                  <th>Student / Client Name</th>
                  <th>Department</th>
                  <th>Service / Transaction</th>
                  <th>Window Number</th>
                  <th>Date</th>
                  <th>Time Started</th>
                  <th>Time Completed</th>
                  <th>Waiting Time</th>
                  <th>Service Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr className="staff-history-loading-row">
                    <td colSpan="11">
                      <div className="staff-history-loading-state">
                        <span className="material-symbols-outlined spin-icon">sync</span>
                        <span>Loading queue history...</span>
                      </div>
                    </td>
                  </tr>
                ) : historyTransactions.length === 0 ? (
                  <tr className="staff-history-empty-row">
                    <td colSpan="11">
                      <div className="staff-history-empty-state">
                        <span className="material-symbols-outlined">inbox</span>
                        <strong>No queue history found</strong>
                        <p>
                          {historySearch
                            ? `No transactions matched "${historySearch}".`
                            : 'No transactions recorded for this period.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  historyTransactions.map((tx) => (
                    <tr key={tx.transaction_id || tx.ticket_id} className="staff-history-row">
                      <td className="staff-tx-queue-number">
                        <strong>{tx.queue_number}</strong>
                      </td>
                      <td className="staff-tx-client">
                        <div className="staff-client-name">{tx.student_name || '—'}</div>
                        {tx.student_number && tx.student_number !== 'Guest' && tx.student_number !== tx.student_name && (
                          <small className="staff-client-sub">{`ID: ${tx.student_number}`}</small>
                        )}
                      </td>
                      <td>{tx.department}</td>
                      <td>{tx.service}</td>
                      <td>
                        <span className="staff-window-badge">{tx.window_number}</span>
                      </td>
                      <td>{tx.date}</td>
                      <td>{tx.time_started}</td>
                      <td>{tx.time_completed}</td>
                      <td className="staff-tx-duration">{tx.waiting_time}</td>
                      <td className="staff-tx-duration">{tx.service_time}</td>
                      <td>
                        <span className={`staff-history-status-badge status-${String(tx.status || '').toLowerCase()}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="staff-history-pagination-bar">
            <div className="staff-pagination-info">
              {historyPagination.total > 0 ? (
                <>
                  Showing <strong>{historyPagination.from}</strong> to <strong>{historyPagination.to}</strong> of <strong>{historyPagination.total}</strong> transaction{historyPagination.total !== 1 ? 's' : ''}
                </>
              ) : (
                <span>0 transactions</span>
              )}
            </div>

            <div className="staff-pagination-actions">
              <div className="staff-per-page-select-wrap">
                <label htmlFor="staff-per-page">Rows:</label>
                <select
                  id="staff-per-page"
                  value={historyPerPage}
                  onChange={(e) => {
                    setHistoryPerPage(Number(e.target.value));
                    setHistoryPage(1);
                  }}
                  className="staff-per-page-select"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <button
                type="button"
                className="staff-pagination-nav-btn"
                disabled={historyPage <= 1 || historyLoading}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <span className="material-symbols-outlined">chevron_left</span>
                Prev
              </button>

              <span className="staff-pagination-page-indicator">
                Page <strong>{historyPagination.currentPage}</strong> of <strong>{Math.max(1, historyPagination.lastPage)}</strong>
              </span>

              <button
                type="button"
                className="staff-pagination-nav-btn"
                disabled={historyPage >= historyPagination.lastPage || historyLoading}
                onClick={() => setHistoryPage((p) => Math.min(historyPagination.lastPage, p + 1))}
                aria-label="Next page"
              >
                Next
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </section>
          </div>
      </>

      {!isMiniView && isRegistrarStaff && departmentAccessible && (
        <RecentActivity activities={assignedWindow?.recent_activity} />
      )}

      {isMiniView && (
        <aside
          className="staff-mini-panel"
          role="region"
          aria-label="Staff Mini View"
        >
          <div
            className="staff-mini-panel-header"
            title="Move this window using the browser title bar."
          >
            <img src="/loa-logo.png" alt="" className="staff-mini-logo" />
            <div className="staff-mini-identity">
              <strong>{staffDisplayName}</strong>
              <span>{positionLabel} <i className="staff-mini-online-dot" /> Online</span>
            </div>
            <div className="staff-mini-controls">
              <span ref={miniDragHandleRef} className="staff-mini-drag-handle" title="Drag to move this window" role="button" tabIndex="0" aria-label="Move Mini View window">⠿</span>
              <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={restoreFullView} title="Expand to full dashboard" aria-label="Expand to full dashboard">⛶</button>
              <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={onLogout} disabled={logoutPending} title="Log out" aria-label="Log out">↪</button>
              <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={closeMiniView} title="Close Mini View" aria-label="Close Mini View">×</button>
            </div>
          </div>

          <div className="staff-mini-panel-body">
            <div className="staff-mini-metrics">
              <div className="staff-mini-metric">
                <span>Waiting in Queue</span>
                <strong>{waitingCount}</strong>
                <small>Customers</small>
              </div>
              <div className="staff-mini-metric">
                <span>Current Time</span>
                <strong>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</strong>
                <small>{currentDateLabel}</small>
              </div>
            </div>

            {hasWindowControls && (
              <div className="staff-mini-window-status" aria-label={`${getWindowDisplay()} status and controls`}>
                <div className="staff-window-status-copy">
                  <span className="staff-window-status-label">Window Status</span>
                  <span className={`staff-window-status-value ${windowStatus === 'closed' ? 'is-closed' : 'is-open'}`}>
                    <span className="status-dot" />
                    {windowStatusLoading ? 'Checking' : windowStatus === 'open' ? 'Open' : 'Closed'}
                  </span>
                </div>
                <button
                  type="button"
                  className={`staff-window-toggle ${windowStatus === 'closed' ? 'is-closed' : 'is-open'}`}
                  onClick={handleWindowToggle}
                  disabled={!departmentAccessible || !operational || handoffPending || windowStatusLoading || !windowStatus}
                >
                  {windowStatusLoading ? (windowStatus === 'closed' ? 'Opening...' : 'Closing...') : windowStatus === 'closed' ? 'Open Window' : 'Close Window'}
                </button>
              </div>
            )}
            {message && <div className="staff-mini-error">{message}</div>}

            {!currentTicket ? (
              <div className="staff-mini-ready">
                <strong>{getWindowDisplay()} — Ready to Serve</strong>
                <span>{waitingCount} customer{waitingCount !== 1 ? 's' : ''} waiting</span>
                <button type="button" className="staff-call-btn" onClick={handleCallNext} disabled={!departmentAccessible || !operational || handoffPending || currentTicketLoading || waitingCount === 0 || (['itm', 'admission'].includes(user.position) && windowStatus !== 'open')}>
                  Call Next Ticket
                </button>
              </div>
            ) : (
              <div className="staff-mini-serving">
                <div className="staff-mini-serving-heading">
                  <strong>Now Serving</strong>
                  <span className={`staff-badge ${currentTicket.priority_type === 'P' ? 'badge-priority' : 'badge-regular'}`}>
                    {currentTicket.priority_type === 'P' ? 'PRIORITY' : 'REGULAR'}
                  </span>
                </div>
                <div className="staff-mini-ticket-number">{getTicketNumber(currentTicket)}</div>
                <div className="staff-mini-ticket-customer">{currentTicket.student_number || 'Guest'}</div>
                <div className="staff-mini-ticket-service">{getServiceLabel()} ? {getWindowDisplay()}</div>
                {transaction && (
                  <div className="staff-mini-serving-meta">
                    <span>Started <strong>{new Date(transaction.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                    <span>Duration <strong>{formatDuration(duration)}</strong></span>
                  </div>
                )}
                <div className="staff-mini-serving-actions">
                  <button type="button" className="staff-complete-btn" onClick={handleComplete} disabled={!departmentAccessible || !operational || handoffPending || currentTicketLoading || activeAction !== null}>
                    {activeAction === 'complete' ? 'Completing...' : 'Complete'}
                  </button>
                  <button type="button" className="staff-cancel-btn" onClick={handleCancel} disabled={!departmentAccessible || !operational || handoffPending || currentTicketLoading || activeAction !== null}>
                    {activeAction === 'cancel' ? 'Skipping...' : 'Skip / No Show'}
                  </button>
                </div>
              </div>
            )}

            <section className="staff-mini-waiting">
              <h2>Waiting Customers ({orderedWaitingTickets.length})</h2>
              <div className="staff-mini-waiting-list">
                {orderedWaitingTickets.length === 0 ? (
                  <div className="staff-mini-empty">No customers waiting.</div>
                ) : orderedWaitingTickets.map((ticketItem, index) => (
                  <div className="staff-mini-waiting-row" key={ticketItem.ticket_id || index}>
                    <span className="staff-mini-position">#{index + 1}</span>
                    <span className="staff-mini-waiting-person">
                      <strong>{getTicketNumber(ticketItem)}</strong>
                      <small>{isGuestCustomer(ticketItem.student_number) ? 'Guest' : ticketItem.student_number}</small>
                    </span>
                    <span className={`staff-badge ${ticketItem.priority_type === 'P' ? 'badge-priority' : 'badge-regular'}`}>
                      {ticketItem.priority_type === 'P' ? 'PRIORITY' : 'REGULAR'}
                    </span>
                    <span className="staff-mini-wait-time">{formatMiniWait(ticketItem.created_at)}</span>
                  </div>
                ))}
              </div>
            </section>
            {isRegistrarStaff && departmentAccessible && (
              <RecentActivity activities={assignedWindow?.recent_activity} />
            )}
          </div>
        </aside>
      )}
    </div>
  )
}

export default StaffPanel
