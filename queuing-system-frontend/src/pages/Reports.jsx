import { displayValue, isMissingValue } from '../utils/adminDisplay'
import CalendarDateRange from '../components/CalendarDateRange'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAdminPolling } from '../hooks/useAdminPolling'
import { createReportPdf } from '../utils/reportPdf'
import { getReportData } from '../api'
import { isDeptAdminUser, getDepartmentDisplayName } from '../utils/departments'

const reportPeriods = [
  { id: 'today', label: 'Today' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'semester', label: 'Semester' },
  { id: 'custom', label: 'Custom Date' },
]

const departmentOptions = [
  { value: 'all', label: 'All Departments' },
  { value: 'Cashier', label: 'Cashier' },
  { value: 'Registrar', label: 'Registrar' },
  { value: 'ITM', label: 'ITM' },
  { value: 'Admission', label: 'Admission' },
]

const toNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(String(value ?? '').replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

const formatMinutes = (value, fallback = '0') => {
  if (isMissingValue(value)) {
    return fallback
  }

  if (typeof value === 'number') {
    return `${Number.isFinite(value) ? Number(value).toFixed(2) : 0} min`
  }

  if (typeof value === 'string') {
    const matches = value.match(/-?\d*\.?\d+/)
    if (matches) {
      const numeric = Number(matches[0])
      return `${Number.isFinite(numeric) ? numeric.toFixed(2) : 0} min`
    }
    return fallback
  }

  return fallback
}

const formatPercent = (value, fallback = '0%') => {
  if (isMissingValue(value)) {
    return fallback
  }

  const numeric = Number.parseFloat(String(value).replace(/[^0-9.\-]/g, ''))
  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return `${numeric.toFixed(2)}%`
}

const formatValue = (value, type = 'number') => {
  if (isMissingValue(value)) {
    return type === 'percent' ? '0%' : 0
  }

  if (type === 'percent') {
    return formatPercent(value)
  }

  if (type === 'minutes') {
    return formatMinutes(value)
  }

  if (typeof value === 'number') {
    return value
  }

  return value
}

const getDepartmentLabel = (value) => {
  if (!value) return 'All Departments'
  return value === 'cashier' ? 'Cashier' : value === 'registrar' ? 'Registrar' : value
}

const sectionCardStyle = {
  background: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: '16px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  padding: '20px 20px 18px',
}

function Reports({ user }) {
  const isDeptAdmin = isDeptAdminUser(user)
  const lockedDept = isDeptAdmin ? (user?.department || 'Cashier') : 'all'
  const [reportPeriod, setReportPeriod] = useState('today')
  const [department, setDepartment] = useState(() => lockedDept)

  useEffect(() => {
    if (isDeptAdmin) {
      setDepartment(lockedDept)
    }
  }, [isDeptAdmin, lockedDept])
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const latestReportRequestRef = useRef(0)
  const activeReportControllerRef = useRef(null)

  const activeSummary = useMemo(() => reportData?.report_summary || reportData?.queue_summary || {}, [reportData])
  const activeKpi = useMemo(() => reportData?.kpi_summary || {}, [reportData])
  const activeDepartmentSummary = useMemo(() => reportData?.department_summary || {}, [reportData])
  const staffSummary = useMemo(() => reportData?.staff_summary || [], [reportData])

  const selectedRangeLabel = useMemo(() => {
    if (reportData?.date_range?.formatted) {
      return reportData.date_range.formatted
    }

    const start = reportPeriod === 'custom' ? startDate : null
    const end = reportPeriod === 'custom' ? endDate : null

    if (start && end) {
      return `${new Date(start + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} – ${new Date(end + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`
    }

    return 'Live Database Data'
  }, [reportData, reportPeriod, startDate, endDate])

  const validRange = reportPeriod !== 'custom' || Boolean(startDate && endDate && startDate <= endDate)
  const loadReport = async ({ silent = false, signal = null, background = false } = {}) => {
    if (!validRange || signal?.aborted) return null
    if (background && (activeReportControllerRef.current || isGeneratingPdf)) return null
    activeReportControllerRef.current?.abort()
    const requestController = new AbortController()
    activeReportControllerRef.current = requestController
    const abortCurrentRequest = () => requestController.abort()
    if (signal) signal.addEventListener('abort', abortCurrentRequest, { once: true })

    const requestId = ++latestReportRequestRef.current
    if (!silent && !reportData) setLoading(true)
    if (!silent) setRefreshing(true)
    setError(null)

    try {
      const requestedStartDate = reportPeriod === 'custom' ? startDate : null
      const requestedEndDate = reportPeriod === 'custom' ? endDate : null
      const data = await getReportData(reportPeriod, requestedStartDate, requestedEndDate, department, requestController.signal)
      if (requestId !== latestReportRequestRef.current || requestController.signal.aborted) return null
      setReportData(data)
      return data
    } catch (err) {
      if (requestId !== latestReportRequestRef.current || err?.name === 'AbortError') return null
      console.error('Error fetching report data:', err)
      setError(err?.message || 'Unable to load report data. Please try again.')
      return null
    } finally {
      if (signal) signal.removeEventListener('abort', abortCurrentRequest)
      if (activeReportControllerRef.current === requestController) activeReportControllerRef.current = null
      if (requestId === latestReportRequestRef.current) { setLoading(false); setRefreshing(false) }
    }
  }

  useAdminPolling((signal, manual) => loadReport({ signal, silent: !manual, background: !manual }),
    `${reportPeriod}:${department}:${startDate}:${endDate}`, validRange)
  useEffect(() => () => {
    activeReportControllerRef.current?.abort()
    latestReportRequestRef.current += 1
  }, [reportPeriod, department, startDate, endDate])

  const handlePeriodChange = (periodId) => {
    setReportPeriod(periodId)
  }

  const handleGeneratePdf = async () => {
    if (isGeneratingPdf || !validRange) return
    setIsGeneratingPdf(true)
    try {
      const fresh = await loadReport({ silent: true })
      if (fresh) createReportPdf(fresh).save(`queue-report-${fresh.department}-${fresh.period}.pdf`)
    } catch (err) {
      setError(err.message || 'PDF generation failed. Please try again.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const summaryMetrics = [
    { label: 'Tickets Issued', value: activeSummary.tickets_issued ?? 0, description: 'Total tickets created', type: 'number' },
    { label: 'Students Served', value: activeSummary.students_served ?? 0, description: 'Successfully served', type: 'number' },
    { label: 'Waiting Tickets', value: activeSummary.waiting_tickets ?? 0, description: 'Currently waiting', type: 'number' },
    { label: 'Completed', value: activeSummary.completed ?? 0, description: 'Successfully completed', type: 'number' },
    { label: 'Cancelled / Skipped', value: activeSummary.cancelled_skipped ?? 0, description: 'Cancelled or skipped', type: 'number' },
    { label: 'Average Waiting Time', value: activeSummary.average_waiting_time, description: 'Average waiting time', type: 'minutes' },
    { label: 'Average Service Time', value: activeSummary.average_service_time, description: 'Average service time', type: 'minutes' },
    { label: 'Average Turnaround Time', value: activeSummary.average_turnaround_time, description: 'End-to-end time', type: 'minutes' },
    { label: 'Completion Rate', value: activeSummary.completion_rate ?? '0%', description: 'Completed / tickets issued', type: 'percent' },
  ]

  const kpiDescription = (value, availableText) => value ? availableText : 'No data available'
  const kpiCards = [
    { label: 'Busiest Peak Hour', value: activeKpi.busiest_peak_hour || 'None', description: kpiDescription(activeKpi.busiest_peak_hour, 'Highest queue volume') },
    { label: 'Busiest Day', value: activeKpi.busiest_day || 'None', description: kpiDescription(activeKpi.busiest_day, 'Highest daily volume') },
    { label: 'Top Performing Staff', value: activeKpi.top_performing_staff || 'None', description: kpiDescription(activeKpi.top_performing_staff, 'Most completed tickets') },
    { label: 'Best Performing Window', value: activeKpi.best_performing_window || 'None', description: kpiDescription(activeKpi.best_performing_window, 'Strongest completion rate') },
    { label: 'Average Waiting Time', value: formatMinutes(activeKpi.average_waiting_time), description: 'Overall average' },
    { label: 'Average Service Time', value: formatMinutes(activeKpi.average_service_time), description: 'Overall average' },
  ]

  const departmentCards = isDeptAdmin
    ? [activeDepartmentSummary[lockedDept] || activeDepartmentSummary[getDepartmentLabel(lockedDept)]].filter(Boolean)
    : (department === 'all'
        ? Object.values(activeDepartmentSummary).filter(Boolean)
        : [activeDepartmentSummary[department] || activeDepartmentSummary[getDepartmentLabel(department)]].filter(Boolean))

  const hasDepartmentSummary = departmentCards.length > 0
  const hasAssignedWindow = staffSummary.some((staff) => staff.window != null || staff.assigned_window != null || staff.window_number != null)
  const completionPercent = (value) => Math.max(0, Math.min(100, Number.parseFloat(value) || 0))

  return (
    <div style={{ width: '100%' }}>
      <style>{`
        .reports-page {
          width: 100%;
          color: #0f172a;
          background: transparent;
          padding: 0;
          font-family: 'Poppins', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .reports-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }
        .reports-header h1 {
          margin: 0;
          font-size: 2rem;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.5px;
          color: #0f172a;
        }
        .reports-header p {
          margin: 6px 0 0;
          color: #475569;
          font-size: 0.96rem;
        }
        .reports-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 20px;
          padding: 12px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
        }
        .period-switcher {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .period-button {
          border: 1px solid #D1D5DB;
          background: #fff;
          color: #0f172a;
          border-radius: 10px;
          padding: 9px 15px;
          min-height: 42px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 100px;
        }
        .period-button.active {
          background: #0F172A;
          border-color: #0F172A;
          color: #fff;
        }
        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .department-select {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          padding: 0 12px;
          height: 42px;
        }
        .department-select label {
          font-size: 0.75rem;
          color: #475569;
          font-weight: 600;
        }
        .department-select select {
          border: none;
          background: transparent;
          padding: 10px 0;
          color: #0f172a;
          font-weight: 600;
          outline: none;
        }
        .date-range-card {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          padding: 0 14px;
          height: 42px;
          min-width: 220px;
          color: #0f172a;
        }
        .date-range-card span {
          font-size: 0.72rem;
          color: #475569;
          font-weight: 600;
          white-space: nowrap;
        }
        .date-range-card strong {
          font-size: 0.9rem;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pdf-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: none;
          background: #0F172A;
          color: #fff;
          border-radius: 10px;
          padding: 10px 18px;
          font-weight: 700;
          cursor: pointer;
          min-height: 44px;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.16);
        }
        .pdf-button:disabled {
          cursor: wait;
          opacity: 0.75;
        }
        .custom-date-row {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }
        .custom-date-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 160px;
        }
        .custom-date-field label {
          font-size: 0.75rem;
          color: #475569;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .custom-date-field input {
          border: 1px solid #D1D5DB;
          border-radius: 8px;
          padding: 9px 12px;
          color: #0f172a;
          background: #fff;
          min-height: 38px;
        }
        .report-section {
          margin-top: 0;
          margin-bottom: 28px;
        }
        .section-heading {
          margin: 0 0 12px;
          font-size: 1.1rem;
          font-weight: 800;
          color: #0f172a;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(140px, 1fr));
          gap: 14px;
        }
        .metric-card {
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 14px;
          padding: 16px;
          min-height: 136px;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.045);
          transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
        }
        .metric-card:hover, .kpi-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 10px 26px rgba(15, 23, 42, 0.07);
          transform: translateY(-1px);
        }
        .metric-card__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: #EEF2FF;
          color: #1F3C88;
          margin-bottom: 10px;
        }
        .metric-card__label {
          font-size: 0.78rem;
          color: #475569;
          font-weight: 600;
          margin: 0 0 8px;
          letter-spacing: .45px;
          text-transform: uppercase;
        }
        .metric-card__value {
          font-size: clamp(1.6rem, 2vw, 2rem);
          margin: 0 0 8px;
          color: #0f172a;
          font-weight: 700;
          line-height: 1.2;
        }
        .metric-card__description {
          font-size: 0.76rem;
          color: #64748b;
          margin: 0;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(130px, 1fr));
          gap: 12px;
        }
        .kpi-card {
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 14px;
          padding: 16px;
          min-height: 128px;
          text-align: left;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
          transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
        }
        .kpi-card__icon {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          margin-bottom: 10px;
          border-radius: 9px;
          color: #1e3a8a;
          background: #e8eef9;
          font-size: .9rem;
          font-weight: 800;
        }
        .kpi-card__label {
          font-size: 0.76rem;
          color: #475569;
          font-weight: 700;
          margin-bottom: 12px;
        }
        .kpi-card__value {
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
          display: block;
          margin-bottom: 6px;
        }
        .kpi-card__description {
          font-size: 0.75rem;
          color: #64748b;
        }
        .department-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(260px, 1fr));
          gap: 16px;
        }
        .department-card {
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 14px;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.045);
        }
        .department-card--cashier {
          border-top: 2px solid #93c5fd;
        }
        .department-card--registrar {
          border-top: 2px solid #86b9a8;
        }
        .department-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid #E5E7EB;
          background: #F8FAFC;
          color: #0f172a;
          font-weight: 700;
        }
        .department-badge, .staff-department-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border: 1px solid #dbe3ee;
          border-radius: 999px;
          background: #fff;
          color: #334155;
          font-size: .68rem;
          font-weight: 800;
          letter-spacing: .35px;
          text-transform: uppercase;
        }
        .department-card__body {
          display: grid;
          grid-template-columns: repeat(3, minmax(110px, 1fr));
          gap: 10px;
          padding: 14px;
        }
        .mini-stat {
          background: #F8FAFC;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          padding: 10px 8px;
          text-align: center;
        }
        .mini-stat__label {
          display: block;
          color: #64748b;
          font-size: 0.7rem;
          margin-bottom: 8px;
        }
        .mini-stat__value {
          font-size: 1.15rem;
          font-weight: 700;
          color: #0f172a;
        }
        .staff-table-wrap {
          overflow-x: auto;
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 14px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.045);
        }
        table.staff-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
        }
        .staff-table th {
          background: #F8FAFC;
          color: #475569;
          font-size: 0.76rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 12px 14px;
          text-align: left;
          border-bottom: 1px solid #E5E7EB;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .staff-table td {
          padding: 12px 14px;
          border-bottom: 1px solid #E5E7EB;
          font-size: 0.95rem;
          color: #0f172a;
        }
        .staff-table tbody tr { transition: background-color .14s ease; }
        .staff-table tbody tr:hover { background: #f8fafc; }
        .completion-cell { min-width: 130px; }
        .completion-track {
          width: 86px;
          height: 5px;
          margin-top: 6px;
          overflow: hidden;
          border-radius: 999px;
          background: #e2e8f0;
        }
        .completion-fill {
          height: 100%;
          border-radius: inherit;
          background: #315b96;
        }
        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 120px;
          border: 1px dashed #CBD5E1;
          background: #F8FAFC;
          border-radius: 12px;
          color: #475569;
          font-size: 0.98rem;
          text-align: center;
          padding: 14px;
        }
        .footer-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 24px;
          border-top: 1px solid #E5E7EB;
          padding: 16px 2px 4px;
        }
        .footer-bar p {
          margin: 0;
          color: #475569;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .footer-bar p::before {
          content: 'i';
          width: 18px;
          height: 18px;
          display: inline-grid;
          place-items: center;
          flex: 0 0 18px;
          border: 1px solid #cbd5e1;
          border-radius: 50%;
          color: #475569;
          font-size: .7rem;
          font-weight: 800;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          color: #DC2626;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid #FECACA;
          background: #FEF2F2;
        }
        .skeleton-card {
          background: linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%);
          background-size: 200% 100%;
          animation: shimmer 1.3s linear infinite;
          border-radius: 12px;
          height: 140px;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (max-width: 1100px) {
          .summary-grid { grid-template-columns: repeat(3, minmax(140px, 1fr)); }
          .kpi-grid { grid-template-columns: repeat(3, minmax(140px, 1fr)); }
          .department-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .reports-toolbar { align-items: flex-start; }
          .toolbar-right { width: 100%; }
          .summary-grid { grid-template-columns: repeat(2, minmax(140px, 1fr)); }
          .kpi-grid { grid-template-columns: repeat(2, minmax(140px, 1fr)); }
          .department-card__body { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
          .custom-date-row { flex-direction: column; align-items: stretch; }
          .date-range-card { min-width: 0; flex: 1; }
        }
        @media (max-width: 500px) {
          .summary-grid, .kpi-grid, .department-card__body { grid-template-columns: 1fr; }
          .reports-header { flex-direction: column; }
          .pdf-button { width: 100%; justify-content: center; }
          .toolbar-right { flex-direction: column; align-items: stretch; }
          .department-select, .date-range-card { width: 100%; }
        }
      `}</style>

      <div className="reports-page">
        <header className="reports-header">
          <div>
            <h1>Reports</h1>
            <p>Review queue records, performance summaries, and generate official PDF reports.</p>
          </div>
        </header>

        <div className="reports-toolbar">
          <div className="period-switcher" aria-label="Report period selector">
            {reportPeriods.map((period) => (
              <button
                key={period.id}
                type="button"
                className={`period-button ${reportPeriod === period.id ? 'active' : ''}`}
                onClick={() => handlePeriodChange(period.id)}
              >
                {period.label}
              </button>
            ))}
          </div>

          <div className="toolbar-right">
            <div className="department-select">
              <label htmlFor="departmentFilter">Department</label>
              <select
                id="departmentFilter"
                value={department}
                onChange={(event) => !isDeptAdmin && setDepartment(event.target.value)}
                disabled={isDeptAdmin}
              >
                {isDeptAdmin ? (
                  <option value={lockedDept}>{getDepartmentDisplayName(lockedDept)}</option>
                ) : (
                  departmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="date-range-card" aria-live="polite">
              <span>Date Range</span>
              <strong>{selectedRangeLabel}</strong>
            </div>

            <button
              type="button"
              className="pdf-button"
              onClick={handleGeneratePdf}
              disabled={!validRange || isGeneratingPdf}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 3.5h7l5 5V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2zm7 1.5v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 13h8M8 17h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              {isGeneratingPdf ? 'Generating PDF...' : 'Generate PDF Report'}
            </button>
          </div>
        </div>

        {reportPeriod === 'custom' && (
          <div className="custom-date-row">
            <CalendarDateRange
              label="Reports custom date range"
              start={startDate}
              end={endDate}
              onApply={(from, to) => { setStartDate(from); setEndDate(to) }}
            />
          </div>
        )}

        {refreshing && <p role="status">Updating selected filters...</p>}
        {!validRange && <p role="alert">Select a valid date range.</p>}
      {error && (
          <div style={{ marginBottom: '12px' }}>
            <div className="status-badge" role="alert">
              {error} <button type="button" onClick={loadReport} style={{ border: 'none', background: 'transparent', color: '#DC2626', fontWeight: 700, cursor: 'pointer', marginLeft: '8px' }}>Retry</button>
            </div>
          </div>
        )}

        {loading && !reportData ? (
          <div className="report-section">
            <div className="summary-grid">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="skeleton-card" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <section className="report-section">
              <h2 className="section-heading">Report Summary</h2>
              <div className="summary-grid">
                {summaryMetrics.map((metric, index) => (
                  <article key={metric.label} className={`metric-card metric-card--${index + 1}`}>
                    <div className="metric-card__icon" style={{
                      color: ['#315b96', '#287a61', '#a16207', '#287a61', '#b45309'][index] || '#315b96',
                      background: [`#e8eef9`, `#e7f4ef`, `#fff4d8`, `#e7f4ef`, `#fff0e6`][index] || '#eef2f7'
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 19V8.5M12 19V5M19 19v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <p className="metric-card__label">{metric.label}</p>
                    <p className="metric-card__value">{formatValue(metric.value, metric.type)}</p>
                    <p className="metric-card__description">{metric.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="report-section">
              <h2 className="section-heading">KPI Summary</h2>
              <div className="kpi-grid">
                {kpiCards.map((card) => (
                  <div key={card.label} className="kpi-card">
                    <div className="kpi-card__icon" aria-hidden="true">{card.label.charAt(0)}</div>
                    <div className="kpi-card__label">{card.label}</div>
                    <span className="kpi-card__value">{card.value}</span>
                    <div className="kpi-card__description">{card.description}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="report-section">
              <h2 className="section-heading">Department Summary</h2>
              {hasDepartmentSummary ? (
                <div className="department-grid">
                  {departmentCards.map((card) => {
                    const cardKey = card.department || 'Department'
                    const departmentClass = cardKey === 'Cashier' ? 'department-card--cashier' : 'department-card--registrar'
                    return (
                      <article key={cardKey} className={`department-card ${departmentClass}`}>
                        <div className="department-card__header">
                          <span>{cardKey} Department</span>
                          <span className="department-badge">{cardKey}</span>
                        </div>
                        <div className="department-card__body">
                          <div className="mini-stat"><span className="mini-stat__label">Tickets Issued</span><span className="mini-stat__value">{card.tickets_issued ?? 0}</span></div>
                          <div className="mini-stat"><span className="mini-stat__label">Students Served</span><span className="mini-stat__value">{card.students_served ?? 0}</span></div>
                          <div className="mini-stat"><span className="mini-stat__label">Waiting Tickets</span><span className="mini-stat__value">{card.waiting_tickets ?? 0}</span></div>
                          <div className="mini-stat"><span className="mini-stat__label">Completed</span><span className="mini-stat__value">{card.completed ?? 0}</span></div>
                          <div className="mini-stat"><span className="mini-stat__label">Cancelled / Skipped</span><span className="mini-stat__value">{card.cancelled_skipped ?? 0}</span></div>
                          <div className="mini-stat"><span className="mini-stat__label">Avg Waiting Time</span><span className="mini-stat__value">{formatMinutes(card.average_waiting_time)}</span></div>
                          <div className="mini-stat"><span className="mini-stat__label">Avg Service Time</span><span className="mini-stat__value">{formatMinutes(card.average_service_time)}</span></div>
                          <div className="mini-stat"><span className="mini-stat__label">Completion Rate</span><span className="mini-stat__value">{formatPercent(card.completion_rate)}</span></div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state">No department data available for this period.</div>
              )}
            </section>

            <section className="report-section">
              <h2 className="section-heading">Staff Performance Summary</h2>
              {staffSummary.length > 0 ? (
                <div className="staff-table-wrap">
                  <table className="staff-table">
                    <thead>
                      <tr>
                        <th>Staff Name</th>
                        <th>Department</th>
                        {hasAssignedWindow && <th>Served Window</th>}
                        <th>Tickets Served</th>
                        <th>Average Waiting Time</th>
                        <th>Average Service Time</th>
                        <th>Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffSummary.map((staff) => (
                        <tr key={`${staff.staff_name}-${staff.department}-${staff.window}`}>
                          <td>{displayValue(staff.staff_name)}</td>
                          <td><span className="staff-department-badge">{displayValue(staff.department)}</span></td>
                          {hasAssignedWindow && <td>{staff.window ?? staff.assigned_window ?? staff.window_number ?? '—'}</td>}
                          <td>{staff.tickets_served ?? 0}</td>
                          <td>{formatMinutes(staff.average_waiting_time)}</td>
                          <td>{formatMinutes(staff.average_service_time)}</td>
                          <td className="completion-cell">
                            <span>{formatPercent(staff.completion_rate)}</span>
                            <div className="completion-track" aria-hidden="true">
                              <div className="completion-fill" style={{ width: `${completionPercent(staff.completion_rate)}%` }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">No staff performance data available for this period.</div>
              )}
            </section>

            <div className="footer-bar">
              <p>The data above reflects queue activity and performance for the selected date range and department.</p>
              <button
                type="button"
                className="pdf-button"
                onClick={handleGeneratePdf}
                disabled={!validRange || isGeneratingPdf}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 3.5h7l5 5V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2zm7 1.5v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 13h8M8 17h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                {isGeneratingPdf ? 'Generating PDF...' : 'Generate / Download PDF Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Reports
