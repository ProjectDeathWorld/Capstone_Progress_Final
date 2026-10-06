import { DEPARTMENTS, enabledDepartments, isHeadAdminUser, isDeptAdminUser, getDepartmentDisplayName } from '../utils/departments'
import { displayValue } from '../utils/adminDisplay'
import { useAdminPolling, retainEqual } from '../hooks/useAdminPolling'
import CompletedOfficeChart from '../components/CompletedOfficeChart'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDisplayBoardData } from '../hooks/useDisplayBoardData'
import CalendarDateRange from '../components/CalendarDateRange'
import { getStaffList, registerUser, updateStaff, deleteStaff, getServiceWindows, getDashboardAnalytics, getBusiestDayAnalytics, getDepartmentComparison, getPeakHours, getCustomersServed, getMonitoringData, getActivityLogs, getQueueHistory, getDisplayConfiguration, publishDisplayConfiguration, getPredictedWaitTimes, getPeakHourPredictions, getCongestionRisks, logout as apiLogout } from '../api'
import { DEFAULT_ANNOUNCEMENT_BACKGROUND_COLOR, DEFAULT_ANNOUNCEMENT_TEXT_COLOR, DEFAULT_DATE_TIME_TEXT_COLOR, DEFAULT_DISPLAY_BACKGROUND_COLOR, DEFAULT_DISPLAY_PANEL_COLORS, DEFAULT_NOW_SERVING_BACKGROUND_COLOR, DEFAULT_NOW_SERVING_TEXT_COLOR, DEFAULT_WAITING_QUEUE_COLORS, DEFAULT_WINDOW_TICKET_TEXT_COLOR, DISPLAY_FONT_OPTIONS, DISPLAY_LAYOUT_OPTIONS, DISPLAY_TEXT_SIZE_OPTIONS, ELEMENT_FONT_SIZE_OPTIONS, ELEMENT_FONT_WEIGHT_OPTIONS, DISPLAY_FONT_ELEMENTS, DEFAULT_DISPLAY_FONT_CONTROLS, getColorContrastRatio, getDefaultDisplayBoardConfig, getDisplayBoardConfig, getDisplayWindowOptions, saveDisplayBoardConfig } from '../utils/displayBoardConfig'
// TODO: fix these import paths to match where these components actually live in your project
import Analytics from './Analytics'
import Reports from './Reports'
import TVPreviewViewport from '../components/TVPreviewViewport'

function DisplayTextEditor({ displayConfig, displayWindowOptions, updateDisplayLabels, updateFontControl }) {
  return (
    <>
      <p>Edit board wording. Ticket numbers, counts, dates, and clock values remain live.</p>

      <fieldset className="display-text-group display-font-controls-group">
        <legend>Text Element Font Controls</legend>
        <p className="settings-field-hint" style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#64748b' }}>
          Choose a font family, size, and weight for each text element on the display board.
        </p>
        <div className="display-font-controls-list" style={{ display: 'grid', gap: '12px' }}>
          {DISPLAY_FONT_ELEMENTS.map(({ key, label }) => {
            const currentFont = displayConfig.settings.fontControls?.[key] || DEFAULT_DISPLAY_FONT_CONTROLS[key]
            return (
              <div
                key={key}
                className="display-font-control-card"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                  {label}
                </div>
                <div
                  className="display-font-selectors-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '10px',
                  }}
                >
                  <label className="settings-field" style={{ margin: 0 }}>
                    <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>Font Family</span>
                    <select
                      value={currentFont.fontFamily}
                      onChange={event => updateFontControl(key, 'fontFamily', event.target.value)}
                      aria-label={`${label} Font Family`}
                    >
                      {Object.entries(DISPLAY_FONT_OPTIONS).map(([val, opt]) => (
                        <option key={val} value={val}>{opt.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="settings-field" style={{ margin: 0 }}>
                    <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>Font Size</span>
                    <select
                      value={currentFont.fontSize}
                      onChange={event => updateFontControl(key, 'fontSize', event.target.value)}
                      aria-label={`${label} Font Size`}
                    >
                      {Object.entries(ELEMENT_FONT_SIZE_OPTIONS).map(([val, opt]) => (
                        <option key={val} value={val}>{opt.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="settings-field" style={{ margin: 0 }}>
                    <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>Font Weight</span>
                    <select
                      value={String(currentFont.fontWeight)}
                      onChange={event => updateFontControl(key, 'fontWeight', event.target.value)}
                      aria-label={`${label} Font Weight`}
                    >
                      {Object.entries(ELEMENT_FONT_WEIGHT_OPTIONS).map(([val, opt]) => (
                        <option key={val} value={val}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="display-text-group">
        <legend>General Display</legend>
        <div className="display-text-field-grid">
          {[
            ['nowServing', 'Now Serving heading'],
            ['window', 'Window label prefix'],
            ['waitingTicket', 'Singular waiting ticket label'],
            ['waiting', 'Department waiting label'],
            ['noWaitingTickets', 'No waiting tickets'],
          ].map(([key, label]) => (
            <label key={key} className="settings-field">
              <span>{label}</span>
              <input
                value={displayConfig.settings.displayLabels[key]}
                onChange={event => updateDisplayLabels(current => ({ ...current, [key]: event.target.value }))}
                aria-label={label}
                maxLength={50}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="display-text-group">
        <legend>Department Names</legend>
        <div className="display-text-field-grid">
          {Object.entries(displayConfig.settings.displayLabels.departmentNames).map(([department, name]) => (
            <label key={department} className="settings-field">
              <span>{department}</span>
              <input
                value={name}
                onChange={event => updateDisplayLabels(current => ({
                  ...current,
                  departmentNames: { ...current.departmentNames, [department]: event.target.value },
                }))}
                aria-label={`${department} display name`}
                maxLength={40}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="display-text-group">
        <legend>Window Labels</legend>
        <div className="display-text-field-grid">
          {displayWindowOptions.map(({ department, windowNumber }) => {
            const key = `${department}:${windowNumber}`
            const label = displayConfig.settings.displayLabels.windowLabels[key]
              ?? `${displayConfig.settings.displayLabels.window} ${windowNumber}`
            return (
              <label key={key} className="settings-field">
                <span>{displayConfig.settings.displayLabels.departmentNames[department]} Window {windowNumber}</span>
                <input
                  value={label}
                  onChange={event => updateDisplayLabels(current => ({
                    ...current,
                    windowLabels: { ...current.windowLabels, [key]: event.target.value },
                  }))}
                  aria-label={`${department} Window ${windowNumber} display label`}
                  maxLength={50}
                />
              </label>
            )
          })}
          {displayWindowOptions.length === 0 && <p className="display-text-empty">Turn on a department to edit its active window labels.</p>}
        </div>
      </fieldset>

    </>
  )
}

function AdminPanel({ user, initialPage = 'dashboard' }) {
  const isDeptAdmin = isDeptAdminUser(user)
  const userDeptName = user?.department || (user?.position ? (user.position.charAt(0).toUpperCase() + user.position.slice(1)) : 'Cashier')
  const deptDisplayName = getDepartmentDisplayName(userDeptName)
  const userDeptPosition = String(user?.position || (user?.department ? user.department.toLowerCase() : 'cashier')).toLowerCase()

  // BUG FIX: this state didn't exist before, so the menu buttons had nothing to control
  const [activePage, setActivePage] = useState(() => (isDeptAdmin && initialPage === 'settings' ? 'dashboard' : initialPage))
  const navigate = useNavigate()

  useEffect(() => {
    if (isDeptAdmin && activePage === 'settings') {
      setActivePage('dashboard')
    }
  }, [isDeptAdmin, activePage])

  const [staff, setStaff] = useState([])
  const [staffLoadState, setStaffLoadState] = useState('idle')
  const [cashierWaiting, setCashierWaiting] = useState(0)
  const [registrarWaiting, setRegistrarWaiting] = useState(0)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [staffSavingId, setStaffSavingId] = useState(null)
  const emptyUserForm = {
    username: '',
    password: '',
    password_confirmation: '',
    full_name: '',
    role: 'staff',
    position: isDeptAdmin ? userDeptPosition : 'cashier',
    status: 'active',
    assigned_window_id: '',
    service_scope: 'department',
    security_code: '',
    security_code_confirmation: ''
  }
  const [form, setForm] = useState(emptyUserForm)
  const [editForm, setEditForm] = useState({ username: '', full_name: '', role: 'staff', position: '', status: '', assigned_window_id: '', service_scope: 'department', password: '', password_confirmation: '', security_code: '', security_code_confirmation: '' })
  const [serviceWindows, setServiceWindows] = useState([])
  const [message, setMessage] = useState('')

  // Activity Logs & Queue History state
  const [liveLogs, setLiveLogs] = useState([])
  const [activityHistory, setActivityHistory] = useState([])
  const [activityDate, setActivityDate] = useState('')
  const [activityStartDate, setActivityStartDate] = useState('')
  const [activityEndDate, setActivityEndDate] = useState('')
  const [historyDate, setHistoryDate] = useState('')
  const [historyStartDate, setHistoryStartDate] = useState('')
  const [historyEndDate, setHistoryEndDate] = useState('')
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityError, setActivityError] = useState('')
  const [queueHistory, setQueueHistory] = useState([])
  const [activitySearch, setActivitySearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState('')
  const [busiestDay, setBusiestDay] = useState(null)
  const [busiestDayLoading, setBusiestDayLoading] = useState(false)
  const [busiestDayError, setBusiestDayError] = useState('')
  const [deptComparison, setDeptComparison] = useState(null)
  const [deptCompLoading, setDeptCompLoading] = useState(false)
  const [deptCompError, setDeptCompError] = useState('')
  const [deptCompPeriod, setDeptCompPeriod] = useState('today')
  const [deptCompStartDate, setDeptCompStartDate] = useState('')
  const [deptCompEndDate, setDeptCompEndDate] = useState('')

  // Peak Hours state
  const [peakHours, setPeakHours] = useState(null)
  const [peakHoursLoading, setPeakHoursLoading] = useState(false)
  const [peakHoursError, setPeakHoursError] = useState('')
  const [peakHoursPeriod, setPeakHoursPeriod] = useState('today')
  const [peakHoursStartDate, setPeakHoursStartDate] = useState('')
  const [peakHoursEndDate, setPeakHoursEndDate] = useState('')

  // Customers Served Per Day state
  const [customersServed, setCustomersServed] = useState(null)
  const [customersServedLoading, setCustomersServedLoading] = useState(false)
  const [customersServedError, setCustomersServedError] = useState('')
  const [customersServedPeriod, setCustomersServedPeriod] = useState('today')
  const [customersServedStartDate, setCustomersServedStartDate] = useState('')
  const [customersServedEndDate, setCustomersServedEndDate] = useState('')
  const { cashierTickets: previewCashierTickets, registrarTickets: previewRegistrarTickets, itmTickets: previewItmTickets, admissionTickets: previewAdmissionTickets, servingTickets: previewServingTickets } = useDisplayBoardData(activePage === 'settings')
  const previewScaleRef = useRef(null)
  const [previewScale, setPreviewScale] = useState(0)
  const [previewNow, setPreviewNow] = useState(new Date())
  const [displayConfig, setDisplayConfig] = useState(() => getDisplayBoardConfig())
  const displayConfigRef = useRef(displayConfig)
  const displayConfigEditedRef = useRef(false)
  const [publishedDisplayConfig, setPublishedDisplayConfig] = useState(() => getDisplayBoardConfig())
  const [displayStatus, setDisplayStatus] = useState('Up to date')
  const [displayPublishing, setDisplayPublishing] = useState(false)
  const departmentColors = displayConfig.settings.panelColors || DEFAULT_DISPLAY_PANEL_COLORS
  const displayWindowOptions = getDisplayWindowOptions(displayConfig)
  const activeDepartmentsList = enabledDepartments(displayConfig.settings)
  const evaluatedDepartmentNames = activeDepartmentsList.length > 0 ? activeDepartmentsList : Object.keys(DEFAULT_DISPLAY_PANEL_COLORS)
  const panelColorsAreReadable = evaluatedDepartmentNames.every((department) => {
    const defaults = DEFAULT_DISPLAY_PANEL_COLORS[department] || { background: '#10264d', text: '#ffffff' }
    const colors = departmentColors[department] || defaults
    return getColorContrastRatio(colors.text, colors.background) >= 4.5
  })
  const windowTicketTextColor = displayConfig.settings.windowTicketTextColor || DEFAULT_WINDOW_TICKET_TEXT_COLOR
  const windowTicketTextContrast = Math.min(...evaluatedDepartmentNames.map((department) => {
    const defaults = DEFAULT_DISPLAY_PANEL_COLORS[department] || { background: '#10264d', text: '#ffffff' }
    const colors = departmentColors[department] || defaults
    return getColorContrastRatio(windowTicketTextColor, colors.background)
  }))
  const windowTicketTextColorIsReadable = windowTicketTextContrast >= 4.5
  const announcementColorsAreReadable = getColorContrastRatio(
    displayConfig.settings.announcementTextColor,
    displayConfig.settings.accentColor,
  ) >= 4.5
  const waitingQueueColors = displayConfig.settings.waitingQueueColors || DEFAULT_WAITING_QUEUE_COLORS
  const waitingQueueColorsAreReadable = getColorContrastRatio(
    waitingQueueColors.text,
    waitingQueueColors.background,
  ) >= 4.5
  const solidBackground = displayConfig.settings.backgroundColor || DEFAULT_DISPLAY_BACKGROUND_COLOR
  const nowServingBackground = displayConfig.settings.nowServingBackgroundColor || DEFAULT_NOW_SERVING_BACKGROUND_COLOR
  const generalTextColorsAreReadable = getColorContrastRatio(displayConfig.settings.nowServingTextColor, nowServingBackground) >= 4.5
    && getColorContrastRatio(displayConfig.settings.dateTimeTextColor, solidBackground) >= 4.5

  const isValidHexColor = (value) => typeof value === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())

  const getPublishValidationReason = () => {
    if (activeDepartmentsList.length === 0) {
      return 'At least one department must be active before publishing.'
    }
    if (displayConfig.settings.backgroundType === 'solid' && !isValidHexColor(displayConfig.settings.backgroundColor || DEFAULT_DISPLAY_BACKGROUND_COLOR)) {
      return 'Main display background color must be a valid hex color code (e.g. #071b4d).'
    }
    if (!isValidHexColor(displayConfig.settings.nowServingBackgroundColor || DEFAULT_NOW_SERVING_BACKGROUND_COLOR)) {
      return 'Now Serving panel background color must be a valid hex color code.'
    }
    if (!isValidHexColor(displayConfig.settings.nowServingTextColor || DEFAULT_NOW_SERVING_TEXT_COLOR)) {
      return 'Now Serving text color must be a valid hex color code.'
    }
    if (!isValidHexColor(displayConfig.settings.dateTimeTextColor || DEFAULT_DATE_TIME_TEXT_COLOR)) {
      return 'Date/time text color must be a valid hex color code.'
    }
    if (!isValidHexColor(displayConfig.settings.windowTicketTextColor || DEFAULT_WINDOW_TICKET_TEXT_COLOR)) {
      return 'Window ticket number text color must be a valid hex color code.'
    }
    if (!isValidHexColor(displayConfig.settings.accentColor || DEFAULT_ANNOUNCEMENT_BACKGROUND_COLOR)) {
      return 'Announcement banner background color must be a valid hex color code.'
    }
    if (!isValidHexColor(displayConfig.settings.announcementTextColor || DEFAULT_ANNOUNCEMENT_TEXT_COLOR)) {
      return 'Announcement banner text color must be a valid hex color code.'
    }
    if (!isValidHexColor(waitingQueueColors.background || DEFAULT_WAITING_QUEUE_COLORS.background) || !isValidHexColor(waitingQueueColors.text || DEFAULT_WAITING_QUEUE_COLORS.text)) {
      return 'Waiting queue colors must be valid hex color codes.'
    }
    for (const [dept, defaults] of Object.entries(DEFAULT_DISPLAY_PANEL_COLORS)) {
      const colors = departmentColors[dept] || defaults
      if (!isValidHexColor(colors.background)) {
        return `${dept} window background color must be a valid hex color code.`
      }
      if (!isValidHexColor(colors.text)) {
        return `${dept} window text color must be a valid hex color code.`
      }
    }
    return null
  }

  const publishValidationReason = getPublishValidationReason()
  const [monitorSearch, setMonitorSearch] = useState('')
  const [monitorDepartmentFilter, setMonitorDepartmentFilter] = useState(() => isDeptAdmin ? userDeptName : 'All')
  const [monitorStatusFilter, setMonitorStatusFilter] = useState('All')
  const [monitorAutoRefresh, setMonitorAutoRefresh] = useState(true)
  const [staffSearch, setStaffSearch] = useState('')
  const [staffDepartmentFilter, setStaffDepartmentFilter] = useState(() => isDeptAdmin ? userDeptPosition : 'All')
  const [staffRoleFilter, setStaffRoleFilter] = useState('All')
  const [activityPeriod, setActivityPeriod] = useState('Today')
  const [activityActorFilter, setActivityActorFilter] = useState('All')
  const [selectedDepartment, setSelectedDepartment] = useState(() => isDeptAdmin ? userDeptName : 'Cashier')

  useEffect(() => {
    if (isDeptAdmin) {
      setMonitorDepartmentFilter(userDeptName)
      setStaffDepartmentFilter(userDeptPosition)
      setSelectedDepartment(userDeptName)
    }
  }, [isDeptAdmin, userDeptName, userDeptPosition])

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { id: 'monitoring', label: 'Monitoring', icon: 'monitor' },
    { id: 'analytics', label: 'Analytics', icon: 'monitoring' },
    { id: 'reports', label: 'Reports', icon: 'description' },
    { id: 'staff', label: 'Staff', icon: 'group' },
    ...(!isDeptAdmin ? [{ id: 'settings', label: 'Settings', icon: 'settings' }] : []),
    { id: 'activity', label: 'Activity Log', icon: 'history' },
  ]

  const sanitizeMonitoringWindows = (windows = []) => {
    if (!Array.isArray(windows)) return []

    return windows.filter((entry) => {
      const windowName = String(entry?.window ?? entry?.name ?? '').trim().toLowerCase()
      return windowName !== 'registrar 6'
    })
  }

  const normalizeMonitoringWindowDisplay = (name, department) => {
    const dept = String(department ?? '').trim()
    const raw = String(name ?? '').trim()

    if (/^window\s*\d+/i.test(raw)) return raw

    if (/registrar/i.test(dept) || /registrar/i.test(raw)) {
      const registrarNumber = raw.match(/(\d+)/)
      if (registrarNumber) {
        return `Window ${Number(registrarNumber[1]) + 8}`
      }
    }

    if (/cashier/i.test(dept) || /cashier/i.test(raw)) {
      const cashierNumber = raw.match(/(\d+)/)
      if (cashierNumber) {
        return `Window ${cashierNumber[1]}`
      }
    }

    if (/^window\s*\d+/i.test(raw)) {
      return raw.replace(/^window\s+/i, 'Window ')
    }

    return raw || 'Window'
  }

  const normalizeMonitoringWindows = (windows = []) => {
    if (!Array.isArray(windows)) return []

    return sanitizeMonitoringWindows(windows).map((entry) => {
      const department = String(entry?.department ?? '').trim() || 'Cashier'
      const displayWindow = normalizeMonitoringWindowDisplay(entry?.window ?? entry?.name ?? '', department)
      const rawStaffName = entry?.staffName
        || (entry?.staff && typeof entry.staff === 'object' ? (entry.staff.name || entry.staff.username) : entry?.staff)
        || ''
      const staffName = typeof rawStaffName === 'string' && rawStaffName.trim() ? rawStaffName.trim() : 'Unassigned'

      return {
        ...entry,
        department,
        window: displayWindow,
        status: entry?.status || 'Idle',
        staffName,
      }
    })
  }

  const [queueWindows, setQueueWindows] = useState([])

  const quickActions = [
    { id: 'analytics', label: 'Analytics', description: 'KPI monitoring' },
    { id: 'reports', label: 'Reports', description: 'Exportable summaries' },
    { id: 'monitoring', label: 'Queue Monitoring', description: 'Live windows' },
    { id: 'staff', label: 'Staff Management', description: 'Manage staff accounts' },
    ...(!isDeptAdmin ? [{ id: 'settings', label: 'Display Settings', description: 'Brand and theme' }] : []),
  ]

  const recentActivities = [
    { time: '09:30 AM', item: 'CS021 completed', detail: 'Cashier window 1' },
    { time: '09:28 AM', item: 'RT014 called', detail: 'Registrar 2' },
    { time: '09:26 AM', item: 'Window 2 logged in', detail: 'Cashier team' },
  ]

  const activityLogs = [
    { actor: 'Administrator', action: 'Logged in', time: '09:30 AM' },
    { actor: 'Cashier Window 2', action: 'Completed CS021', time: '09:35 AM' },
    { actor: 'Registrar 2', action: 'Called RT014', time: '09:40 AM' },
  ]

  const todayIso = new Date().toISOString().slice(0, 10)
  const [selectedStartDate, setSelectedStartDate] = useState(todayIso)
  const [selectedEndDate, setSelectedEndDate] = useState(todayIso)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const [predictions, setPredictions] = useState([])
  const [predictionsLoading, setPredictionsLoading] = useState(false)
  const [predictionsError, setPredictionsError] = useState('')
  const [peakPredictions, setPeakPredictions] = useState([])
  const [peakPredictionsLoading, setPeakPredictionsLoading] = useState(false)
  const [peakPredictionsError, setPeakPredictionsError] = useState('')
  const [congestionRisks, setCongestionRisks] = useState([])
  const [congestionLoading, setCongestionLoading] = useState(false)
  const [congestionError, setCongestionError] = useState('')
  const dashboardRequestInFlightRef = useRef(false)
  const dashboardAnalyticsInFlightRef = useRef(false)
  const dashboardMountedRef = useRef(true)
  const [dateRangeOpen, setDateRangeOpen] = useState(false)
  const [dateRangeDraftStart, setDateRangeDraftStart] = useState(todayIso)
  const [dateRangeDraftEnd, setDateRangeDraftEnd] = useState(todayIso)

  const formatDisplayDate = (dateValue) => {
    if (!dateValue) return ''
    return new Date(`${dateValue}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatRangeLabel = (startDateValue = selectedStartDate, endDateValue = selectedEndDate) => {
    const start = startDateValue || todayIso
    const end = endDateValue || start
    if (!start || !end) {
      return 'Select date range'
    }
    const rangeStart = formatDisplayDate(start)
    const rangeEnd = formatDisplayDate(end)
    return rangeStart === rangeEnd ? rangeStart : `${rangeStart} – ${rangeEnd}`
  }

  const applySelectedDateRange = () => {
    const startRaw = dateRangeDraftStart || todayIso
    const endRaw = dateRangeDraftEnd || startRaw
    const normalizedStart = startRaw <= endRaw ? startRaw : endRaw
    const normalizedEnd = startRaw <= endRaw ? endRaw : startRaw

    setDashboardError('')
    setDashboardLoading(true)
    setSelectedStartDate(normalizedStart)
    setSelectedEndDate(normalizedEnd)
    setDateRangeOpen(false)
  }

  useEffect(() => {
    setDateRangeDraftStart(selectedStartDate || todayIso)
    setDateRangeDraftEnd(selectedEndDate || selectedStartDate || todayIso)
  }, [selectedStartDate, selectedEndDate])

  const computePeriodParams = (startDateValue = selectedStartDate, endDateValue = selectedEndDate) => {
    const normalizedStart = startDateValue || endDateValue || todayIso
    const normalizedEnd = endDateValue || normalizedStart

    if (normalizedStart === normalizedEnd && normalizedStart === todayIso) {
      return { period: 'today', startDate: normalizedStart, endDate: normalizedEnd }
    }

    return { period: 'custom', startDate: normalizedStart, endDate: normalizedEnd }
  }

  const loadDashboardData = async (isInitial = false, signal = null) => {
    dashboardRequestInFlightRef.current = true

    const { period, startDate, endDate } = computePeriodParams(selectedStartDate, selectedEndDate)

    if (isInitial) {
      setDashboardLoading(true)
    }

    try {
      const requests = [
        () => getDashboardAnalytics(period, startDate, endDate, isDeptAdmin ? userDeptName : null, signal),
        () => getMonitoringData(isDeptAdmin ? userDeptName : null, signal),
        () => getPredictedWaitTimes(isDeptAdmin ? userDeptName : null, signal),
        () => getPeakHourPredictions(isDeptAdmin ? userDeptName : null, signal),
        () => getCongestionRisks(isDeptAdmin ? userDeptName : null, signal),
      ]
      // A synchronous request setup failure should not prevent the other live
      // dashboard responses from being applied.
      const results = await Promise.allSettled(
        requests.map((request) => Promise.resolve().then(request)),
      )

      if (!dashboardMountedRef.current || signal?.aborted) return

      const valueOf = (index) => results[index].status === 'fulfilled' ? results[index].value : null
      const dashData = valueOf(0)
      const monitoringData = valueOf(1)
      const predictionData = valueOf(2)
      const peakData = valueOf(3)
      const congestionData = valueOf(4)
      if (Array.isArray(monitoringData)) setQueueWindows(previous => retainEqual(previous, normalizeMonitoringWindows(monitoringData)))
      if (dashData && typeof dashData === 'object') setAnalytics(previous => retainEqual(previous, dashData))
      if (predictionData && (Array.isArray(predictionData?.predictions) || Array.isArray(predictionData?.data))) {
        const list = Array.isArray(predictionData.predictions) ? predictionData.predictions : predictionData.data
        setPredictions(previous => retainEqual(previous, list))
        setPredictionsError('')
      } else if (results[2].status === 'rejected') {
        setPredictionsError('Failed to load predictions')
      }
      if (peakData && (Array.isArray(peakData?.peak_predictions) || Array.isArray(peakData?.predictions) || Array.isArray(peakData?.data))) {
        const peakList = Array.isArray(peakData.peak_predictions)
          ? peakData.peak_predictions
          : (Array.isArray(peakData.predictions) ? peakData.predictions : peakData.data)
        setPeakPredictions(previous => retainEqual(previous, peakList))
        setPeakPredictionsError('')
      } else if (results[3]?.status === 'rejected') {
        setPeakPredictionsError('Failed to load peak predictions')
      }
      if (congestionData && (Array.isArray(congestionData?.congestion_predictions) || Array.isArray(congestionData?.predictions) || Array.isArray(congestionData?.data))) {
        const congList = Array.isArray(congestionData.congestion_predictions)
          ? congestionData.congestion_predictions
          : (Array.isArray(congestionData.predictions) ? congestionData.predictions : congestionData.data)
        setCongestionRisks(previous => retainEqual(previous, congList))
        setCongestionError('')
      } else if (results[4]?.status === 'rejected') {
        setCongestionError('Failed to load congestion risk data')
      }
      if (Array.isArray(monitoringData)) {
        setCashierWaiting(monitoringData.find(row => row.department === 'Cashier')?.department_waiting ?? 0)
        setRegistrarWaiting(monitoringData.find(row => row.department === 'Registrar')?.department_waiting ?? 0)
      }

      const failedRequests = results
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => result.status === 'rejected')

      failedRequests.forEach(({ result, index }) => {
        console.error(`Dashboard request ${index + 1} failed:`, result.reason)
      })

      if (failedRequests.some(({ result }) => result.reason?.status === 401)) {
        sessionStorage.removeItem('token')
        navigate('/login')
        return
      }

      if (isInitial || !failedRequests.length) setDashboardError(failedRequests.length ? 'Unable to load current data.' : '')
    } catch (err) {
      console.error('Failed to fetch dashboard data', err)
      if (isInitial && dashboardMountedRef.current && !signal?.aborted) {
        setDashboardError(`Dashboard update error: ${err?.message || 'Unknown frontend error'}`)
      }
    } finally {
      dashboardRequestInFlightRef.current = false
      if (dashboardMountedRef.current) {
        setDashboardLoading(false)
      }
    }
  }

  const loadDashboardAnalyticsData = async (signal = null) => {
    dashboardAnalyticsInFlightRef.current = true
    const { period, startDate, endDate } = computePeriodParams(selectedStartDate, selectedEndDate)

    try {
      const results = await Promise.allSettled([
        getPeakHours('today', null, null, null, signal),
        getQueueHistory(period, startDate, endDate, signal),
        getStaffList(signal),
        getDepartmentComparison(period, startDate, endDate, null, signal),
        getCustomersServed(period, startDate, endDate, null, signal),
        getActivityLogs(signal),
      ])
      if (!dashboardMountedRef.current || signal?.aborted) return

      const valueOf = (index) => results[index].status === 'fulfilled' ? results[index].value : null
      const peakData = valueOf(0)
      const historyData = valueOf(1)
      const staffData = valueOf(2)
      const deptData = valueOf(3)
      const servedData = valueOf(4)
      const logsData = valueOf(5)
      setPeakHours(previous => retainEqual(previous, peakData && typeof peakData === 'object' ? peakData : null))
      if (Array.isArray(historyData)) setQueueHistory(previous => retainEqual(previous, historyData))
      if (Array.isArray(staffData)) setStaff(previous => retainEqual(previous, staffData))
      if (Array.isArray(deptData)) setDeptComparison(previous => retainEqual(previous, deptData))
      if (servedData && typeof servedData === 'object') setCustomersServed(previous => retainEqual(previous, servedData))
      if (Array.isArray(logsData)) setLiveLogs(previous => retainEqual(previous, logsData))

      results.forEach((result, index) => {
        if (result.status === 'rejected' && result.reason?.name !== 'AbortError') {
          console.error(`Dashboard analytics request ${index + 1} failed:`, result.reason)
        }
      })
      if (results.some(result => result.status === 'rejected' && result.reason?.status === 401)) {
        sessionStorage.removeItem('token')
        navigate('/login')
      }
    } finally {
      dashboardAnalyticsInFlightRef.current = false
      if (dashboardMountedRef.current) {
        setAnalyticsLoading(false)
        setBusiestDayLoading(false)
        setDeptCompLoading(false)
        setPeakHoursLoading(false)
        setCustomersServedLoading(false)
      }
    }
  }

  useAdminPolling(async signal => {
    if (activePage === 'monitoring') {
      const data = await getMonitoringData(isDeptAdmin ? userDeptName : (monitorDepartmentFilter !== 'All' ? monitorDepartmentFilter : null), signal)
      if (!signal.aborted && Array.isArray(data)) {
        setQueueWindows(previous => retainEqual(previous, normalizeMonitoringWindows(data)))
        setCashierWaiting(data.find(row => row.department === 'Cashier')?.department_waiting ?? 0)
        setRegistrarWaiting(data.find(row => row.department === 'Registrar')?.department_waiting ?? 0)
      }
    } else {
      await Promise.allSettled([loadDashboardData(false, signal), loadDashboardAnalyticsData(signal)])
    }
  }, `${activePage}:${selectedStartDate}:${selectedEndDate}`, ['dashboard', 'monitoring'].includes(activePage), activePage === 'monitoring' && !monitorAutoRefresh ? 0 : 10000)

  useAdminPolling(async signal => {
    setActivityLoading(true)
    const results = await Promise.allSettled([
      getActivityLogs(signal, activityDate, activityStartDate || null, activityEndDate || null),
      getQueueHistory(historyStartDate ? 'custom' : (historyDate ? 'custom' : 'today'), historyStartDate || historyDate || null, historyEndDate || historyDate || null, signal),
    ])
    if (signal.aborted) return
    if (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) {
      setLiveLogs(previous => retainEqual(previous, results[0].value))
    }
    if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) {
      setActivityHistory(previous => retainEqual(previous, results[1].value))
    }
    setActivityError(results.some(result => result.status === 'rejected' || !Array.isArray(result.value))
      ? 'Unable to refresh activity logs or queue history. Retrying automatically.' : '')
    setActivityLoading(false)
  }, `activity:${activityDate}:${activityStartDate}:${activityEndDate}:${historyDate}:${historyStartDate}:${historyEndDate}`, activePage === 'activity', 10000)

  useEffect(() => {
    dashboardMountedRef.current = true
    return () => {
      dashboardMountedRef.current = false
    }
  }, [])

  const loadStaffData = async () => {
    setStaffLoadState('loading')
    setMessage('')
    try {
      const data = await getStaffList()
      const records = Array.isArray(data)
        ? data
        : Array.isArray(data?.staff)
          ? data.staff
          : Array.isArray(data?.users)
            ? data.users
            : null

      if (!records) throw new Error('Unexpected staff response format')

      const normalizedStaff = records.filter((record) => {
        const role = String(record?.role || '').trim().toLowerCase()
        const position = String(record?.position || '').trim().toLowerCase()
        return role === 'security' || role === 'dept_admin' || (role === 'staff' && ['cashier', 'registrar', 'itm', 'admission'].includes(position))
      })

      setStaff(normalizedStaff)
      setStaffLoadState('success')
    } catch (err) {
      console.error('Failed to load staff records', err)
      setStaffLoadState('error')
      setMessage('Unable to load staff records.')
    }
  }

  useEffect(() => {
    if (activePage === 'staff') {
      loadStaffData()
      getServiceWindows().then(data => setServiceWindows(Array.isArray(data) ? data : data.windows || [])).catch(() => setServiceWindows([]))
    }
  }, [activePage])

  useEffect(() => {
    if (activePage !== 'settings') return
    const controller = new AbortController()
    getDisplayConfiguration(controller.signal).then((data) => {
      const defaults = getDefaultDisplayBoardConfig()
      const loaded = {
        settings: { ...defaults.settings, ...(data?.settings || {}) },
        windows: Array.isArray(data?.windows) && data.windows.length ? data.windows : defaults.windows.map(window => ({ ...window, staffName: '' })),
      }
      if (displayConfigEditedRef.current) return
      const normalized = saveDisplayBoardConfig(loaded)
      displayConfigRef.current = normalized
      setDisplayConfig(normalized)
      setPublishedDisplayConfig(normalized)
      setDisplayStatus('Up to date')
    }).catch((err) => {
      if (err?.name !== 'AbortError') setDisplayStatus('Unable to load published settings. Using the last local copy.')
    })
    return () => controller.abort()
  }, [activePage])

  useEffect(() => {
    const interval = setInterval(() => setPreviewNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (activePage !== 'settings') return undefined
    const frame = previewScaleRef.current
    if (!frame) return undefined
    let animationFrame
    const updateScale = () => {
      const width = Math.max(0, frame.clientWidth)
      const availableHeight = Math.max(0, frame.clientHeight)
      setPreviewScale(Math.max(0, Math.min(width / 1920, availableHeight / 1080)))
    }
    const schedule = () => {
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(updateScale)
    }
    updateScale()
    const observer = new ResizeObserver(schedule)
    observer.observe(frame)
    observer.observe(frame.parentElement)
    const preventPreviewGesture = event => event.preventDefault()
    frame.addEventListener('wheel', preventPreviewGesture, { passive: false })
    frame.addEventListener('touchmove', preventPreviewGesture, { passive: false })
    frame.addEventListener('gesturestart', preventPreviewGesture, { passive: false })
    frame.addEventListener('gesturechange', preventPreviewGesture, { passive: false })
    window.addEventListener('resize', schedule)
    return () => {
      observer.disconnect()
      frame.removeEventListener('wheel', preventPreviewGesture)
      frame.removeEventListener('touchmove', preventPreviewGesture)
      frame.removeEventListener('gesturestart', preventPreviewGesture)
      frame.removeEventListener('gesturechange', preventPreviewGesture)
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', schedule)
    }
  }, [activePage])

  const replaceDisplayConfig = (config) => {
    displayConfigRef.current = config
    setDisplayConfig(config)
  }

  const updateDisplayConfig = (updater) => {
    const next = typeof updater === 'function'
      ? updater(displayConfigRef.current)
      : updater
    displayConfigEditedRef.current = true
    replaceDisplayConfig(next)
    setDisplayStatus('Unsaved changes')
  }

  const updateDisplayLabels = (updater) => {
    updateDisplayConfig(current => ({
      ...current,
      settings: {
        ...current.settings,
        displayLabels: typeof updater === 'function'
          ? updater(current.settings.displayLabels)
          : updater,
      },
    }))
  }

  const updateFontControl = (elementKey, field, value) => {
    updateDisplayConfig(current => ({
      ...current,
      settings: {
        ...current.settings,
        fontControls: {
          ...(current.settings.fontControls || DEFAULT_DISPLAY_FONT_CONTROLS),
          [elementKey]: {
            ...((current.settings.fontControls && current.settings.fontControls[elementKey]) || DEFAULT_DISPLAY_FONT_CONTROLS[elementKey]),
            [field]: value,
          },
        },
        ...(elementKey === 'waitingQueueTickets' && field === 'fontSize'
          ? { waitingFontSize: value }
          : {}),
      },
    }))
  }

  const saveDisplaySettings = async () => {
    const configToPublish = displayConfigRef.current
    setDisplayPublishing(true)
    try {
      const data = await publishDisplayConfiguration(configToPublish)
      const published = saveDisplayBoardConfig({ settings: data.settings, windows: data.windows })
      setPublishedDisplayConfig(published)
      if (displayConfigRef.current === configToPublish) {
        replaceDisplayConfig(published)
        displayConfigEditedRef.current = false
        setDisplayStatus('Display settings published successfully.')
      } else {
        setDisplayStatus('Published the submitted settings. Changes made during publishing are still unsaved.')
      }
    } catch (err) {
      setDisplayStatus(err?.message || 'Unable to publish display settings.')
    } finally {
      setDisplayPublishing(false)
    }
  }

  const handleResetDisplaySettings = () => {
    replaceDisplayConfig(publishedDisplayConfig)
    displayConfigEditedRef.current = false
    setDisplayStatus('Unsaved changes were reset to the published settings.')
  }

  const resetDisplayColors = () => {
    updateDisplayConfig(current => ({
      ...current,
      settings: {
        ...current.settings,
        backgroundColor: DEFAULT_DISPLAY_BACKGROUND_COLOR,
        backgroundType: 'solid',
        panelColors: DEFAULT_DISPLAY_PANEL_COLORS,
        accentColor: DEFAULT_ANNOUNCEMENT_BACKGROUND_COLOR,
        announcementTextColor: DEFAULT_ANNOUNCEMENT_TEXT_COLOR,
        nowServingTextColor: DEFAULT_NOW_SERVING_TEXT_COLOR,
        nowServingBackgroundColor: DEFAULT_NOW_SERVING_BACKGROUND_COLOR,
        windowTicketTextColor: DEFAULT_WINDOW_TICKET_TEXT_COLOR,
        dateTimeTextColor: DEFAULT_DATE_TIME_TEXT_COLOR,
        waitingQueueColors: DEFAULT_WAITING_QUEUE_COLORS,
      },
    }))
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setMessage('')
    try {
      const payload = {
        ...form,
        position: isDeptAdmin ? userDeptPosition : (form.role === 'security' ? '' : form.position),
        role: isDeptAdmin ? 'staff' : form.role,
        ...(form.role === 'dept_admin' ? { assigned_window_id: null } : {}),
      }
      const data = await registerUser(payload)
      if (data.user) {
        setMessage(form.role === 'dept_admin' ? 'Department Admin added successfully!' : 'Staff added successfully!')
        setShowAddForm(false)
        setForm(emptyUserForm)
        await loadStaffData()
      } else {
        setMessage(data.errors ? Object.values(data.errors).flat().join(', ') : 'Error adding account')
      }
    } catch (err) {
      setMessage('Error adding account')
    }
  }

  const handleEdit = async (id, event = null) => {
    event?.preventDefault()
    if (staffSavingId !== null) return
    setMessage('')
    setStaffSavingId(id)
    try {
      const payload = {
        username: editForm.username,
        full_name: editForm.full_name,
        status: editForm.status,
        ...(editForm.role === 'security' ? {} : { position: editForm.position, assigned_window_id: editForm.role === 'dept_admin' ? null : (editForm.assigned_window_id || null) }),
        ...(editForm.password ? { password: editForm.password, password_confirmation: editForm.password_confirmation } : {}),
        ...(editForm.role === 'security' && editForm.security_code
          ? { security_code: editForm.security_code, security_code_confirmation: editForm.security_code_confirmation }
          : {}),
      }
      const data = await updateStaff(id, payload)
      if (!data?.staff) throw new Error(data?.message || 'Unable to update account.')
      setStaff(current => current.map(item => item.user_id === id ? { ...item, ...data.staff } : item))
      setMessage('Account updated successfully.')
      setEditingId(null)
      await loadStaffData()
    } catch (err) {
      setMessage(err?.message || 'Unable to update account.')
    } finally {
      setStaffSavingId(null)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      await deleteStaff(id)
      setMessage('Account deleted.')
      await loadStaffData()
    } catch (err) {
      setMessage('Error deleting account')
    }
  }

  const startEdit = (s) => {
    setEditingId(s.user_id)
    setEditForm({
      username: s.username || '',
      full_name: s.full_name || '',
      role: s.role || 'staff',
      position: s.position || (isDeptAdmin ? userDeptPosition : 'cashier'),
      status: s.status || 'active',
      password: '',
      password_confirmation: '',
      security_code: '',
      security_code_confirmation: '',
      assigned_window_id: s.assigned_window?.id || '',
      service_scope: 'department',
    })
  }

  const handleAverageWaitingTime = async () => {
    setAnalyticsLoading(true)
    setAnalyticsError('')

    try {
      const data = await getDashboardAnalytics()
      setAnalytics(data)
    } catch (err) {
      console.error('Failed to fetch dashboard analytics', err)
      setAnalyticsError('Unable to load average waiting time report right now.')
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const handleBusiestDay = async (department = null) => {
    setBusiestDayLoading(true)
    setBusiestDayError('')

    try {
      const data = await getBusiestDayAnalytics(department)
      setBusiestDay(data)
    } catch (err) {
      console.error('Failed to fetch busiest day analytics', err)
      setBusiestDayError('Unable to load busiest day data right now.')
    } finally {
      setBusiestDayLoading(false)
    }
  }

  const renderBusiestDayChart = () => {
    if (!busiestDay || !Array.isArray(busiestDay.distribution)) {
      return null
    }

    const distribution = busiestDay.distribution
    const total = distribution.reduce((sum, item) => sum + item.count, 0)
    if (total === 0) {
      return <p className="analytics-subtext">No completed transactions yet to show.</p>
    }

    const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#f97316']
    let cumulative = 0

    const polar = (fraction) => {
      const angle = fraction * 2 * Math.PI - Math.PI / 2
      const radius = 12
      return [16 + radius * Math.cos(angle), 16 + radius * Math.sin(angle)]
    }

    const paths = distribution.map((item, index) => {
      if (item.count === 0) return null
      const startFraction = cumulative / total
      const endFraction = (cumulative + item.count) / total
      const [startX, startY] = polar(startFraction)
      const [endX, endY] = polar(endFraction)
      const largeArcFlag = endFraction - startFraction > 0.5 ? 1 : 0
      cumulative += item.count

      return (
        <path
          key={item.weekday_name}
          d={`M16 16 L ${startX.toFixed(2)} ${startY.toFixed(2)} A 12 12 0 ${largeArcFlag} 1 ${endX.toFixed(2)} ${endY.toFixed(2)} Z`}
          fill={colors[index % colors.length]}
        />
      )
    })

    return (
      <div className="analytics-busiest-day-chart">
        <svg viewBox="0 0 32 32" className="analytics-pie">
          {paths}
          <circle cx="16" cy="16" r="6" fill="#ffffff" />
          <text x="16" y="18" textAnchor="middle" fontSize="4" fill="#0B1D3A">
            {displayValue(busiestDay.busiest_day)}
          </text>
        </svg>
        <div className="analytics-legend">
          {distribution.map((item, index) => (
            <div key={item.weekday_name} className="analytics-legend-item">
              <span className="analytics-legend-color" style={{ background: colors[index % colors.length] }} />
              <span>{item.weekday_name}: {item.count}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const handleDepartmentComparison = async () => {
    setDeptCompLoading(true)
    setDeptCompError('')
    setDeptComparison(null)

    try {
      const data = await getDepartmentComparison(
        deptCompPeriod,
        deptCompPeriod === 'custom' ? deptCompStartDate : null,
        deptCompPeriod === 'custom' ? deptCompEndDate : null
      )
      setDeptComparison(data)
    } catch (err) {
      console.error('Failed to fetch department comparison', err)
      setDeptCompError('Unable to load department comparison data right now.')
    } finally {
      setDeptCompLoading(false)
    }
  }

  // ─── Peak Hours ──────────────────────────────────────
  const handlePeakHours = async () => {
    setPeakHoursLoading(true)
    setPeakHoursError('')
    setPeakHours(null)

    try {
      const data = await getPeakHours(
        peakHoursPeriod,
        peakHoursPeriod === 'custom' ? peakHoursStartDate : null,
        peakHoursPeriod === 'custom' ? peakHoursEndDate : null
      )
      setPeakHours(data)
    } catch (err) {
      console.error('Failed to fetch peak hours', err)
      setPeakHoursError('Unable to load peak hours data right now.')
    } finally {
      setPeakHoursLoading(false)
    }
  }

  const renderPeakHoursChart = () => {
    if (!peakHours || !Array.isArray(peakHours.distribution)) {
      return null
    }

    const distribution = peakHours.distribution
    const maxCount = Math.max(...distribution.map(d => d.count), 1)

    if (peakHours.total_tickets === 0) {
      return <p className="analytics-subtext">No tickets issued yet for this period.</p>
    }

    const barColors = ['#1A3667', '#D4A843', '#2f5ea8', '#e8c468']

    return (
      <div className="peak-hours-chart-container">
        <div className="peak-hours-bars">
          {distribution.map((item) => {
            const heightPercent = (item.count / maxCount) * 100
            const isPeak = item.count === peakHours.peak_hour_count && item.count > 0
            return (
              <div key={item.hour} className="peak-hours-bar-wrap" title={`${item.label}: ${item.count} tickets`}>
                <div className="peak-hours-bar-track">
                  <div
                    className={`peak-hours-bar ${isPeak ? 'peak-hours-bar-peak' : ''}`}
                    style={{ height: `${Math.max(heightPercent, item.count > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <div className="peak-hours-bar-label">{item.label.replace(' ', '')}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── Customers Served Per Day ──────────────────────────
  const handleCustomersServed = async () => {
    setCustomersServedLoading(true)
    setCustomersServedError('')
    setCustomersServed(null)

    try {
      const data = await getCustomersServed(
        customersServedPeriod,
        customersServedPeriod === 'custom' ? customersServedStartDate : null,
        customersServedPeriod === 'custom' ? customersServedEndDate : null
      )
      setCustomersServed(data)
    } catch (err) {
      console.error('Failed to fetch customers served data', err)
      setCustomersServedError('Unable to load customers served data right now.')
    } finally {
      setCustomersServedLoading(false)
    }
  }

  const renderCustomersServedBarChart = () => {
    if (!customersServed || !Array.isArray(customersServed.distribution)) {
      return null
    }

    const distribution = customersServed.distribution
    const maxCount = Math.max(...distribution.map(d => d.customers_served), 1)

    if (customersServed.total_customers_served === 0) {
      return <p className="analytics-subtext">No customers served yet for this period.</p>
    }

    return (
      <div className="cs-bar-chart-container">
        <h4 className="cs-chart-title">📊 Bar Chart – Customers Served Per Day</h4>
        <div className="cs-bar-chart">
          {distribution.map((item) => {
            const heightPercent = (item.customers_served / maxCount) * 100
            const isBusiest = item.customers_served === customersServed.busiest_date_count && item.customers_served > 0
            return (
              <div key={item.date} className="cs-bar-wrap" title={`${item.label}: ${item.customers_served} customers`}>
                <div className="cs-bar-track">
                  <div
                    className={`cs-bar ${isBusiest ? 'cs-bar-peak' : ''}`}
                    style={{ height: `${Math.max(heightPercent, item.customers_served > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <div className="cs-bar-value">{item.customers_served > 0 ? item.customers_served : ''}</div>
                <div className="cs-bar-label">{item.label.split(',')[0]}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderCustomersServedLineChart = () => {
    if (!customersServed || !Array.isArray(customersServed.distribution)) {
      return null
    }

    const distribution = customersServed.distribution
    const maxCount = Math.max(...distribution.map(d => d.customers_served), 1)

    if (customersServed.total_customers_served === 0) {
      return null
    }

    // Build SVG line chart
    const width = 600
    const height = 200
    const padding = { top: 20, right: 20, bottom: 40, left: 40 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const points = distribution.map((item, index) => {
      const x = padding.left + (index / Math.max(distribution.length - 1, 1)) * chartWidth
      const y = padding.top + chartHeight - (item.customers_served / maxCount) * chartHeight
      return { x, y, ...item }
    })

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

    // Area fill
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${padding.top + chartHeight} L ${points[0].x.toFixed(1)} ${padding.top + chartHeight} Z`

    // Y-axis labels
    const yLabels = []
    const ySteps = 4
    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round((maxCount / ySteps) * i)
      const y = padding.top + chartHeight - (val / maxCount) * chartHeight
      yLabels.push({ val, y })
    }

    return (
      <div className="cs-line-chart-container">
        <h4 className="cs-chart-title">📈 Line Chart – Daily Service Trend</h4>
        <svg viewBox={`0 0 ${width} ${height}`} className="cs-line-chart">
          {/* Grid lines */}
          {yLabels.map((label, i) => (
            <line key={i} x1={padding.left} y1={label.y} x2={width - padding.right} y2={label.y} stroke="#e2e8f0" strokeWidth="1" />
          ))}
          {/* Area fill */}
          <path d={areaPath} fill="rgba(26, 54, 103, 0.08)" />
          {/* Line */}
          <path d={linePath} fill="none" stroke="#1A3667" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Data points */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4" fill="#1A3667" stroke="white" strokeWidth="2" />
          ))}
          {/* Y-axis labels */}
          {yLabels.map((label, i) => (
            <text key={i} x={padding.left - 8} y={label.y + 4} textAnchor="end" fontSize="10" fill="#64748b">
              {label.val}
            </text>
          ))}
          {/* X-axis labels (show a subset to avoid crowding) */}
          {points.map((p, i) => {
            const showLabel = distribution.length <= 7 || i % Math.ceil(distribution.length / 7) === 0 || i === distribution.length - 1
            return showLabel ? (
              <text key={i} x={p.x} y={height - 8} textAnchor="middle" fontSize="9" fill="#64748b">
                {p.date.slice(5)}
              </text>
            ) : null
          })}
        </svg>
      </div>
    )
  }

  const filteredQueueWindows = queueWindows.filter((window) => {
    const searchLower = monitorSearch.trim().toLowerCase()
    const matchesSearch = searchLower.length === 0 ||
      window.window.toLowerCase().includes(searchLower) ||
      window.department.toLowerCase().includes(searchLower) ||
      window.ticket.toLowerCase().includes(searchLower) ||
      String(window.staffName || '').toLowerCase().includes(searchLower)

    const matchesDepartment = isDeptAdmin
      ? (String(window.department).toLowerCase() === userDeptPosition ||
         String(window.department).toLowerCase() === userDeptName.toLowerCase() ||
         (userDeptPosition === 'cashier' && ['cashier', 'accounting'].includes(String(window.department).toLowerCase())))
      : (monitorDepartmentFilter === 'All' || window.department === monitorDepartmentFilter)
    const matchesStatus = monitorStatusFilter === 'All' || window.status === monitorStatusFilter
    return matchesSearch && matchesDepartment && matchesStatus
  })

  const deptScopedMonitoringWindows = isDeptAdmin
    ? queueWindows.filter((w) => {
        const d = String(w.department || '').toLowerCase()
        return d === userDeptPosition ||
          d === userDeptName.toLowerCase() ||
          (userDeptPosition === 'cashier' && ['cashier', 'accounting'].includes(d))
      })
    : queueWindows

  const activeWindows = deptScopedMonitoringWindows.filter((item) => item.busy).length
  const idleWindows = deptScopedMonitoringWindows.filter((item) => item.status === 'Idle').length
  const currentDeptWaiting = isDeptAdmin
    ? (deptScopedMonitoringWindows[0]?.department_waiting ?? (userDeptPosition === 'cashier' ? cashierWaiting : registrarWaiting))
    : (cashierWaiting + registrarWaiting)
  const averageQueue = Math.round(currentDeptWaiting / Math.max(deptScopedMonitoringWindows.length, 1))

  const filteredStaff = staff.filter((s) => {
    const searchMatch = staffSearch.trim().length === 0 ||
      String(s.full_name || '').toLowerCase().includes(staffSearch.toLowerCase()) ||
      String(s.username || '').toLowerCase().includes(staffSearch.toLowerCase())

    const departmentMatch = isDeptAdmin
      ? (String(s.position || '').toLowerCase() === userDeptPosition || String(s.department || '').toLowerCase() === userDeptPosition)
      : (staffDepartmentFilter === 'All' || s.position === staffDepartmentFilter || s.department === staffDepartmentFilter)

    const roleMatch = staffRoleFilter === 'All' || String(s.role || '').toLowerCase() === staffRoleFilter.toLowerCase()
    return searchMatch && departmentMatch && roleMatch
  })

  const filteredActivities = activityLogs.filter((item) => {
    const periodMatch = activityPeriod === 'Today' || activityPeriod === 'Weekly' || activityPeriod === 'Monthly' || activityPeriod === 'Semester'
    const actorMatch = activityActorFilter === 'All' || item.actor === activityActorFilter
    return periodMatch && actorMatch
  })

  const dashboardSummary = [
    { label: 'Students Served Today', value: analytics?.completed_tickets_count ?? analytics?.customers_served ?? 0, detail: 'Completed transactions', accent: 'blue' },
    { label: 'Waiting Queue', value: analytics?.waiting_tickets ?? (cashierWaiting + registrarWaiting), detail: 'Across cashier and registrar', accent: 'gold' },
    { label: 'Average Waiting', value: analytics?.average_waiting_time_formatted || `${analytics?.average_waiting_time ?? 0} min`, detail: 'Target below 5 min', accent: 'green' },
    { label: 'Average Service', value: analytics?.average_service_time_formatted || `${analytics?.average_service_time ?? 0} min`, detail: 'Staff performance', accent: 'orange' },
    { label: 'Turnaround Time', value: analytics?.average_turnaround_time_formatted || `${analytics?.turnaround_time ?? 0} min`, detail: 'From ticket to finish', accent: 'purple' },
    { label: 'Completion Rate', value: `${analytics?.completion_rate ?? 0}%`, detail: 'On-time service rate', accent: 'teal' },
  ]

  const safeNumber = (value, fallback = 0) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
  }

  const parseDateValue = (value) => {
    if (!value || value === '—') return null
    const parsed = new Date(String(value).includes(' ') ? String(value).replace(' ', 'T') : String(value))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const diffMinutes = (start, end) => {
    if (!start || !end) return 0
    return (end.getTime() - start.getTime()) / 60000
  }

  const normalizeStatus = (value) => String(value ?? '').trim().toLowerCase()

  const formatMinutesCompact = (minutes) => {
    const value = safeNumber(minutes, 0)
    if (value <= 0) return '0 min'
    if (value < 60) return `${Math.round(value)} min`
    const hours = Math.floor(value / 60)
    const mins = Math.round(value % 60)
    return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`
  }

  const formatMinutesDetailed = (minutes) => {
    const value = safeNumber(minutes, 0)
    if (value <= 0) return '0 min'
    const wholeMinutes = Math.floor(value)
    const seconds = Math.round((value - wholeMinutes) * 60)
    if (seconds === 60) {
      return `${wholeMinutes + 1} min`
    }
    if (wholeMinutes === 0) return `${seconds} sec`
    if (seconds === 0) return `${wholeMinutes} min`
    return `${wholeMinutes} min ${seconds} sec`
  }

  const hourLabel = (hour) => {
    if (hour === 0) return '12 AM'
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return '12 PM'
    return `${hour - 12} PM`
  }

  const queueHistoryData = Array.isArray(queueHistory) ? queueHistory.filter((ticket) => {
    const createdAt = parseDateValue(ticket?.created_at)
    if (!createdAt) return false

    const startBoundary = parseDateValue(selectedStartDate) || new Date()
    const endBoundary = parseDateValue(selectedEndDate) || startBoundary

    const startMs = new Date(startBoundary.getFullYear(), startBoundary.getMonth(), startBoundary.getDate()).getTime()
    const endMs = new Date(endBoundary.getFullYear(), endBoundary.getMonth(), endBoundary.getDate(), 23, 59, 59, 999).getTime()
    const ticketMs = createdAt.getTime()

    return ticketMs >= startMs && ticketMs <= endMs
  }) : []

  const completedHistory = queueHistoryData.filter((ticket) => {
    const status = String(ticket?.status || '').toLowerCase().trim()
    return status === 'done' || status === 'completed'
  })

  const waitingHistory = queueHistoryData.filter((ticket) => {
    const status = String(ticket?.status || '').toLowerCase().trim()
    return status === 'waiting'
  })

  const SKIP_STATUSES = new Set(['cancelled', 'skipped', 'no-show', 'noshow', 'no_show'])
  const cancelledHistory = queueHistoryData.filter((ticket) => {
    const status = String(ticket?.status || '').toLowerCase().trim()
    return SKIP_STATUSES.has(status)
  })

  const longestWaitingMinutes = queueHistoryData.reduce((max, ticket) => {
    const status = normalizeStatus(ticket?.status)
    const createdAt = parseDateValue(ticket?.created_at)
    if (!createdAt) return max

    const calledAt = parseDateValue(ticket?.called_at)
    const endAt = calledAt || (status === 'waiting' ? new Date() : null)
    if (!endAt) return max

    const waitingMinutes = diffMinutes(createdAt, endAt)
    return waitingMinutes >= 0 ? Math.max(max, waitingMinutes) : max
  }, 0)

  const totalWaiting = safeNumber(analytics?.waiting_tickets, waitingHistory.length || cashierWaiting + registrarWaiting)
  const currentServing = safeNumber(analytics?.serving_tickets, queueWindows.filter((item) => item.busy).length)
  const completedToday = safeNumber(analytics?.completed_tickets_count ?? analytics?.customers_served, completedHistory.length)
  const skippedToday = safeNumber(analytics?.cancelled_tickets ?? analytics?.skipped_tickets, cancelledHistory.length)
  const averageWait = safeNumber(analytics?.average_waiting_time, 0)
  const averageService = safeNumber(analytics?.average_service_time, 0)
  const longestWaitFromAnalytics = safeNumber(analytics?.longest_waiting_time ?? analytics?.longest_waiting_time_minutes, longestWaitingMinutes)

  const queueVolumeSeries = (() => {
    if (!Array.isArray(peakHours?.distribution)) return []
    const distribution = peakHours.distribution
    const hours = Array.from({ length: 13 }, (_, index) => 7 + index)

    return hours.map((hour) => {
      const matched = distribution.find((item) => Number(item.hour) === hour)
      return {
        hour,
        label: hourLabel(hour),
        count: safeNumber(matched?.count ?? matched?.total ?? 0, 0),
      }
    })
  })()
  const queueVolumeMax = Math.max(...queueVolumeSeries.map((item) => safeNumber(item.count, 0)), 1)

  const skipPercent = ((skippedToday / Math.max(totalWaiting + completedToday + currentServing + skippedToday, 1)) * 100)

  const performanceMetrics = [
    {
      label: 'Completion Rate',
      current: `${safeNumber(analytics?.completion_rate, 0)}%`,
      target: '>= 95%',
      progress: Math.min(safeNumber(analytics?.completion_rate, 0), 100),
      status: safeNumber(analytics?.completion_rate, 0) >= 95 ? 'On Target' : 'Needs Attention',
    },
    {
      label: 'Average Waiting Time',
      current: formatMinutesDetailed(averageWait),
      target: '<= 5 min',
      progress: Math.min((5 / Math.max(averageWait || 1, 1)) * 100, 100),
      status: averageWait <= 5 ? 'On Target' : 'Needs Attention',
    },
    {
      label: 'Average Service Time',
      current: formatMinutesDetailed(averageService),
      target: '<= 10 min',
      progress: Math.min((10 / Math.max(averageService || 1, 1)) * 100, 100),
      status: averageService <= 10 ? 'On Target' : 'Needs Attention',
    },
    {
      label: 'Skip Rate',
      current: `${skipPercent.toFixed(1)}%`,
      target: '<= 10%',
      progress: Math.min(((10 - Math.max(skipPercent, 0)) / 10) * 100, 100),
      status: skipPercent <= 10 ? 'On Target' : 'Needs Attention',
    }
  ]

  const ticketPriorityStats = (() => {
    const priority = queueHistoryData.filter(ticket => String(ticket?.service_type).toLowerCase() === 'priority').length
    const regular = queueHistoryData.filter(ticket => String(ticket?.service_type).toLowerCase() === 'regular').length
    const total = priority + regular
    return {
      priority, regular,
      priorityPct: total ? priority / total * 100 : 0,
      regularPct: total ? regular / total * 100 : 0,
    }
  })()

  const officeSummary = (() => {
    const byOffice = new Map()
    const officeNames = ['Registrar', 'Cashier', 'ITM', 'Admission']

    queueHistoryData.forEach((ticket) => {
      const status = String(ticket?.status || '').toLowerCase()
      const department = String(ticket?.department || '').trim() || (ticket?.service_type === 'R' || ticket?.service_type === 'RT' ? 'Registrar' : (ticket?.service_type === 'C' || ticket?.service_type === 'CS' ? 'Cashier' : ''))
      if (!department) return
      const officeKey = officeNames.includes(department) ? department : null
      if (!officeKey) return

      const current = byOffice.get(officeKey) || {
        office: officeKey,
        waiting: 0,
        completed: 0,
        averageWaitingTime: 0,
        averageServiceTime: 0,
        total: 0,
      }

      if (status === 'waiting') current.waiting += 1
      if (status === 'done' || status === 'completed') current.completed += 1
      current.total += 1
      byOffice.set(officeKey, current)
    })

    const departmentRows = Array.isArray(deptComparison) && deptComparison.length > 0
      ? deptComparison.map((row) => ({
          office: row.department || row.office || 'Office',
          waiting: queueHistoryData.filter((ticket) => String(ticket?.department || '').toLowerCase() === String(row.department || row.office || '').toLowerCase() && String(ticket?.status || '').toLowerCase() === 'waiting').length,
          averageWaitingTime: safeNumber(row.average_waiting_time, 0),
          averageServiceTime: safeNumber(row.average_service_time, 0),
          completed: safeNumber(row.customers_served, 0),
          completionRate: safeNumber(row.completion_rate, 0),
        }))
      : Array.from(byOffice.values())

    return departmentRows.map((row) => {
      const waitingCount = safeNumber(row.waiting, 0)
      const completedCount = safeNumber(row.completed, 0)
      const total = Math.max(waitingCount + completedCount, 1)
      const rowCompletionRate = Number.isFinite(Number(row.completionRate))
        ? Number(row.completionRate)
        : Number.isFinite(Number(row.completion_rate))
          ? Number(row.completion_rate)
          : (completedCount / total) * 100
      return {
        office: row.office,
        waiting: waitingCount,
        averageWaitingTime: safeNumber(row.averageWaitingTime, 0),
        averageServiceTime: safeNumber(row.averageServiceTime, 0),
        completed: completedCount,
        completionRate: Math.min(Math.max(rowCompletionRate, 0), 100),
      }
    })
  })()

  // Use the same department list for every office's service performance.
  const deptList = isDeptAdmin
    ? DEPARTMENTS.filter(d => d.position === userDeptPosition || d.name.toLowerCase() === userDeptPosition || d.name === userDeptName)
    : DEPARTMENTS

  const servicePerformanceRows = deptList.map(({ name: office }) => officeSummary.find(row => row.office === office) || {
    office, waiting: 0, averageWaitingTime: 0, averageServiceTime: 0, completed: 0,
  })

  const waitTrendSeries = (() => {
    const buckets = Array.from({ length: 13 }, (_, index) => {
      const hour = 7 + index
      return { hour, label: hourLabel(hour), values: [] }
    })

    queueHistoryData.forEach((ticket) => {
      const createdAt = parseDateValue(ticket?.created_at)
      const calledAt = parseDateValue(ticket?.called_at)
      const status = String(ticket?.status || '').toLowerCase()
      if (!createdAt || !calledAt || !(status === 'done' || status === 'completed')) return
      const hour = createdAt.getHours()
      if (hour < 7 || hour > 19) return
      const targetBucket = buckets.find((bucket) => bucket.hour === hour)
      if (!targetBucket) return
      targetBucket.values.push(diffMinutes(createdAt, calledAt))
    })

    return buckets.map((bucket) => {
      const average = bucket.values.length > 0 ? bucket.values.reduce((sum, value) => sum + value, 0) / bucket.values.length : 0
      return { label: bucket.label, value: average }
    })
  })()

  const peakInsight = (() => {
    const queueCount = totalWaiting + currentServing
    const busiestOffice = officeSummary.length > 0
      ? officeSummary.reduce((winner, current) => current.completed > winner.completed ? current : winner, officeSummary[0])
      : null

    const customersWaitingMoreThanFiveMinutes = completedHistory.filter((ticket) => {
      const createdAt = parseDateValue(ticket?.created_at)
      const calledAt = parseDateValue(ticket?.called_at)
      if (!createdAt || !calledAt) return false
      return diffMinutes(createdAt, calledAt) > 5
    }).length

    return {
      peakQueuePeriod: displayValue(peakHours?.peak_hour_label),
      averageQueue: queueCount > 0 ? Math.round(queueCount / Math.max(officeSummary.length || 1, 1)) : 0,
      busiestOffice: busiestOffice ? busiestOffice.office : '0',
      customersWaitingMoreThanFiveMinutes,
    }
  })()

  const alertItems = [
    ...(averageWait > 5 ? [{ severity: 'High waiting time', detail: `Waiting averages ${formatMinutesDetailed(averageWait)} across the queue`, meta: 'Live data' }] : []),
    ...(peakHours?.peak_hour_label ? [{ severity: 'Peak queue period', detail: `Peak activity is around ${peakHours.peak_hour_label}`, meta: 'Queue volume' }] : []),
    ...(queueHistoryData.length > 0 ? [{ severity: 'System status', detail: 'Queue data is active and updating in real time', meta: 'Live sync' }] : []),
  ]

  const renderSkeletonBarChart = (bars = 7) => (
    <div className="panel-skeleton panel-skeleton-chart">
      <div className="skeleton-line skeleton-line-wide" />
      <div className="skeleton-bars">
        {Array.from({ length: bars }).map((_, index) => (
          <span
            key={index}
            className="skeleton-bar"
            style={{ height: `${34 + ((index % 5) * 12)}px` }}
          />
        ))}
      </div>
    </div>
  )

  const renderSkeletonPerformance = () => (
    <div className="panel-skeleton panel-skeleton-stack">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="skeleton-performance-row">
          <div className="skeleton-line skeleton-line-medium" />
          <div className="skeleton-progress-track">
            <span className="skeleton-progress-fill" style={{ width: `${55 + (index * 10)}%` }} />
          </div>
          <div className="skeleton-line skeleton-line-small" />
        </div>
      ))}
    </div>
  )

  const renderSkeletonTable = (rows = 4, cols = 6) => (
    <div className="panel-skeleton panel-skeleton-table">
      <div className="skeleton-table-head" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, index) => (
          <span key={index} className="skeleton-line skeleton-line-small" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((_, colIndex) => (
            <span
              key={`${rowIndex}-${colIndex}`}
              className={`skeleton-line ${colIndex === 0 ? 'skeleton-line-medium' : 'skeleton-line-small'}`}
            />
          ))}
        </div>
      ))}
    </div>
  )

  const renderSkeletonInsights = () => (
    <div className="panel-skeleton panel-skeleton-stack">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="skeleton-insight-row">
          <div className="skeleton-line skeleton-line-medium" />
          <div className="skeleton-line skeleton-line-small" />
          <div className="skeleton-line skeleton-line-extra-small" />
        </div>
      ))}
    </div>
  )

  const renderSkeletonAlerts = () => (
    <div className="panel-skeleton panel-skeleton-stack">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="skeleton-alert-row">
          <span className="skeleton-alert-dot" />
          <div className="skeleton-alert-copy">
            <div className="skeleton-line skeleton-line-medium" />
            <div className="skeleton-line skeleton-line-small" />
          </div>
          <div className="skeleton-line skeleton-line-mini" />
        </div>
      ))}
    </div>
  )

  const staffRows = (Array.isArray(analytics?.staff_performance) ? analytics.staff_performance : [])
    .filter((member) => member?.status !== 'inactive')
    .map((member) => ({
      staff: member.staff_name || member.username || 'Unknown',
      status: member.status,
      office: member.position ? member.position.charAt(0).toUpperCase() + member.position.slice(1) : '0',
      transactionsServed: Number(member.transactions_served || 0),
      averageServiceTime: formatMinutesCompact(Number(member.average_service_time || 0)),
      averageWaitingTime: formatMinutesCompact(Number(member.average_waiting_time || 0)),
      completionRate: `${Number(member.completion_rate || 0).toFixed(1)}%`,
      skipNoShow: Number(member.skip_no_show || 0),
      utilization: `${Number(member.utilization || 0).toFixed(1)}%`,
    }))

  const waitTrendMax = Math.max(...waitTrendSeries.map((item) => safeNumber(item.value, 0)), 5)
  const waitTrendPoints = waitTrendSeries.map((item, index) => {
    const x = 30 + (index / Math.max(waitTrendSeries.length - 1, 1)) * 520
    const y = 145 - (safeNumber(item.value, 0) / waitTrendMax) * 110
    return `${x},${y}`
  }).join(' ')

  const queueVolumePoints = queueVolumeSeries.map((item, index) => {
    const x = 30 + (index / Math.max(queueVolumeSeries.length - 1, 1)) * 430
    const y = 150 - (safeNumber(item.count, 0) / queueVolumeMax) * 100
    return `${x},${y}`
  }).join(' ')

  const ticketPriorityChart = ticketPriorityStats.priority + ticketPriorityStats.regular > 0
    ? (
      <div
        className="dashboard-ticket-donut"
        role="img"
        aria-label={`${ticketPriorityStats.priorityPct.toFixed(1)}% priority tickets and ${ticketPriorityStats.regularPct.toFixed(1)}% regular tickets`}
        style={{
          width: 160,
          height: 160,
          flexShrink: 0,
          borderRadius: '50%',
          background: `conic-gradient(#2563eb 0 ${ticketPriorityStats.priorityPct}%, #f59e0b ${ticketPriorityStats.priorityPct}% 100%)`,
          boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.08)',
        }}
      ><div className="dashboard-donut-center"><strong>{completedToday}</strong><span>Completed</span></div></div>
    )
    : <div className="empty-state compact">No ticket data available</div>

  const handleSidebarLogout = async () => {
    try {
      await apiLogout()
    } catch (error) {
      console.error('Sidebar logout failed:', error)
    }

    sessionStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className={`admin-page ${activePage === 'dashboard' ? 'dashboard-refresh' : ''}`}>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-logo-wrap">
            <img src="/loa-logo.png" alt="Lyceum of Alabang logo" />
          </div>
          <div className="admin-sidebar-brand-copy">
            <strong>Lyceum of Alabang</strong>
            <small>{isDeptAdmin ? `${deptDisplayName} Admin Panel` : 'Queue Management System'}</small>
          </div>
        </div>
        {isDeptAdmin && (
          <div style={{ margin: '4px 16px 12px', padding: '6px 12px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', color: '#93c5fd', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
            <span>{deptDisplayName} Admin</span>
          </div>
        )}

        <nav className="admin-nav" aria-label="Admin navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`admin-nav-btn ${activePage === item.id ? 'active' : ''}`}
              type="button"
              aria-current={activePage === item.id ? 'page' : undefined}
              onClick={() => setActivePage(item.id)}
            >
              <span className="admin-nav-icon" aria-hidden="true"><span className="material-symbols-outlined">{item.icon}</span></span>
              <span className="admin-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-logout-btn" type="button" onClick={handleSidebarLogout}>
            <span className="admin-nav-icon" aria-hidden="true"><span className="material-symbols-outlined">logout</span></span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="admin-content">
      {activePage === 'dashboard' && (
        <>
          <div className="dashboard-shell">
            <header className="dashboard-header">
              <div className="welcome-panel">
                <p className="dashboard-kicker">{isDeptAdmin ? `${deptDisplayName} Department` : 'Queue Management System'}</p>
                <h1>Welcome, {user?.full_name || (isDeptAdmin ? `${deptDisplayName} Admin` : 'Admin')}! 👋</h1>
                {isDeptAdmin && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#e0f2fe', color: '#0369a1', padding: '4px 12px', borderRadius: '16px', fontSize: '0.82rem', fontWeight: 700, margin: '4px 0 8px', width: 'fit-content' }}>
                    <span>🏢</span> {deptDisplayName} Admin Panel
                  </div>
                )}
                <p>
                  {selectedStartDate && selectedEndDate && selectedStartDate !== selectedEndDate
                    ? `Showing data from ${formatDisplayDate(selectedStartDate)} to ${formatDisplayDate(selectedEndDate)}`
                    : "Here's what's happening in your queue system today."}
                </p>
              </div>
              <div className="dashboard-header-tools">
                <div className="date-range-picker-area">
                  <div className="date-range-picker">
                    <button
                      type="button"
                      className="date-range-trigger"
                      onClick={() => setDateRangeOpen((current) => !current)}
                      aria-label="Select dashboard date range"
                    >
                      <span className="date-range-icon">📅</span>
                      <span>{formatRangeLabel()}</span>
                    </button>

                    {dateRangeOpen && (
                      <div className="date-range-popover">
                        <div className="date-range-popover-header">
                          <strong>Select date range</strong>
                        </div>
                        <div className="date-range-popover-body">
                          <label className="date-range-field">
                            <span>From</span>
                            <input
                              type="date"
                              className="dashboard-date-input"
                              value={dateRangeDraftStart || ''}
                              onChange={(e) => setDateRangeDraftStart(e.target.value || todayIso)}
                              aria-label="Select start date"
                            />
                          </label>
                          <label className="date-range-field">
                            <span>To</span>
                            <input
                              type="date"
                              className="dashboard-date-input"
                              value={dateRangeDraftEnd || ''}
                              onChange={(e) => setDateRangeDraftEnd(e.target.value || todayIso)}
                              aria-label="Select end date"
                            />
                          </label>
                        </div>
                        <div className="date-range-actions">
                          <button type="button" className="date-range-clear-btn" onClick={() => {
                            const currentDay = todayIso
                            setDateRangeDraftStart(currentDay)
                            setDateRangeDraftEnd(currentDay)
                            setSelectedStartDate(currentDay)
                            setSelectedEndDate(currentDay)
                            setDateRangeOpen(false)
                          }}>
                            Today
                          </button>
                          <button type="button" className="date-range-apply-btn" onClick={applySelectedDateRange}>
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {dashboardLoading && (
                    <span className="date-range-status" aria-live="polite">
                      <span className="mini-spinner" aria-hidden="true" />
                      Updating data...
                    </span>
                  )}

                  {!dashboardLoading && dashboardError && (
                    <span className="date-range-status error" aria-live="polite">{dashboardError}</span>
                  )}
                </div>

                <div className="user-chip">
                  <span className="user-avatar">{(user?.full_name || user?.username || 'A').charAt(0).toUpperCase()}</span>
                  <div className="user-meta">
                    <strong>{user?.full_name || user?.username || (isDeptAdmin ? `${deptDisplayName} Admin` : 'Administrator')}</strong>
                    <small>{isDeptAdmin ? `${deptDisplayName} Administrator` : 'Head Administrator'}</small>
                  </div>
                  <span className="user-caret">▾</span>
                </div>
              </div>
            </header>

            <section className="kpi-grid">
              <article className="kpi-card blue">
                <div className="kpi-header"><span className="kpi-icon">👥</span><span>Total Waiting</span></div>
                <div className="kpi-number">{totalWaiting}</div>
                <div className="kpi-meta"><span className="indicator up">●</span> {analytics?.waiting_tickets ? `${Math.max(totalWaiting - completedToday, 0)} in queue` : 'Live queue'}</div>
              </article>
              <article className="kpi-card navy">
                <div className="kpi-header"><span className="kpi-icon">🧑‍💼</span><span>Currently Serving</span></div>
                <div className="kpi-number">{currentServing}</div>
                <div className="kpi-meta"><span className="indicator good">●</span> {currentServing > 0 ? `${currentServing} customer${currentServing > 1 ? 's' : ''} being assisted` : 'No active service'}</div>
              </article>
              <article className="kpi-card green">
                <div className="kpi-header"><span className="kpi-icon">✅</span><span>Completed</span></div>
                <div className="kpi-number">{completedToday}</div>
                <div className="kpi-meta"><span className="indicator up">●</span> {analytics?.completion_rate ? `${safeNumber(analytics?.completion_rate, 0)}% completion` : 'Real-time count'}</div>
              </article>
              <article className="kpi-card orange">
                <div className="kpi-header"><span className="kpi-icon">⏱️</span><span>Skipped / No-Show</span></div>
                <div className="kpi-number">{skippedToday}</div>
                <div className="kpi-meta"><span className="indicator warning">●</span> {skippedToday > 0 ? `${skippedToday} missed visit${skippedToday > 1 ? 's' : ''}` : 'No skips recorded'}</div>
              </article>
              <article className="kpi-card gold">
                <div className="kpi-header"><span className="kpi-icon">⏲️</span><span>Average Waiting Time</span></div>
                <div className="kpi-number">{formatMinutesCompact(averageWait)}</div>
                <div className="kpi-meta"><span className="indicator good">●</span> Target under 5 min</div>
              </article>
              <article className="kpi-card red">
                <div className="kpi-header"><span className="kpi-icon">🔺</span><span>Longest Waiting Time</span></div>
                <div className="kpi-number">{formatMinutesCompact(longestWaitFromAnalytics)}</div>
                <div className="kpi-meta"><span className="indicator alert">●</span> {longestWaitFromAnalytics > 0 ? 'Peak wait recorded' : 'No waiting spikes'}</div>
              </article>
            </section>

            <section className="dashboard-main-grid">
              <article className="chart-card wide-card queue-volume-card">
                <div className="card-header">
                  <h2 className="dashboard-panel-title">Queue Volume Throughout the Day</h2>
                </div>
                <div className="chart-frame">
                  {queueVolumeSeries.length > 0 ? (
                    <svg viewBox="0 0 500 200" className="line-chart" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="queueFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#4f8cf7" stopOpacity="0.32" />
                          <stop offset="100%" stopColor="#4f8cf7" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <g>
                        {[0, 25, 50, 75, 100].map((y) => (
                          <line key={y} x1="20" x2="480" y1={y + 30} y2={y + 30} stroke="#e2e8f0" strokeDasharray="4 6" />
                        ))}
                      </g>
                      <polyline points={queueVolumePoints} fill="none" stroke="#2a6fe3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points={`${queueVolumePoints} 460,170 30,170`} fill="url(#queueFill)" stroke="none" />
                      {queueVolumeSeries.map((point, index) => {
                        const x = 30 + (index / Math.max(queueVolumeSeries.length - 1, 1)) * 430
                        const y = 150 - (safeNumber(point.count, 0) / queueVolumeMax) * 100
                        return <circle key={point.label || index} cx={x} cy={y} r="4" fill="#2a6fe3"><title>{`${point.label} ? Queue Volume: ${point.count}`}</title></circle>
                      })}
                    </svg>
                  ) : (
                    <div className="empty-state">No queue volume data available for the day.</div>
                  )}
                  <div className="chart-axis-labels">
                    {queueVolumeSeries.map((point, index) => (
                      <span key={point.label || index}>{point.label}</span>
                    ))}
                  </div>
                </div>
              </article>

              <article className="chart-card mini-card kpi-performance-card">
                <div className="card-header">
                  <h2 className="dashboard-panel-title">KPI Performance</h2>
                </div>
                <div className="performance-list">
                  {performanceMetrics.map((metric) => (
                    <div key={metric.label} className="performance-row">
                      <div className="performance-header">
                        <span>{metric.label}</span>
                        <strong>{metric.current}</strong>
                      </div>
                      <div className="progress-track">
                        <span style={{ width: `${Math.max(Math.min(metric.progress, 100), 0)}%` }} className={metric.status === 'On Target' ? 'success' : 'warning'} />
                      </div>
                      <div className="performance-meta">
                        <span>Target: {metric.target}</span>
                        <span className={metric.status === 'On Target' ? 'status success' : 'status warning'}>{metric.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="chart-card mini-card student-guest-card">
                <div className="card-header">
                  <h2 className="dashboard-panel-title">Priority vs Regular Tickets</h2>
                </div>
                <div className="donut-layout">
                  {ticketPriorityChart}
                  <div className="donut-legend">
                    <div className="legend-item">
                      <span className="dot student-dot" /> Priority
                      <strong>{ticketPriorityStats.priority} ({ticketPriorityStats.priorityPct.toFixed(1)}%)</strong>
                    </div>
                    <div className="legend-item">
                      <span className="dot guest-dot" /> Regular
                      <strong>{ticketPriorityStats.regular} ({ticketPriorityStats.regularPct.toFixed(1)}%)</strong>
                    </div>
                  </div>
                </div>
              </article>
            </section>

            <section className={`dashboard-bottom-grid ${isDeptAdmin ? 'dept-admin-bottom-grid' : ''}`}>
              {!isDeptAdmin && (
                <article className="table-card large-card service-performance-card">
                  <div className="card-header">
                    <h2 className="dashboard-panel-title">Service Performance by Office</h2>
                  </div>
                  <div className="table-shell">
                    <table>
                      <thead>
                        <tr>
                          <th>Office/Service</th>
                          <th>Waiting</th>
                          <th>Avg. Waiting</th>
                          <th>Avg. Service</th>
                          <th>Completed</th><th>Skipped</th>
                        </tr>
                      </thead>
                      <tbody>
                        {servicePerformanceRows.length > 0 ? servicePerformanceRows.map((row) => (
                          <tr key={row.office}>
                            <td>{row.office}</td>
                            <td>{row.waiting}</td>
                            <td>{formatMinutesCompact(row.averageWaitingTime)}</td>
                            <td>{formatMinutesCompact(row.averageServiceTime)}</td>
                            <td>{row.completed}</td>
                            <td>{queueHistoryData.filter(ticket => String(ticket.department || '').toLowerCase() === row.office.toLowerCase() && ['cancelled', 'canceled', 'no-show', 'no_show', 'noshow', 'skipped'].includes(normalizeStatus(ticket.status))).length}</td>
                          </tr>
                        )) : (
                          <tr><td colSpan="6" className="empty-cell">No office data available.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <CompletedOfficeChart rows={servicePerformanceRows} />
                </article>
              )}

              <article className="chart-card mini-card wait-trend-card">
                <div className="card-header">
                  <h2 className="dashboard-panel-title">Average Waiting Time Trend</h2>
                </div>
                <div className="trend-chart-wrap">
                  {waitTrendSeries.length > 0 ? (
                    <svg viewBox="0 0 580 180" className="trend-chart" preserveAspectRatio="none">
                      <line x1="30" x2="530" y1="150" y2="150" stroke="#dfe7f5" />
                      <line x1="30" x2="30" y1="20" y2="150" stroke="#dfe7f5" />
                      <line x1="30" x2="530" y1="110" y2="110" stroke="#dfe7f5" strokeDasharray="4 6" />
                      <line x1="30" x2="530" y1="110" y2="110" stroke="#c7d7ef" strokeDasharray="2 8" />
                      <polyline points={waitTrendPoints} fill="none" stroke="#8d4fe7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <div className="empty-state">Average wait trend unavailable.</div>
                  )}
                  <div className="chart-axis-labels small-labels">
                    {waitTrendSeries.map((point, index) => (
                      <span key={point.label || index}>{point.label}</span>
                    ))}
                  </div>
                </div>
              </article>

              <article className="insight-card peak-insights-card">
                <div className="card-header">
                  <h2 className="dashboard-panel-title">Peak Hours & Insights</h2>
                </div>
                <div className="insight-list">
                  <div className="insight-item">
                    <span><i aria-hidden="true">?</i> Peak Queue Period</span>
                    <strong>{peakInsight.peakQueuePeriod}</strong>
                    <small>Average queue: {peakInsight.averageQueue}</small>
                  </div>
                  <div className="insight-item">
                    <span><i aria-hidden="true">?</i> Busiest Office</span>
                    <strong>{peakInsight.busiestOffice}</strong>
                    <small>Based on completed transactions</small>
                  </div>
                  <div className="insight-item">
                    <span><i aria-hidden="true">?</i> Customers Waiting More Than 5 Minutes</span>
                    <strong>{peakInsight.customersWaitingMoreThanFiveMinutes}</strong>
                    <small>{peakInsight.customersWaitingMoreThanFiveMinutes > 0 ? 'Needs attention' : 'Within target'}</small>
                  </div>
                </div>
              </article>

              <article className="table-card large-card staff-card">
                <div className="card-header">
                  <h2 className="dashboard-panel-title">Staff Performance</h2>
                </div>
                <div className="table-shell">
                  <table>
                    <thead>
                      <tr>
                        <th>Staff</th>
                        <th>Office</th>
                        <th>Transactions Served</th>
                        <th>Avg. Service Time</th>
                        <th>Avg. Waiting Time</th>
                        <th>Completion Rate</th>
                        <th>Skip/No-Show</th>
                        <th>Utilization</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffRows.length > 0 ? staffRows.map((row) => (
                        <tr key={row.staff}>
                          <td>{row.staff}</td>
                          <td>{row.office}</td>
                          <td>{row.transactionsServed}</td>
                          <td>{row.averageServiceTime}</td>
                          <td>{row.averageWaitingTime}</td>
                          <td>{row.completionRate}</td>
                          <td>{row.skipNoShow}</td>
                          <td>{row.utilization}</td><td><span className="dashboard-staff-status">{row.status || '?'}</span></td>
                        </tr>
                      )) : (
                        <tr><td colSpan="9" className="empty-cell">No staff performance data available.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="alert-card recent-alerts-card">
                <div className="card-header">
                  <h2 className="dashboard-panel-title">Recent Alerts</h2>
                </div>
                {alertItems.length > 0 ? (
                  <div className="alert-list">
                    {alertItems.map((alert, index) => (
                      <div key={`${alert.severity}-${index}`} className="alert-item">
                        <span className={`alert-tag ${alert.severity.toLowerCase().includes('high') ? 'danger' : alert.severity.toLowerCase().includes('peak') ? 'warning' : 'success'}`} />
                        <div>
                          <strong>{alert.severity}</strong>
                          <small>{alert.detail}</small>
                        </div>
                        <span className="alert-meta">{alert.meta}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">No active alerts. Queue system is operating normally.</div>
                )}
              </article>
            </section>

            {/* INTELLIGENCE SECTION */}
            <section className="intelligence-section">
              <div className="intelligence-section-header">
                <div className="intelligence-header-copy">
                  <div className="intelligence-badge-pill">
                    <span className="intelligence-pulse-beacon" />
                    <span>SYSTEM INTELLIGENCE</span>
                  </div>
                  <h2 className="dashboard-panel-title intelligence-heading">INTELLIGENCE</h2>
                  <p className="intelligence-subheading">
                    Algorithmic queue analytics and dynamic operational forecasts.
                  </p>
                </div>
              </div>

              <article className="intelligence-card-panel">
                <div className="intelligence-panel-header">
                  <div className="intelligence-title-cluster">
                    <div className="intelligence-icon-avatar">
                      <span className="material-symbols-outlined">hourglass_top</span>
                    </div>
                    <div>
                      <h3 className="intelligence-panel-title">Predicted Waiting Time</h3>
                      <p className="intelligence-panel-subtitle">
                        Estimates how long a student/customer will likely wait before being served based on the current queue and historical service performance.
                      </p>
                    </div>
                  </div>
                  <span className="intelligence-live-badge">
                    <span className="material-symbols-outlined">bolt</span>
                    Real-time Prediction
                  </span>
                </div>

                <div className="intelligence-departments-grid">
                  {predictions && predictions.length > 0 ? (
                    predictions.map((dept) => {
                      const status = String(dept.queue_status || 'LOW').toUpperCase();
                      const statusKey = status === 'CRITICAL' ? 'critical' : status === 'HIGH' ? 'high' : status === 'NORMAL' ? 'normal' : 'low';
                      const deptName = getDepartmentDisplayName(dept.department_name);

                      return (
                        <div key={dept.department_key || dept.department_name} className={`intelligence-dept-card status-${statusKey}`}>
                          <div className="dept-card-header">
                            <div>
                              <span className="dept-card-sublabel">Department</span>
                              <h4 className="dept-card-title">{deptName}</h4>
                            </div>
                            <span className={`intelligence-status-pill status-${statusKey}`}>
                              {status}
                            </span>
                          </div>

                          <div className="dept-prediction-hero">
                            <div className="dept-prediction-header-line">
                              <span className="dept-prediction-caption">Predicted Waiting Time</span>
                              <span className="dept-prediction-estimate-badge">Estimate</span>
                            </div>
                            <div className="dept-prediction-value">
                              {dept.predicted_wait_formatted}
                            </div>
                            {dept.status_reason && (
                              <div className="dept-prediction-reason">
                                <span className="material-symbols-outlined">info</span>
                                <span>{dept.status_reason}</span>
                              </div>
                            )}
                          </div>

                          <div className="dept-metrics-table">
                            <div className="dept-metric-box">
                              <span className="metric-box-label">Current Queue</span>
                              <strong className="metric-box-val">{dept.waiting_count}</strong>
                              <span className="metric-box-hint">waiting</span>
                            </div>
                            <div className="dept-metric-box">
                              <span className="metric-box-label">Active Windows</span>
                              <strong className="metric-box-val">{dept.active_windows}</strong>
                              <span className="metric-box-hint">{dept.active_windows === 1 ? 'window open' : 'windows open'}</span>
                            </div>
                            <div className="dept-metric-box">
                              <span className="metric-box-label">Average Service Time</span>
                              <strong className="metric-box-val">
                                {dept.average_service_time_minutes !== null ? `${dept.average_service_time_minutes} min` : 'N/A'}
                              </strong>
                              <span className="metric-box-hint">
                                {dept.data_source === 'today' ? "today's completed" : dept.data_source === 'recent_history' ? 'recent history' : dept.data_source === 'all_history' ? 'historical records' : 'no data'}
                              </span>
                            </div>
                            <div className="dept-metric-box">
                              <span className="metric-box-label">Queue Status</span>
                              <strong className={`metric-box-val status-text-${statusKey}`}>{status}</strong>
                              <span className="metric-box-hint">traffic level</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="intelligence-loading-state">
                      <span className="material-symbols-outlined intelligence-spinner-icon">sync</span>
                      <p>Calculating live department predictions...</p>
                    </div>
                  )}
                </div>
              </article>

              <article className="intelligence-card-panel peak-prediction-panel">
                <div className="intelligence-panel-header">
                  <div className="intelligence-title-cluster">
                    <div className="intelligence-icon-avatar peak-icon-avatar">
                      <span className="material-symbols-outlined">trending_up</span>
                    </div>
                    <div>
                      <h3 className="intelligence-panel-title">Peak Hour Prediction</h3>
                      <p className="intelligence-panel-subtitle">
                        Predicts the busiest upcoming time period for each department based on historical queue arrivals and recent queue activity.
                      </p>
                    </div>
                  </div>
                  <span className="intelligence-live-badge peak-forecast-badge">
                    <span className="material-symbols-outlined">insights</span>
                    Arrival Forecast
                  </span>
                </div>

                <div className="intelligence-departments-grid">
                  {peakPredictions && peakPredictions.length > 0 ? (
                    peakPredictions.map((dept) => {
                      const risk = String(dept.peak_risk || 'NORMAL').toUpperCase();
                      const riskKey = risk === 'CRITICAL' ? 'critical' : risk === 'HIGH' ? 'high' : risk === 'NORMAL' ? 'normal' : 'low';
                      const deptName = getDepartmentDisplayName(dept.department_name);

                      return (
                        <div key={dept.department_key || dept.department_name} className={`intelligence-dept-card peak-dept-card status-${riskKey}`}>
                          <div className="dept-card-header">
                            <div>
                              <span className="dept-card-sublabel">Department</span>
                              <h4 className="dept-card-title">{deptName}</h4>
                            </div>
                            <span className={`intelligence-status-pill peak-risk-pill status-${riskKey}`}>
                              {risk} RISK
                            </span>
                          </div>

                          <div className="dept-prediction-hero peak-prediction-hero">
                            <div className="dept-prediction-header-line">
                              <span className="dept-prediction-caption">Predicted Peak Time</span>
                              {dept.is_upcoming ? (
                                <span className="dept-prediction-estimate-badge peak-badge-upcoming">Upcoming Today</span>
                              ) : (
                                <span className="dept-prediction-estimate-badge peak-badge-concluded">Concluded</span>
                              )}
                            </div>
                            <div className="dept-prediction-value peak-prediction-time">
                              {dept.predicted_peak_formatted || 'Unavailable'}
                            </div>
                            {dept.status_reason && (
                              <div className="dept-prediction-reason">
                                <span className="material-symbols-outlined">info</span>
                                <span>{dept.status_reason}</span>
                              </div>
                            )}
                          </div>

                          <div className="dept-metrics-table peak-metrics-table">
                            <div className="dept-metric-box">
                              <span className="metric-box-label">Expected Queue Volume</span>
                              <strong className="metric-box-val">{dept.expected_arrivals_formatted || 'N/A'}</strong>
                              <span className="metric-box-hint">projected arrivals</span>
                            </div>
                            <div className="dept-metric-box">
                              <span className="metric-box-label">Peak Risk</span>
                              <strong className={`metric-box-val status-text-${riskKey}`}>{risk}</strong>
                              <span className="metric-box-hint">capacity risk</span>
                            </div>
                            <div className="dept-metric-box">
                              <span className="metric-box-label">Confidence</span>
                              <strong className="metric-box-val">{dept.confidence_text || `${dept.confidence}%`}</strong>
                              <span className="metric-box-hint">historical accuracy</span>
                            </div>
                            <div className="dept-metric-box peak-pattern-box">
                              <span className="metric-box-label">Historical Pattern</span>
                              <span className="pattern-note" title={dept.historical_pattern}>
                                {dept.historical_pattern || 'Standard pattern'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="intelligence-loading-state">
                      <span className="material-symbols-outlined intelligence-spinner-icon">sync</span>
                      <p>Calculating peak hour predictions...</p>
                    </div>
                  )}
                </div>
              </article>

              <article className="intelligence-card-panel congestion-prediction-panel">
                <div className="intelligence-panel-header">
                  <div className="intelligence-title-cluster">
                    <div className="intelligence-icon-avatar congestion-icon-avatar">
                      <span className="material-symbols-outlined">warning</span>
                    </div>
                    <div>
                      <h3 className="intelligence-panel-title">Smart Queue Congestion Risk</h3>
                      <p className="intelligence-panel-subtitle">
                        Multi-factor capacity analysis evaluating queue length, arrival velocity, service speed, active windows, and growth trends.
                      </p>
                    </div>
                  </div>
                  <span className="intelligence-live-badge congestion-forecast-badge">
                    <span className="material-symbols-outlined">speed</span>
                    Risk Assessment
                  </span>
                </div>

                <div className="intelligence-departments-grid">
                  {congestionRisks && congestionRisks.length > 0 ? (
                    congestionRisks.map((dept) => {
                      const risk = String(dept.risk_level || 'NORMAL').toUpperCase();
                      const riskKey = risk === 'CRITICAL' ? 'critical' : risk === 'HIGH' ? 'high' : risk === 'NORMAL' ? 'normal' : 'low';
                      const deptName = getDepartmentDisplayName(dept.department_name);
                      const trend = dept.queue_trend || 'STABLE';
                      const trendKey = trend.toLowerCase().replace(/\s+/g, '-');
                      const score = dept.risk_score ?? 0;

                      return (
                        <div key={dept.department_key || dept.department_name} className={`intelligence-dept-card congestion-dept-card status-${riskKey}`}>
                          <div className="dept-card-header">
                            <div>
                              <span className="dept-card-sublabel">Department</span>
                              <h4 className="dept-card-title">{deptName}</h4>
                            </div>
                            <span className={`intelligence-status-pill congestion-risk-pill status-${riskKey}`}>
                              {risk === 'CRITICAL' && '🔴 '}
                              {risk === 'HIGH' && '🟠 '}
                              {risk === 'NORMAL' && '🟡 '}
                              {risk === 'LOW' && '🟢 '}
                              {risk} RISK
                            </span>
                          </div>

                          <div className="dept-prediction-hero congestion-hero">
                            <div className="dept-prediction-header-line">
                              <span className="dept-prediction-caption">Congestion Risk Score</span>
                              <span className={`congestion-score-badge status-${riskKey}`}>
                                {score} / 100
                              </span>
                            </div>
                            <div className="congestion-score-bar-wrapper">
                              <div
                                className={`congestion-score-bar-fill status-${riskKey}`}
                                style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
                              />
                            </div>
                            {dept.peak_period_approaching && (
                              <div className="congestion-peak-alert">
                                <span className="material-symbols-outlined">crisis_alert</span>
                                <span>Peak period approaching{dept.predicted_peak_formatted ? ` (${dept.predicted_peak_formatted})` : ''} — risk elevated</span>
                              </div>
                            )}
                          </div>

                          <div className="dept-metrics-table congestion-metrics-table">
                            <div className="dept-metric-box">
                              <span className="metric-box-label">Current Queue</span>
                              <strong className="metric-box-val">{dept.waiting_count}</strong>
                              <span className="metric-box-hint">waiting customers</span>
                            </div>
                            <div className="dept-metric-box">
                              <span className="metric-box-label">Predicted Wait</span>
                              <strong className="metric-box-val">{dept.predicted_wait_formatted || 'Unavailable'}</strong>
                              <span className="metric-box-hint">estimated delay</span>
                            </div>
                            <div className="dept-metric-box">
                              <span className="metric-box-label">Active Windows</span>
                              <strong className="metric-box-val">{dept.active_windows}</strong>
                              <span className="metric-box-hint">{dept.active_windows === 1 ? 'window open' : 'windows open'}</span>
                            </div>
                            <div className="dept-metric-box">
                              <span className="metric-box-label">Arrival Rate</span>
                              <strong className="metric-box-val">{dept.arrival_rate_per_hour}/hour</strong>
                              <span className="metric-box-hint">incoming flow</span>
                            </div>
                            <div className="dept-metric-box">
                              <span className="metric-box-label">Service Rate</span>
                              <strong className="metric-box-val">{dept.service_rate_per_hour}/hour</strong>
                              <span className="metric-box-hint">completion pace</span>
                            </div>
                            <div className="dept-metric-box">
                              <span className="metric-box-label">Queue Trend</span>
                              <strong className={`metric-box-val trend-val-${trendKey}`}>{trend}</strong>
                              <span className="metric-box-hint">growth momentum</span>
                            </div>
                          </div>

                          {dept.reason && (
                            <div className="congestion-reason-card">
                              <div className="congestion-note-title">
                                <span className="material-symbols-outlined">info</span>
                                <strong>Reason</strong>
                              </div>
                              <p className="congestion-note-text">{dept.reason}</p>
                            </div>
                          )}

                          {dept.recommended_action && (
                            <div className={`congestion-action-card action-${riskKey}`}>
                              <div className="congestion-note-title">
                                <span className="material-symbols-outlined">tips_and_updates</span>
                                <strong>Recommended Action</strong>
                              </div>
                              <p className="congestion-note-text">{dept.recommended_action}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="intelligence-loading-state">
                      <span className="material-symbols-outlined intelligence-spinner-icon">sync</span>
                      <p>Calculating queue congestion risks...</p>
                    </div>
                  )}
                </div>
              </article>
            </section>
          </div>
        </>
      )}

      {activePage === 'monitoring' && (
        <div className="monitoring-content">
          <div className="section-header monitoring-header">
            <div className="monitoring-header-copy">
              <h2>Queue Monitoring</h2>
              <p>Monitor every active window, filter by department or status, and track real-time queue activity.</p>
            </div>
            <span className="monitoring-live-pill">● Live windows</span>
          </div>

          <div className="monitoring-summary-grid">
            <div className="monitoring-summary-card monitoring-summary-card--active">
              <div className="monitoring-card-icon monitoring-card-icon--blue">▣</div>
              <div className="monitoring-summary-body">
                <span>Active Windows</span>
                <strong>{activeWindows}</strong>
              </div>
              <small>Currently serving</small>
            </div>
            <div className="monitoring-summary-card monitoring-summary-card--idle">
              <div className="monitoring-card-icon monitoring-card-icon--gold">◔</div>
              <div className="monitoring-summary-body">
                <span>Idle Windows</span>
                <strong>{idleWindows}</strong>
              </div>
              <small>Ready to serve</small>
            </div>
            <div className="monitoring-summary-card monitoring-summary-card--queue">
              <div className="monitoring-card-icon monitoring-card-icon--purple">▤</div>
              <div className="monitoring-summary-body">
                <span>Average Queue</span>
                <strong>{averageQueue}</strong>
              </div>
              <small>Customers per window</small>
            </div>
          </div>

          <div className="monitoring-toolbar">
            <div className="monitoring-search">
              <span className="monitoring-search-icon">⌕</span>
              <input
                type="text"
                placeholder="Search window, department, ticket, or staff"
                value={monitorSearch}
                onChange={(event) => setMonitorSearch(event.target.value)}
              />
            </div>

            <label className="settings-field compact monitoring-field">
              <span>Department</span>
              <select
                value={monitorDepartmentFilter}
                onChange={(event) => !isDeptAdmin && setMonitorDepartmentFilter(event.target.value)}
                disabled={isDeptAdmin}
              >
                {isDeptAdmin ? (
                  <option value={userDeptName}>{deptDisplayName}</option>
                ) : (
                  <>
                    <option value="All">All Departments</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Registrar">Registrar</option>
                    <option value="ITM">ITM</option>
                    <option value="Admission">Admission</option>
                  </>
                )}
              </select>
            </label>

            <label className="settings-field compact monitoring-field">
              <span>Status</span>
              <select value={monitorStatusFilter} onChange={(event) => setMonitorStatusFilter(event.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Serving">Serving</option>
                <option value="Idle">Idle</option>
              </select>
            </label>

            <label className="settings-toggle compact monitoring-toggle">
              <input type="checkbox" checked={monitorAutoRefresh} onChange={(event) => setMonitorAutoRefresh(event.target.checked)} />
              <span>Auto Refresh</span>
            </label>
          </div>

          <div className="monitoring-grid">
            {filteredQueueWindows.map((window) => {
              const statusLabel = window.status
              const queueValue = window.queue ?? 0
              const rawStaff = window.staffName || (window.staff && typeof window.staff === 'object' ? (window.staff.name || window.staff.username) : window.staff) || ''
              const assignedStaff = typeof rawStaff === 'string' && rawStaff.trim() ? rawStaff.trim() : 'Unassigned'
              const departmentTone = window.department === 'Cashier' ? 'cashier' : 'registrar'

              return (
                <div key={`${window.department}-${window.window}`} className={`monitoring-card monitoring-card--${departmentTone}`}>
                  <div className="monitoring-card-header">
                    <div className="monitoring-window-name">
                      <strong>{window.window}{assignedStaff && assignedStaff !== 'Unassigned' ? ` — ${assignedStaff}` : ''}</strong>
                      <span className="monitoring-department-label">{window.department}</span>
                    </div>
                    <span className={`monitor-pill ${window.busy ? 'busy' : 'idle'}`}>{statusLabel}</span>
                  </div>

                  <div className="monitoring-card-divider" />

                  <div className="monitoring-card-body">
                    <div className="monitoring-data-block">
                      <span className="monitoring-data-label">Current Ticket</span>
                      <strong className="monitoring-data-value">{window.ticket || 'None'}</strong>
                    </div>

                    <div className="monitoring-card-divider" />

                    <div className="monitoring-data-block">
                      <span className="monitoring-data-label">Queue</span>
                      <strong className="monitoring-data-value">{queueValue}</strong>
                    </div>

                    <div className="monitoring-card-divider" />

                    <div className="monitoring-data-block">
                      <span className="monitoring-data-label">Assigned Staff</span>
                      <strong className="monitoring-data-value">{assignedStaff}</strong>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activePage === 'analytics' && (
        <Analytics department={userDeptName} user={user} />
      )}

      {activePage === 'reports' && <Reports user={user} />}

      {activePage === 'staff' && (
        <div className="admin-standard-page admin-staff-page">
          <div className="section-header monitoring-header">
            <div className="monitoring-header-copy">
              <h2>Staff Management</h2>
              <p className="section-subtitle">
                {isDeptAdmin
                  ? `Manage ${deptDisplayName} department staff accounts.`
                  : 'Manage staff accounts, department admins, and account status.'}
              </p>
            </div>
            <div>
              <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
                {showAddForm ? 'Cancel' : (isDeptAdmin ? '+ Add Staff' : '+ Add Staff / Admin')}
              </button>
            </div>
          </div>
          {showAddForm && (
            <form className="add-staff-form" onSubmit={handleAdd}>
              <div className="form-row">
                <input type="text" placeholder="Username" required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                <input type="password" placeholder="Password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                <input type="password" placeholder="Confirm Password" required value={form.password_confirmation} onChange={e => setForm({ ...form, password_confirmation: e.target.value })} />
                <input type="text" placeholder="Full Name" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
                {!isDeptAdmin ? (
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value, position: e.target.value === 'security' ? '' : (form.position || 'cashier') })}>
                    <option value="staff">Staff</option>
                    <option value="dept_admin">Department Admin</option>
                    <option value="security">Security</option>
                  </select>
                ) : (
                  <select value="staff" disabled>
                    <option value="staff">Staff</option>
                  </select>
                )}
                {!isDeptAdmin && (form.role === 'staff' || form.role === 'dept_admin') && (
                  <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value, assigned_window_id: '' })}>
                    <option value="cashier">Accounting / Cashier</option>
                    <option value="registrar">Registrar</option>
                    <option value="itm">ITM</option>
                    <option value="admission">Admission</option>
                  </select>
                )}
                {isDeptAdmin && (
                  <select value={userDeptPosition} disabled>
                    <option value={userDeptPosition}>{deptDisplayName}</option>
                  </select>
                )}
                {form.role === 'staff' && (
                  <select aria-label="Assigned window" value={form.assigned_window_id} onChange={e => setForm({ ...form, assigned_window_id: e.target.value })}>
                    <option value="">Select assigned window</option>
                    {serviceWindows.filter(window => {
                      const wDept = String(window.department).toLowerCase()
                      const targetDept = String(isDeptAdmin ? userDeptPosition : form.position).toLowerCase()
                      const sameDept = wDept === targetDept || (['cashier', 'accounting'].includes(wDept) && ['cashier', 'accounting'].includes(targetDept))
                      return sameDept && (!window.staff_id || window.id === Number(form.assigned_window_id))
                    }).map(window => (
                      <option key={window.id} value={window.id}>Window {window.window_number}</option>
                    ))}
                  </select>
                )}
                {form.role === 'security' && (
                  <>
                    <input type="password" placeholder="Security PIN Code" required value={form.security_code} onChange={e => setForm({ ...form, security_code: e.target.value })} />
                    <input type="password" placeholder="Confirm Security Code" required value={form.security_code_confirmation} onChange={e => setForm({ ...form, security_code_confirmation: e.target.value })} />
                  </>
                )}
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <button type="submit" className="btn btn-primary">Add</button>
              </div>
            </form>
          )}
          <div className="staff-list">
            {staffLoadState === 'loading' && staff.length === 0 && (
              <p className="empty-text">Loading staff records...</p>
            )}
            {staffLoadState === 'error' && (
              <div className="staff-load-error">
                <span>Unable to load staff records.</span>
                <button type="button" className="btn btn-small btn-secondary" onClick={loadStaffData}>Retry</button>
              </div>
            )}
            {filteredStaff.map((s) => (
              <div key={s.user_id} className="staff-row">
                {editingId === s.user_id ? (
                  <form className="staff-edit-row" onSubmit={(event) => handleEdit(s.user_id, event)}>
                    <input type="text" value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} aria-label="Username" required />
                    <input type="text" value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} />
                    {!isDeptAdmin && editForm.role !== 'security' && (
                      <select value={editForm.position} onChange={e => setEditForm({ ...editForm, position: e.target.value, assigned_window_id: '' })}>
                        <option value="cashier">Accounting / Cashier</option>
                        <option value="registrar">Registrar</option>
                        <option value="itm">ITM</option>
                        <option value="admission">Admission</option>
                      </select>
                    )}
                    {isDeptAdmin && (
                      <select value={userDeptPosition} disabled>
                        <option value={userDeptPosition}>{deptDisplayName}</option>
                      </select>
                    )}
                    {editForm.role === 'staff' && (
                      <select aria-label="Assigned window" value={editForm.assigned_window_id} onChange={e => setEditForm({ ...editForm, assigned_window_id: e.target.value })}>
                        <option value="">Select assigned window</option>
                        {serviceWindows.filter(window => {
                          const wDept = String(window.department).toLowerCase()
                          const targetDept = String(editForm.position).toLowerCase()
                          const sameDept = wDept === targetDept || (['cashier', 'accounting'].includes(wDept) && ['cashier', 'accounting'].includes(targetDept))
                          return sameDept && (!window.staff_id || window.staff_id === s.user_id)
                        }).map(window => (
                          <option key={window.id} value={window.id}>Window {window.window_number}</option>
                        ))}
                      </select>
                    )}
                    <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <input type="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="New Password (optional)" />
                    <input type="password" value={editForm.password_confirmation} onChange={e => setEditForm({ ...editForm, password_confirmation: e.target.value })} placeholder="Confirm New Password" />
                    {editForm.role === 'security' && (
                      <>
                        <input type="password" value={editForm.security_code} onChange={e => setEditForm({ ...editForm, security_code: e.target.value })} placeholder="New Security Code (optional)" />
                        <input type="password" value={editForm.security_code_confirmation} onChange={e => setEditForm({ ...editForm, security_code_confirmation: e.target.value })} placeholder="Confirm Security Code" />
                      </>
                    )}
                    <button type="submit" className="btn btn-small btn-primary" disabled={staffSavingId !== null}>{staffSavingId === s.user_id ? 'Saving...' : 'Save'}</button>
                    <button type="button" className="btn btn-small btn-secondary" onClick={() => setEditingId(null)} disabled={staffSavingId !== null}>Cancel</button>
                  </form>
                ) : (
                  <>
                    <div className="staff-info-row">
                      <strong style={{ color: 'var(--loa-navy, #0F172A)', fontWeight: 700 }}>{s.full_name?.trim() || s.username || 'Unknown Staff'}</strong>
                      <span className="staff-username">@{s.username}</span>
                      {s.role === 'dept_admin' || s.is_dept_admin ? (
                        <>
                          <span className="badge-sm badge-admin" style={{ background: '#7c3aed', color: '#fff' }}>DEPT ADMIN</span>
                          <span className="badge-sm" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                            {getDepartmentDisplayName(s.position || s.department)}
                          </span>
                        </>
                      ) : s.role === 'security' ? (
                        <span className="badge-sm badge-security">SECURITY</span>
                      ) : (
                        <span className={`badge-sm ${s.position === 'cashier' ? 'badge-cashier' : s.position === 'itm' ? 'badge-itm' : 'badge-registrar'}`}>
                          {s.position ? s.position.toUpperCase() : 'STAFF'}
                        </span>
                      )}
                      <span className={`badge-sm ${s.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>{s.status}</span>
                      {s.assigned_window && <span className="staff-username">{s.assigned_window.department} Window {s.assigned_window.window_number}</span>}
                    </div>
                    <div className="staff-actions-row">
                      <button className="btn btn-small btn-secondary" onClick={() => startEdit(s)}>Edit</button>
                      <button className="btn btn-small btn-danger" onClick={() => handleDelete(s.user_id, s.full_name?.trim() || s.username || 'Unknown Staff')}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {staffLoadState === 'success' && filteredStaff.length === 0 && <p className="empty-text">No staff members found.</p>}
          </div>

        </div>
      )}

      {activePage === 'settings' && (
        <div className="admin-standard-page admin-settings-page settings-page">
          <div className="section-header">
            <div>
              <h2>Display Board Settings</h2>
              <p className="settings-subtitle">Configure active services and TV display settings, and preview changes instantly.</p>
            </div>
            <div className="settings-actions">
              <button type="button" className="btn btn-secondary" onClick={handleResetDisplaySettings}>Reset</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveDisplaySettings}
                disabled={displayPublishing || Boolean(publishValidationReason)}
                title={publishValidationReason || (displayPublishing ? 'Publishing...' : 'Publish to Display')}
              >
                {displayPublishing ? 'Publishing...' : 'Publish to Display'}
              </button>
            </div>
          </div>
          <div className="settings-status">{displayStatus}</div>
          {publishValidationReason && (
            <div className="settings-validation-alert" role="alert" style={{ color: '#dc2626', fontWeight: 600, marginTop: '8px' }}>
              ⚠️ Cannot publish: {publishValidationReason}
            </div>
          )}

          <section className="settings-card department-activation-settings">
            <h3>Active Departments</h3>
            <p>Select the departments available on the kiosk and to staff. Publish to apply your changes.</p>
            <div className="department-activation-options">
              {DEPARTMENTS.map(({ name }) => (
                <label key={name}>
                  <input type="checkbox" checked={enabledDepartments(displayConfig.settings).includes(name)}
                    onChange={event => {
                      const checked = event.target.checked
                      updateDisplayConfig(current => ({ ...current, settings: { ...current.settings,
                        enabledDepartments: DEPARTMENTS.map(item => item.name).filter(item => item === name ? checked : enabledDepartments(current.settings).includes(item)),
                      } }))
                      setDisplayStatus('Unsaved changes')
                    }} />
                  <span>{DEPARTMENTS.find(department => department.name === name)?.label || name}</span>
                </label>
              ))}
            </div>
          </section>

          <div className="settings-grid settings-display-grid">
            <section className="settings-card settings-customization-card display-text-settings" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
              <div className="section-header compact">
                <h3>Display Text &amp; Labels</h3>
                <span className="section-badge">Board Text</span>
              </div>
              <DisplayTextEditor
                displayConfig={displayConfig}
                displayWindowOptions={displayWindowOptions}
                updateDisplayLabels={updateDisplayLabels}
                updateFontControl={updateFontControl}
              />
            </section>

            <section className="settings-card settings-customization-card display-color-settings" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
              <div className="section-header compact">
                <h3>Display Colors</h3>
                <button type="button" className="btn btn-secondary" onClick={resetDisplayColors}>Reset Colors to Default</button>
              </div>
              <p>Changes appear in the live TV preview and are saved when you publish display settings.</p>
              <label className="settings-field">
                <span>Main Display Background</span>
                <input
                  type="color"
                  value={displayConfig.settings.backgroundColor || DEFAULT_DISPLAY_BACKGROUND_COLOR}
                  onChange={event => {
                    const newValue = event.target.value
                    const currentText = displayConfig.settings.dateTimeTextColor || DEFAULT_DATE_TIME_TEXT_COLOR
                    let nextText = currentText
                    if (getColorContrastRatio(currentText, newValue) < 4.5) {
                      nextText = getColorContrastRatio('#071b4d', newValue) > getColorContrastRatio('#ffffff', newValue) ? '#071b4d' : '#ffffff'
                    }
                    updateDisplayConfig(current => ({
                      ...current,
                      settings: { ...current.settings, backgroundColor: newValue, dateTimeTextColor: nextText, backgroundType: 'solid' },
                    }))
                  }}
                  aria-label="Main display background color"
                  style={{ height: '40px', cursor: 'pointer' }}
                />
              </label>
              <fieldset className="display-color-group">
                <legend>General Display Colors</legend>
                <div className="display-color-picker-grid">
                  {[
                    ['nowServingBackgroundColor', 'Now Serving Panel Background'],
                    ['nowServingTextColor', 'Now Serving Text Color'],
                    ['dateTimeTextColor', 'Date/Time Text Color'],
                  ].map(([settingKey, label]) => {
                    const textSetting = settingKey !== 'nowServingBackgroundColor'
                    const contrastBackground = settingKey === 'nowServingTextColor' ? nowServingBackground : solidBackground
                    const contrast = textSetting
                      ? getColorContrastRatio(displayConfig.settings[settingKey], contrastBackground)
                      : null
                    const readable = contrast >= 4.5

                    return (
                      <label key={settingKey} className="settings-field">
                        <span>{label}</span>
                        <input
                          type="color"
                          value={displayConfig.settings[settingKey]}
                          onChange={event => {
                            const newValue = event.target.value
                            if (settingKey === 'nowServingBackgroundColor') {
                              const currentText = displayConfig.settings.nowServingTextColor || DEFAULT_NOW_SERVING_TEXT_COLOR
                              let nextText = currentText
                              if (getColorContrastRatio(currentText, newValue) < 4.5) {
                                nextText = getColorContrastRatio('#071b4d', newValue) > getColorContrastRatio('#ffffff', newValue) ? '#071b4d' : '#ffffff'
                              }
                              updateDisplayConfig(current => ({
                                ...current,
                                settings: { ...current.settings, nowServingBackgroundColor: newValue, nowServingTextColor: nextText },
                              }))
                            } else {
                              updateDisplayConfig(current => ({
                                ...current,
                                settings: { ...current.settings, [settingKey]: newValue },
                              }))
                            }
                          }}
                          aria-label={label}
                          aria-describedby={textSetting ? `${settingKey}-contrast` : undefined}
                          style={{ height: '40px', cursor: 'pointer' }}
                        />
                        {textSetting && (
                          <small
                            id={`${settingKey}-contrast`}
                            className={`display-color-contrast ${readable ? 'is-readable' : 'is-low-contrast'}`}
                          >
                            Contrast: {contrast.toFixed(2)}:1
                          </small>
                        )}
                      </label>
                    )
                  })}
                  <label className="settings-field">
                    <span>Window Ticket Number Text Color</span>
                    <input
                      type="color"
                      value={windowTicketTextColor}
                      onChange={event => updateDisplayConfig(current => ({
                        ...current,
                        settings: { ...current.settings, windowTicketTextColor: event.target.value },
                      }))}
                      aria-label="Window ticket number text color"
                      aria-describedby="window-ticket-text-color-contrast"
                      style={{ height: '40px', cursor: 'pointer' }}
                    />
                    <small
                      id="window-ticket-text-color-contrast"
                      className={`display-color-contrast ${windowTicketTextColorIsReadable ? 'is-readable' : 'is-low-contrast'}`}
                    >
                      {windowTicketTextContrast.toFixed(2)}:1 minimum contrast across active department windows
                    </small>
                  </label>
                </div>
                {!windowTicketTextColorIsReadable && (
                  <p className="display-color-validation" role="status">
                    Notice: Ticket number text color has low contrast against some window backgrounds. Windows with low contrast will automatically use their window text color to guarantee readability on TV.
                  </p>
                )}
                {!generalTextColorsAreReadable && (
                  <p className="display-color-validation" role="status">
                    Recommendation: Choose Now Serving and date/time text colors with at least 4.5:1 contrast against their backgrounds for best readability.
                  </p>
                )}
              </fieldset>
              <fieldset className="display-color-group">
                <legend>Department Window Colors</legend>
                <div className="display-service-color-list">
                {Object.entries(DEFAULT_DISPLAY_PANEL_COLORS).map(([department, defaultColors]) => {
                  const colors = departmentColors[department] || defaultColors
                  const contrast = getColorContrastRatio(colors.text, colors.background)
                  const readable = contrast >= 4.5

                  return (
                    <fieldset key={department} className="display-service-color">
                      <legend>{department}</legend>
                      <label className="settings-field">
                        <span>Window/Panel Background Color</span>
                        <input
                          type="color"
                          value={colors.background}
                          onChange={event => {
                            const newBackground = event.target.value
                            const currentText = colors.text || defaultColors.text
                            const currentContrast = getColorContrastRatio(currentText, newBackground)
                            let nextText = currentText
                            if (currentContrast < 4.5) {
                              const darkContrast = getColorContrastRatio('#071b4d', newBackground)
                              const whiteContrast = getColorContrastRatio('#ffffff', newBackground)
                              nextText = darkContrast > whiteContrast ? '#071b4d' : '#ffffff'
                            }
                            updateDisplayConfig(current => ({
                              ...current,
                              settings: {
                                ...current.settings,
                                panelColors: {
                                  ...(current.settings.panelColors || DEFAULT_DISPLAY_PANEL_COLORS),
                                  [department]: {
                                    ...(current.settings.panelColors?.[department] || defaultColors),
                                    background: newBackground,
                                    text: nextText,
                                  },
                                },
                              },
                            }))
                          }}
                          aria-label={`${department} panel background color`}
                          style={{ height: '40px', cursor: 'pointer' }}
                        />
                      </label>
                      <label className="settings-field">
                        <span>Window Text Color</span>
                        <input
                          type="color"
                          value={colors.text}
                          onChange={event => updateDisplayConfig(current => ({
                            ...current,
                            settings: {
                              ...current.settings,
                              panelColors: {
                                ...(current.settings.panelColors || DEFAULT_DISPLAY_PANEL_COLORS),
                                [department]: {
                                  ...(current.settings.panelColors?.[department] || defaultColors),
                                  text: event.target.value,
                                },
                              },
                            },
                          }))}
                          aria-label={`${department} panel text color`}
                          aria-describedby={`${department.toLowerCase()}-contrast`}
                          style={{ height: '40px', cursor: 'pointer' }}
                        />
                      </label>
                      <span
                        id={`${department.toLowerCase()}-contrast`}
                        className={`display-color-contrast ${readable ? 'is-readable' : 'is-low-contrast'}`}
                        role="status"
                      >
                        Contrast: {contrast.toFixed(2)}:1 {readable ? '(readable)' : '(low contrast - consider adjusting for better readability)'}
                      </span>
                    </fieldset>
                  )
                })}
                </div>
                {!panelColorsAreReadable && (
                  <p className="display-color-validation" role="status">
                    Recommendation: Some active window colors have low contrast with their text. Ensure text remains readable from a distance on the TV.
                  </p>
                )}
              </fieldset>
              <fieldset className="display-color-group">
                <legend>Waiting Queue Colors</legend>
                <div className="display-color-picker-grid">
                  <label className="settings-field">
                    <span>Waiting Queue Background Color</span>
                    <input
                      type="color"
                      value={waitingQueueColors.background}
                      onChange={event => {
                        const newValue = event.target.value
                        const currentText = waitingQueueColors.text || DEFAULT_WAITING_QUEUE_COLORS.text
                        let nextText = currentText
                        if (getColorContrastRatio(currentText, newValue) < 4.5) {
                          nextText = getColorContrastRatio('#071b4d', newValue) > getColorContrastRatio('#ffffff', newValue) ? '#071b4d' : '#ffffff'
                        }
                        updateDisplayConfig(current => ({
                          ...current,
                          settings: {
                            ...current.settings,
                            waitingQueueColors: {
                              background: newValue,
                              text: nextText,
                            },
                          },
                        }))
                      }}
                      aria-label="Waiting queue background color"
                      style={{ height: '40px', cursor: 'pointer' }}
                    />
                  </label>
                  <label className="settings-field">
                    <span>Waiting Queue Text Color</span>
                    <input
                      type="color"
                      value={waitingQueueColors.text}
                      onChange={event => updateDisplayConfig(current => ({
                        ...current,
                        settings: {
                          ...current.settings,
                          waitingQueueColors: {
                            ...(current.settings.waitingQueueColors || DEFAULT_WAITING_QUEUE_COLORS),
                            text: event.target.value,
                          },
                        },
                      }))}
                      aria-label="Waiting queue text color"
                      aria-describedby="waiting-queue-color-contrast"
                      style={{ height: '40px', cursor: 'pointer' }}
                    />
                  </label>
                </div>
                <span
                  id="waiting-queue-color-contrast"
                  className={`display-color-contrast ${waitingQueueColorsAreReadable ? 'is-readable' : 'is-low-contrast'}`}
                  role="status"
                >
                  Contrast: {getColorContrastRatio(waitingQueueColors.text, waitingQueueColors.background).toFixed(2)}:1 {waitingQueueColorsAreReadable ? '(readable)' : '(low contrast - consider adjusting for better readability)'}
                </span>
                {!waitingQueueColorsAreReadable && (
                  <p className="display-color-validation" role="status">
                    Recommendation: Increase waiting queue text/background contrast to at least 4.5:1 for optimal TV visibility.
                  </p>
                )}
              </fieldset>
            </section>

            {/* Announcements & Voice Alerts Card */}
            <section className="settings-card settings-customization-card" style={{ padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
              <div className="section-header compact">
                <h3>Announcements, Audio & Clock</h3>
                <span className="section-badge">Audio / Ticker</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label className="settings-toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="checkbox" checked={displayConfig.settings.announcementEnabled} onChange={(event) => updateDisplayConfig((current) => ({ ...current, settings: { ...current.settings, announcementEnabled: event.target.checked } }))} />
                  <span>Enable scrolling announcement ticker</span>
                </label>
                <fieldset className="display-text-group">
                  <legend>Announcement Banner</legend>
                  <label className="settings-field">
                    <span>Scrolling Announcement Text</span>
                    <textarea
                      value={displayConfig.settings.announcement}
                      onChange={event => updateDisplayConfig(current => ({
                        ...current, settings: { ...current.settings, announcement: event.target.value },
                      }))}
                      aria-label="Scrolling announcement text"
                      rows={3}
                    />
                  </label>
                </fieldset>
                <fieldset className="display-color-group">
                  <legend>Announcement Banner Colors</legend>
                  <div className="display-color-picker-grid">
                    <label className="settings-field">
                      <span>Banner Background Color</span>
                      <input
                        type="color"
                        value={displayConfig.settings.accentColor}
                        onChange={event => {
                          const newValue = event.target.value
                          const currentText = displayConfig.settings.announcementTextColor || DEFAULT_ANNOUNCEMENT_TEXT_COLOR
                          let nextText = currentText
                          if (getColorContrastRatio(currentText, newValue) < 4.5) {
                            nextText = getColorContrastRatio('#071b4d', newValue) > getColorContrastRatio('#ffffff', newValue) ? '#071b4d' : '#ffffff'
                          }
                          updateDisplayConfig(current => ({
                            ...current,
                            settings: { ...current.settings, accentColor: newValue, announcementTextColor: nextText },
                          }))
                        }}
                        aria-label="Banner background color"
                        style={{ height: '40px', cursor: 'pointer' }}
                      />
                    </label>
                    <label className="settings-field">
                      <span>Banner Text Color</span>
                      <input
                        type="color"
                        value={displayConfig.settings.announcementTextColor}
                        onChange={event => updateDisplayConfig(current => ({
                          ...current,
                          settings: { ...current.settings, announcementTextColor: event.target.value },
                        }))}
                        aria-label="Banner text color"
                        aria-describedby="announcement-color-contrast"
                        style={{ height: '40px', cursor: 'pointer' }}
                      />
                    </label>
                  </div>
                  <span
                    id="announcement-color-contrast"
                    className={`display-color-contrast ${announcementColorsAreReadable ? 'is-readable' : 'is-low-contrast'}`}
                    role="status"
                  >
                    Contrast: {getColorContrastRatio(displayConfig.settings.announcementTextColor, displayConfig.settings.accentColor).toFixed(2)}:1 {announcementColorsAreReadable ? '(readable)' : '(low contrast - consider adjusting for better readability)'}
                  </span>
                  {!announcementColorsAreReadable && (
                    <p className="display-color-validation" role="status">
                      Recommendation: Increase banner text/background contrast to at least 4.5:1 for optimal TV visibility.
                    </p>
                  )}
                </fieldset>
                <label className="settings-field">
                  <span>Announcement Speed</span>
                  <select value={displayConfig.settings.announcementSpeed} onChange={(event) => updateDisplayConfig((current) => ({ ...current, settings: { ...current.settings, announcementSpeed: event.target.value } }))}>
                    <option value="slow">Slow</option>
                    <option value="medium">Medium</option>
                    <option value="fast">Fast</option>
                  </select>
                </label>
                <label className="settings-toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input type="checkbox" checked={displayConfig.settings.voiceEnabled} onChange={(event) => updateDisplayConfig((current) => ({ ...current, settings: { ...current.settings, voiceEnabled: event.target.checked } }))} />
                  <span>Enable voice announcements</span>
                </label>
                <label className="settings-field">
                  <span>Voice Announcement Language</span>
                  <select value={displayConfig.settings.voiceLanguage} onChange={(event) => updateDisplayConfig((current) => ({ ...current, settings: { ...current.settings, voiceLanguage: event.target.value } }))}>
                    <option value="english">English</option>
                    <option value="filipino">Filipino</option>
                  </select>
                </label>
                <label className="settings-field">
                  <span>Voice Announcement Speed</span>
                  <select value={displayConfig.settings.voiceSpeed} onChange={(event) => updateDisplayConfig((current) => ({ ...current, settings: { ...current.settings, voiceSpeed: event.target.value } }))}>
                    <option value="slow">Slow</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Fast</option>
                  </select>
                </label>
                <label className="settings-field">
                  <span>Voice Volume</span>
                  <input type="range" min="0" max="1" step="0.05" value={displayConfig.settings.voiceVolume} onChange={(event) => updateDisplayConfig((current) => ({ ...current, settings: { ...current.settings, voiceVolume: Number(event.target.value) } }))} />
                  <small>{Math.round(displayConfig.settings.voiceVolume * 100)}% Volume</small>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                  <label className="settings-toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="checkbox" checked={displayConfig.settings.showClock} onChange={(event) => updateDisplayConfig((current) => ({ ...current, settings: { ...current.settings, showClock: event.target.checked } }))} />
                    <span>Show digital clock</span>
                  </label>
                  <label className="settings-toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="checkbox" checked={displayConfig.settings.showDate} onChange={(event) => updateDisplayConfig((current) => ({ ...current, settings: { ...current.settings, showDate: event.target.checked } }))} />
                    <span>Show date banner</span>
                  </label>
                </div>
              </div>
            </section>

            <section className="settings-card settings-card-preview">
              <div className="section-header compact">
                <h3>TV Preview</h3>
                <span className="section-badge">Draft Preview</span>
              </div>
              <div className="display-preview-frame" ref={previewScaleRef} draggable={false}
                onDragStartCapture={event => event.preventDefault()}
                onPointerDown={event => event.preventDefault()}>
                <div className="display-preview-size" style={{ width: 1920 * previewScale, height: 1080 * previewScale }}>
                <div className="display-preview-stage" style={{ transform: `scale(${previewScale})` }}>
                  <TVPreviewViewport
                    config={displayConfig}
                    currentTime={previewNow}
                    cashierTickets={previewCashierTickets}
                    registrarTickets={previewRegistrarTickets}
                    itmTickets={previewItmTickets}
                    admissionTickets={previewAdmissionTickets}
                    servingTickets={previewServingTickets}
                  />
                </div>
              </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {activePage === 'activity' && (
        <div className="admin-standard-page admin-activity-page">
          {/* ── 1. Activity Logs Section ── */}
          <section className="admin-activity-section">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2>Activity Logs</h2>
                <p className="section-subtitle">Review staff activity, queue actions, and system history.</p>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
                  {(activityStartDate || activityDate) && (
                    <span className="section-badge">{activityStartDate ? `${formatDisplayDate(activityStartDate)} – ${formatDisplayDate(activityEndDate)}` : formatDisplayDate(activityDate)}</span>
                  )}
                  <CalendarDateRange
                    label="Activity logs custom date range"
                    triggerLabel="Custom Date"
                    dashboardStyle
                    start={activityStartDate || todayIso}
                    end={activityEndDate || activityStartDate || todayIso}
                    onApply={(from, to) => { setActivityDate(''); setActivityStartDate(from); setActivityEndDate(to); setLiveLogs([]); setActivityLoading(true) }}
                  />
                </div>
              </div>
              <input
                type="text"
                placeholder="Search staff, department, or action..."
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  minWidth: '260px'
                }}
              />
            </div>

            <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Staff Name</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Department</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Assigned Window</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Action</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {liveLogs
                    .filter((log) => {
                      if (!activitySearch.trim()) return true
                      const q = activitySearch.toLowerCase()
                      return (
                        (log.staff_name && log.staff_name.toLowerCase().includes(q)) ||
                        (log.department && log.department.toLowerCase().includes(q)) ||
                        (log.assigned_window && log.assigned_window.toLowerCase().includes(q)) ||
                        (log.action && log.action.toLowerCase().includes(q))
                      )
                    })
                    .length > 0 ? (
                      liveLogs
                        .filter((log) => {
                          if (!activitySearch.trim()) return true
                          const q = activitySearch.toLowerCase()
                          return (
                            (log.staff_name && log.staff_name.toLowerCase().includes(q)) ||
                            (log.department && log.department.toLowerCase().includes(q)) ||
                            (log.assigned_window && log.assigned_window.toLowerCase().includes(q)) ||
                            (log.action && log.action.toLowerCase().includes(q))
                          )
                        })
                        .map((log, idx) => (
                          <tr key={log.log_id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>{displayValue(log.staff_name)}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span className={`badge badge-${log.department ? log.department.toLowerCase() : 'staff'}`}>
                                {log.department}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#475569' }}>{displayValue(log.assigned_window)}</td>
                            <td style={{ padding: '12px 16px', color: '#334155' }}>{log.action}</td>
                            <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.85rem' }}>{log.created_at}</td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                          {activityLoading ? 'Loading activity logs...' : activityError || (activityStartDate ? 'No activity records found for the selected date range.' : 'No activity logs found.')}
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── 2. Queue History Section (Placed Directly Below Activity Logs) ── */}
          <section className="admin-activity-section">
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2>Queue History</h2>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
                  {(historyStartDate || historyDate) && (
                    <span className="section-badge">{historyStartDate ? `${formatDisplayDate(historyStartDate)} – ${formatDisplayDate(historyEndDate)}` : formatDisplayDate(historyDate)}</span>
                  )}
                  <CalendarDateRange
                    label="Queue history custom date range"
                    triggerLabel="Custom Date"
                    dashboardStyle
                    start={historyStartDate || todayIso}
                    end={historyEndDate || historyStartDate || todayIso}
                    onApply={(from, to) => { setHistoryDate(''); setHistoryStartDate(from); setHistoryEndDate(to); setActivityHistory([]); setActivityLoading(true) }}
                  />
                </div>
              </div>
              <input
                type="text"
                placeholder="Search ticket, student, or status..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.9rem',
                  minWidth: '260px'
                }}
              />
            </div>

            <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Student Number</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Ticket Number</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Department</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Service Type</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Created At</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Called At</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Completed At</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Window</th>
                  </tr>
                </thead>
                <tbody>
                  {activityHistory
                    .filter((item) => {
                      if (!historySearch.trim()) return true
                      const q = historySearch.toLowerCase()
                      return (
                        (item.student_number && item.student_number.toLowerCase().includes(q)) ||
                        (item.ticket_number && item.ticket_number.toLowerCase().includes(q)) ||
                        (item.department && item.department.toLowerCase().includes(q)) ||
                        (item.service_type && item.service_type.toLowerCase().includes(q)) ||
                        (item.status && item.status.toLowerCase().includes(q)) ||
                        (item.window && item.window.toLowerCase().includes(q))
                      )
                    })
                    .length > 0 ? (
                      activityHistory
                        .filter((item) => {
                          if (!historySearch.trim()) return true
                          const q = historySearch.toLowerCase()
                          return (
                            (item.student_number && item.student_number.toLowerCase().includes(q)) ||
                            (item.ticket_number && item.ticket_number.toLowerCase().includes(q)) ||
                            (item.department && item.department.toLowerCase().includes(q)) ||
                            (item.service_type && item.service_type.toLowerCase().includes(q)) ||
                            (item.status && item.status.toLowerCase().includes(q)) ||
                            (item.window && item.window.toLowerCase().includes(q))
                          )
                        })
                        .map((item, idx) => (
                          <tr key={item.ticket_id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>{displayValue(item.student_number)}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7' }}>{displayValue(item.ticket_number)}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span className={`badge badge-${item.department ? item.department.toLowerCase() : 'cashier'}`}>
                                {displayValue(item.department)}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                background: item.service_type === 'Priority' ? '#fef3c7' : '#e0f2fe',
                                color: item.service_type === 'Priority' ? '#b45309' : '#0369a1',
                              }}>
                                {displayValue(item.service_type)}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                background: item.status === 'Completed' || item.status === 'Done' ? '#dcfce7' : (item.status === 'Serving' || item.status === 'Called' ? '#dbeafe' : '#f3f4f6'),
                                color: item.status === 'Completed' || item.status === 'Done' ? '#15803d' : (item.status === 'Serving' || item.status === 'Called' ? '#1d4ed8' : '#4b5563'),
                              }}>
                                {displayValue(item.status)}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.85rem' }}>{displayValue(item.created_at)}</td>
                            <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.85rem' }}>{displayValue(item.called_at)}</td>
                            <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.85rem' }}>{displayValue(item.completed_at)}</td>
                            <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 500 }}>{displayValue(item.window)}</td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                          {activityLoading ? 'Loading queue history...' : activityError || (historyStartDate ? 'No queue records found for the selected date range.' : 'No queue history records found.')}
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
      </div>
    </div>
  );
}
export default AdminPanel
