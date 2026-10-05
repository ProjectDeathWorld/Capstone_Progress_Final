import { DEPARTMENTS, departmentFor, enabledDepartments } from '../utils/departments'
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { generateTicket, verifySecurityCode, getWindowAvailability, getDisplayConfiguration, getStudent } from '../api'
import { getTicketNumber } from '../utils/queueNumber'
import { printThermalTicket } from '../utils/thermalPrinter'

const IDLE_TIMEOUT = 30000 // 30 seconds of inactivity returns to welcome screen
const REGISTRAR_WINDOW_COURSES = {
  9: ['BSCRIM', 'BSPSYCH'],
  10: ['BSIT', 'BSCS', 'BSIE', 'BSCPE'],
  11: ['BSHM', 'BSTM'],
  12: ['BSA', 'EDUC / PTCP'],
  13: ['BSBA'],
}

function KioskHeader() {
  return (
    <header className="kiosk-app-header" aria-label="Lyceum of Alabang Queue Management System">
      <div className="kiosk-brand-group">
        <div className="kiosk-brand-logo">
          <img src="/loa-logo.png" alt="Lyceum of Alabang logo" />
        </div>
        <div className="kiosk-brand-copy">
          <span className="kiosk-brand-name">LYCEUM OF ALABANG</span>
          <span className="kiosk-brand-tag">QUEUE MANAGEMENT SYSTEM</span>
        </div>
      </div>
    </header>
  )
}

function KioskLayout({ children, contentClassName = '' }) {
  return (
    <div className="kiosk-layout">
      <KioskHeader />
      <main className={`kiosk-layout-main ${contentClassName}`.trim()}>
        <div className="kiosk-layout-content">{children}</div>
      </main>
    </div>
  )
}

function Kiosk() {
  const [step, setStep] = useState('welcome') // welcome | student-id | select-service | registrar-student | select-priority | select-transaction | select-window (Guest only) | security-code | ticket-result
  const [serviceType, setServiceType] = useState(null)
  const [priorityType, setPriorityType] = useState(null)
  const [selectedWindow, setSelectedWindow] = useState(null)
  const [transactionType, setTransactionType] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [studentRecord, setStudentRecord] = useState(null)
  const [studentLookupLoading, setStudentLookupLoading] = useState(false)
  const [showStudentKeypad, setShowStudentKeypad] = useState(false)
  const [showSecurityKeypad, setShowSecurityKeypad] = useState(false)
  const [ticket, setTicket] = useState(null)
  const [ticketTime, setTicketTime] = useState(null)
  const [printStatus, setPrintStatus] = useState(null) // null | 'printing' | 'printed' | 'failed'
  const [printError, setPrintError] = useState('')
  const [securityCode, setSecurityCode] = useState('')
  const [securityName, setSecurityName] = useState('')
  const [error, setError] = useState('')

  const handlePrintTicket = async (ticketToPrint = ticket) => {
    if (!ticketToPrint) return
    setPrintStatus('printing')
    setPrintError('')

    try {
      const printResult = await printThermalTicket(ticketToPrint, {
        fallbackService: serviceType,
        date: ticketTime || new Date(),
      })

      if (printResult.success) {
        setPrintStatus('printed')
      } else {
        setPrintStatus('failed')
        setPrintError(printResult.error || 'Printer unavailable or disconnected')
      }
    } catch (err) {
      setPrintStatus('failed')
      setPrintError(err?.message || 'Printer unavailable or disconnected')
    }
  }
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [windowAvailabilities, setWindowAvailabilities] = useState([])
  const [activeDepartments, setActiveDepartments] = useState([])
  const idleTimer = useRef(null)
  const pendingTransactionRef = useRef(null)
  const securityRequestRef = useRef(null)
  const studentLookupRef = useRef(null)
  const ticketRequestRef = useRef(null)
  const studentNumberBeforeKeypadRef = useRef('')
  const securityCodeBeforeKeypadRef = useRef('')

  const abortKioskRequests = () => {
    securityRequestRef.current?.abort()
    studentLookupRef.current?.abort()
    ticketRequestRef.current?.abort()
    securityRequestRef.current = null
    studentLookupRef.current = null
    ticketRequestRef.current = null
  }

  const checkDepartments = async () => {
    try {
      const remoteConfig = await getDisplayConfiguration()
      setActiveDepartments(enabledDepartments(remoteConfig?.settings))
    } catch (err) {
      console.error('Unable to refresh department settings', err)
    }
  }

  useEffect(() => {
    checkDepartments()
    window.addEventListener('display-board-config-updated', checkDepartments)
    const departmentInterval = setInterval(checkDepartments, 5000)
    return () => {
      window.removeEventListener('display-board-config-updated', checkDepartments)
      clearInterval(departmentInterval)
    }
  }, [])

  useEffect(() => {
    if (!['select-service', 'select-window'].includes(step)) return undefined

    const controller = new AbortController()
    const fetchAvailabilities = async () => {
      try {
        const data = await getWindowAvailability(controller.signal)
        if (!controller.signal.aborted && Array.isArray(data)) {
          setWindowAvailabilities(data)
        }
      } catch (err) {
        if (err?.name !== 'AbortError') console.error('Failed to fetch window availabilities', err)
      }
    }

    fetchAvailabilities()
    const interval = setInterval(fetchAvailabilities, 2000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [step])

  useEffect(() => () => abortKioskRequests(), [])

  const normalizeDepartment = (department) => String(department || '').trim().toLowerCase()

  const isWindowAvailable = (department, windowNum) => {
    const normalizedDepartment = normalizeDepartment(department)
    const found = windowAvailabilities.find(w => normalizeDepartment(w.department) === normalizedDepartment && Number(w.window_number) === Number(windowNum))
    if (!found) return true
    const status = String(found.status || (found.is_available ? 'open' : 'closed')).toLowerCase()
    return status === 'open' && Boolean(found.is_available)
  }

  // Live clock
  useEffect(() => {
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(clockInterval)
  }, [])

  // Auto-return to welcome screen after inactivity
  useEffect(() => {
    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      if (step !== 'welcome') {
        idleTimer.current = setTimeout(() => {
          handleReset()
          setStep('welcome')
        }, IDLE_TIMEOUT)
      }
    }

    window.addEventListener('pointerdown', resetTimer)
    window.addEventListener('pointermove', resetTimer)
    resetTimer()

    return () => {
      window.removeEventListener('pointerdown', resetTimer)
      window.removeEventListener('pointermove', resetTimer)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [step])

  const formatTime = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const formatDate = (date) => date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const serviceOptions = DEPARTMENTS.filter(department => activeDepartments.includes(department.name))
    .map(department => ({ ...department, title: department.name }))
  const selectedDepartment = departmentFor(serviceType)

  useEffect(() => {
    if (serviceType && !activeDepartments.includes(departmentFor(serviceType)?.name) && step !== 'ticket-result') {
      abortKioskRequests()
      setLoading(false)
      setServiceType(null)
      setStep('select-service')
      setError('This department has been disabled. Please select another service.')
    }
  }, [activeDepartments, serviceType, step])

  const priorityOptions = [
    {
      value: 'R',
      title: 'Regular',
      icon: 'check_circle',
      color: 'green',
      subtitle: 'Regular queue',
      description: 'First come, first served service',
    },
    {
      value: 'P',
      title: 'Priority',
      icon: 'accessible',
      color: 'gold',
      subtitle: 'PWD / Senior / Pregnant',
      description: 'Priority lane with faster service',
    },
  ]

  const cashierTransactions = [
    { title: 'Payment', icon: 'payments' },
    { title: 'Clearance', icon: 'history_edu' },
    { title: 'Others', icon: 'more_horiz' },
  ]

  const registrarTransactions = [
    { title: 'Document Request', icon: 'description' },
    { title: 'Clearance', icon: 'history_edu' },
    { title: 'Others', icon: 'help_center' },
  ]

  // Retained only for the existing authorized Guest Registrar fallback.
  const windowOptions = [9, 10, 11, 12, 13]
  const isGuest = String(studentNumber).trim().toLowerCase() === 'guest'

  // ── handleReset returns to welcome screen ──
  const handleReset = () => {
    abortKioskRequests()
    setStep('welcome')
    setServiceType(null)
    setPriorityType(null)
    setSelectedWindow(null)
    setTicket(null)
    setTicketTime(null)
    setPrintStatus(null)
    setPrintError('')
    setSecurityCode('')
    setSecurityName('')
    setTransactionType('')
    setStudentNumber('')
    setStudentRecord(null)
    setStudentLookupLoading(false)
    setShowStudentKeypad(false)
    setShowSecurityKeypad(false)
    setError('')
    setLoading(false)
  }

  const handleTapToBegin = () => {
    abortKioskRequests()
    setServiceType(null)
    setPriorityType(null)
    setSelectedWindow(null)
    setTransactionType('')
    setStudentNumber('')
    setStudentRecord(null)
    setShowStudentKeypad(false)
    setShowSecurityKeypad(false)
    setSecurityCode('')
    setSecurityName('')
    setPrintStatus(null)
    setPrintError('')
    setError('')
    setLoading(false)
    setStep('student-id')
  }

  const handleBack = () => {
    abortKioskRequests()
    setLoading(false)
    switch (step) {
      case 'student-id':
        handleReset()
        break
      case 'select-service':
        setStep('student-id')
        break
      case 'select-priority':
        setStep('select-service')
        break
      case 'select-transaction':
        if (priorityType === 'P') setStep('security-code')
        else setStep('select-priority')
        break
      case 'select-window':
        setStep('select-transaction')
        break
      case 'registrar-student':
        setStep('student-id')
        break
      default:
        handleReset()
    }
  }

  const lookupRegistrarStudent = async () => {
    const normalizedNumber = studentNumber.trim()
    if (!/^\d{4}-23$/.test(normalizedNumber)) {
      setStudentRecord(null)
      setError('Student not found. Please check your Student Number.')
      setStep('registrar-student')
      return
    }
    studentLookupRef.current?.abort()
    const controller = new AbortController()
    studentLookupRef.current = controller
    setStudentLookupLoading(true)
    setStudentRecord(null)
    setError('')
    setStep('registrar-student')
    try {
      const record = await getStudent(normalizedNumber, controller.signal)
      if (!controller.signal.aborted) {
        setStudentRecord(record)
        // Show the detected identity/routing with queue-type options without
        // inserting a second confirmation step.
        setStep('select-priority')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') setError(err?.message || 'Student not found. Please check your Student Number.')
    } finally {
      if (studentLookupRef.current === controller) {
        studentLookupRef.current = null
        setStudentLookupLoading(false)
      }
    }
  }

  const handleServiceSelect = (type) => {
    setServiceType(type)
    setError('')
    if (type === 'RT' && !isGuest) {
      lookupRegistrarStudent()
      return
    }
    setStep('select-priority')
  }

  // ── FIX 2: Priority flow — go to security-code first, then transaction/window ──
  const advanceFromStudentNumber = () => {
    const normalizedNumber = studentNumber.trim()
    if (!/^\d{4}-23$/.test(normalizedNumber)) {
      setError('Enter a valid student number (####-23) or continue as guest.')
      return false
    }
    setStudentNumber(normalizedNumber)
    setError('')
    setShowStudentKeypad(false)
    setStep('select-service')
    return true
  }

  const handleStudentNumberSubmit = (e) => {
    e.preventDefault()
    advanceFromStudentNumber()
  }

  const handleGuestSelect = () => {
    setShowStudentKeypad(false)
    setStudentNumber('Guest')
    setStudentRecord(null)
    setError('')
    setStep('select-service')
  }

  const handleStudentKey = (key) => {
    setError('')
    setStudentRecord(null)
    if (key === 'backspace') {
      setStudentNumber(current => current.slice(0, -1))
      return
    }
    if (key === 'clear') {
      setStudentNumber('')
      return
    }
    setStudentNumber(current => current.length < 30 ? `${current}${key}` : current)
  }

  const openStudentKeypad = () => {
    studentNumberBeforeKeypadRef.current = studentNumber
    setShowStudentKeypad(true)
    setError('')
  }

  const closeStudentKeypad = (commit) => {
    if (!commit) {
      setStudentNumber(studentNumberBeforeKeypadRef.current)
      setShowStudentKeypad(false)
      return
    }
    advanceFromStudentNumber()
  }

  const handleSecurityKey = (key) => {
    setError('')
    if (key === 'backspace') {
      setSecurityCode(current => current.slice(0, -1))
      return
    }
    if (key === 'clear') {
      setSecurityCode('')
      return
    }
    setSecurityCode(current => current.length < 20 ? `${current}${key}` : current)
  }

  const openSecurityKeypad = () => {
    securityCodeBeforeKeypadRef.current = securityCode
    setShowSecurityKeypad(true)
    setError('')
  }

  const closeSecurityKeypad = (commit) => {
    if (!commit) {
      setSecurityCode(securityCodeBeforeKeypadRef.current)
      setShowSecurityKeypad(false)
      return
    }
    // Done submits through the same authenticated validation path as the
    // form. The keypad remains open until that validation succeeds.
    handleSecuritySubmit()
  }

  const handlePrioritySelect = (priority) => {
    setPriorityType(priority)
    setError('')

    if (priority === 'P') {
      // PRIORITY (any service) → Security Code first
      setStep('security-code')
      return
    }
 
    setStep('select-transaction')
  }

  // ── handleSecuritySubmit routes correctly after verification ──
  const handleSecuritySubmit = async (e) => {
    e?.preventDefault()
    if (securityRequestRef.current) return

    const normalizedCode = securityCode.trim()
    if (!/^[A-Za-z0-9-]{1,20}$/.test(normalizedCode)) {
      setError('Enter a valid security code (maximum 20 characters).')
      return
    }

    const controller = new AbortController()
    securityRequestRef.current = controller
    setSecurityCode(normalizedCode)
    setError('')
    setLoading(true)
    try {
      const verifyData = await verifySecurityCode(normalizedCode, controller.signal)
      if (controller.signal.aborted) return

      if (!verifyData.valid) {
        setError(verifyData.message || 'Invalid security code')
        return
      }

      setSecurityName(verifyData.security_user)
      setShowSecurityKeypad(false)
      setStep('select-transaction')
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError(err?.message || 'Error verifying code. Please try again.')
    } finally {
      if (securityRequestRef.current === controller) {
        securityRequestRef.current = null
        setLoading(false)
      }
    }
  }

  // Cashier → generate ticket immediately after transaction
  // Registrar → go to select-window after transaction
  const handleTransactionSelect = async (transaction) => {
    if (ticketRequestRef.current) return
    // Accept either an object or a string; normalize to string
    const tx = typeof transaction === 'string' ? transaction : (transaction?.title || '')

    setTransactionType(tx)
    setError('')

    if (serviceType === 'R' || serviceType === 'RT') {
      if (!isGuest && !studentRecord) {
        setError('Student not found. Please check your Student Number.')
        setStep('registrar-student')
        return
      }
      // Registrar: remember the selected transaction (use a ref so the
      // selection is reliably available for the authorized Guest fallback.
      pendingTransactionRef.current = tx
      if (isGuest) {
        setStep('select-window')
        return
      }
      generateRegistrarTicket(tx)
      return
    }

    // Cashier: generate ticket now
    const controller = new AbortController()
    ticketRequestRef.current = controller
    setLoading(true)
    try {
      const result = await generateTicket({
        service_type: serviceType,
        student_number: studentNumber || 'Guest',
        priority_type: priorityType,
        transaction_type: tx,
        security_code: priorityType === 'P' ? securityCode : null,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      setTicketTime(new Date())
      setTicket(result)
      setStep('ticket-result')
      handlePrintTicket(result)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError(err?.message || 'Error generating ticket. Is the backend running?')
    } finally {
      if (ticketRequestRef.current === controller) {
        ticketRequestRef.current = null
        setLoading(false)
      }
    }
  }

  // Registrar student tickets omit window entirely: Laravel resolves it from
  // the directory.  The optional window argument is reserved for Guest.
  const generateRegistrarTicket = async (tx, guestWindow = null) => {
    if (ticketRequestRef.current) return
    const controller = new AbortController()
    ticketRequestRef.current = controller
    if (guestWindow) setSelectedWindow(guestWindow)
    setError('')
    setLoading(true)
    try {
      const result = await generateTicket({
        service_type: serviceType,
        student_number: studentNumber || 'Guest',
        priority_type: priorityType,
        transaction_type: tx,
        ...(guestWindow ? { window: guestWindow } : {}),
        security_code: priorityType === 'P' ? securityCode : null,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      setTicketTime(new Date())
      setTicket(result)
      setStep('ticket-result')
      handlePrintTicket(result)

      // Clear the pending ref now that the ticket was created
      pendingTransactionRef.current = null
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError(err?.message || 'Error generating ticket. Is the backend running?')
    } finally {
      if (ticketRequestRef.current === controller) {
        ticketRequestRef.current = null
        setLoading(false)
      }
    }
  }

  const handleWindowSelect = (win) => {
    if (!isWindowAvailable('Registrar', win) || ticketRequestRef.current) return
    setSelectedWindow(win)
    setError('')
  }

  const continueWithGuestWindow = () => {
    if (!selectedWindow || !isWindowAvailable('Registrar', selectedWindow)) {
      setError('Select an available Registrar window to continue.')
      return
    }

    generateRegistrarTicket(pendingTransactionRef.current || transactionType, selectedWindow)
  }

  // ── FIX 5: getStepLabel fixed — no broken switch-inside-template-literal ──
  const getStepLabel = () => {
    switch (step) {
      case 'student-id': return 'Student Number'
      case 'select-service': return 'Select Service'
      case 'select-priority': return 'Select Priority'
      case 'select-transaction': return 'Select Transaction'
      case 'registrar-student': return 'Student Found'
      case 'select-window': return 'Select Window'
      case 'security-code': return 'Security Authorization'
      case 'ticket-result': return 'Your Ticket'
      default: return ''
    }
  }

  return (
    <div className={`kiosk-page ${step === 'welcome' ? 'kiosk-welcome-active' : ''}`}>
      {/* ── Splash Screen (Click to Begin) ── */}
      {step === 'welcome' && (
        <div className="kiosk-splash" onClick={handleTapToBegin}>
          <div className="splash-bg" />
          <div className="splash-overlay" />
          <div className="splash-dots" />
          <div className="splash-header">
            <div className="splash-header-time">
              <span className="splash-time">{formatTime(currentTime)}</span>
              <span className="splash-date">{formatDate(currentTime)}</span>
            </div>
          </div>
          <div className="splash-content">
            <div className="splash-logo">
              <img src="/loa-logo.png" alt="Lyceum of Alabang" />
            </div>
            <div className="splash-copy">
              <p className="splash-welcome">Welcome to</p>
              <h1 className="splash-title">Lyceum of Alabang</h1>
            </div>
            <button className="splash-start-btn" type="button">Tap to Begin</button>
          </div>
        </div>
      )}

      {/* ── Student Number Screen ── */}
      {step === 'student-id' && (
        <KioskLayout contentClassName="student-screen">
          <div className="student-screen-card-wrapper">
            <div className="student-card-panel">
              <div className="student-card-panel-header">
                <span className="student-card-panel-label">Student Number</span>
              </div>
              <div className="student-card-panel-body">
                <h2 className="student-card-panel-title">Student Number</h2>
                <p className="student-card-panel-subtitle">Please type your student number</p>
                <form className="student-number-form" onSubmit={handleStudentNumberSubmit}>
                  <label className="student-input-label">
                    <div className="student-input-field">
                      <span className="student-input-icon">👤</span>
                      <input
                        type="text"
                        value={studentNumber}
                        onChange={(e) => {
                          setStudentNumber(e.target.value)
                          setStudentRecord(null)
                          setError('')
                        }}
                        placeholder="Enter student number"
                        aria-label="Student Number"
                        inputMode="none"
                        maxLength={30}
                        autoFocus
                        className="student-number-input"
                        onClick={openStudentKeypad}
                      />
                    </div>
                  </label>
                  {error && <div className="student-form-error">{error}</div>}
                  <button type="button" className="student-guest-btn" onClick={handleGuestSelect}>
                    Continue as Guest
                  </button>
                </form>
                <button className="student-secondary-btn" type="button" onClick={() => {
                  setStep('welcome')
                  setServiceType(null)
                  setError('')
                }}>
                  <span className="student-secondary-icon">←</span>
                  Back to Welcome
                </button>
              </div>
            </div>
          </div>
          {showStudentKeypad && (
            <div className="student-keypad-overlay">
              <section className="student-keypad-modal" role="dialog" aria-modal="true" aria-labelledby="student-keypad-title">
                <h2 id="student-keypad-title">Student Number</h2>
                <div className={`student-keypad-display ${studentNumber ? '' : 'is-empty'}`} aria-live="polite">
                  {studentNumber || 'Enter student number'}
                </div>
                <div className="student-touch-keyboard" aria-label="Student number on-screen keyboard">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0'].map(key => (
                    <button key={key} type="button" className="student-key" onClick={() => handleStudentKey(key)} aria-label={key === '-' ? 'Hyphen' : key}>{key}</button>
                  ))}
                  <button type="button" className="student-key student-key-backspace" onClick={() => handleStudentKey('backspace')} aria-label="Delete last character">
                    <span className="material-symbols-outlined" aria-hidden="true">backspace</span>
                  </button>
                </div>
                <button type="button" className="student-keypad-clear" onClick={() => handleStudentKey('clear')} disabled={!studentNumber}>Clear</button>
                <div className="student-keypad-actions">
                  <button type="button" className="student-keypad-cancel" onClick={() => closeStudentKeypad(false)}>Cancel</button>
                  <button type="button" className="student-keypad-done" onClick={() => closeStudentKeypad(true)}>Done</button>
                </div>
              </section>
            </div>
          )}
        </KioskLayout>
      )}

      {/* ── Main Kiosk UI ── */}
      {step !== 'welcome' && step !== 'student-id' && (
        <KioskLayout>
          <div className="kiosk-container">
            {/* Content Card */}
            <div className={`kiosk-card ${step === 'select-window' ? 'select-window-card registrar-window-selection-card' : ''}`}>

            {/* ── Select Service ── */}
            {step === 'select-service' && (
              <>
                <div className="kiosk-card-header">
                  <h2>Welcome!</h2>
                  <p>Please select a service below</p>
                </div>
                <div className="kiosk-user-info" style={{ textAlign: 'center', marginBottom: '20px', color: '#F2C64B' }}>
                  <strong>User:</strong> {studentNumber ? studentNumber : 'Guest'}
                </div>

                  <div className="kiosk-service-grid">
                    {serviceOptions.map((option) => {
                      const isAvail = !['ITM', 'ADM'].includes(option.type) || windowAvailabilities.some(window =>
                        normalizeDepartment(window.department) === option.position && window.is_available && window.status === 'open'
                        && window.staff?.status === 'active' && window.staff?.position?.toLowerCase() === option.position)

                      return (
                        <button
                          key={option.type}
                          type="button"
                          className={`kiosk-service-card ${option.type === 'CS' ? 'service-cashier' : 'service-registrar'} ${!isAvail ? 'kiosk-card-disabled' : ''}`}
                          onClick={() => isAvail && handleServiceSelect(option.type)}
                          disabled={loading || !isAvail}
                          style={!isAvail ? { opacity: 0.6, cursor: 'not-allowed', position: 'relative' } : {}}
                        >
                          {!isAvail && (
                            <div style={{
                              position: 'absolute',
                              top: '10px',
                              right: '10px',
                              backgroundColor: '#ef4444',
                              color: '#ffffff',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                            }}>
                              Unavailable
                            </div>
                          )}
                          <div className="kiosk-service-card-icon">
                            <span className="material-symbols-outlined">{option.icon}</span>
                          </div>
                          <div className="kiosk-service-card-title">{option.title}</div>
                        </button>
                      )
                    })}
                  </div>
                {serviceOptions.length === 0 && <p>No departments are currently enabled.</p>}
                {error && <div className="kiosk-error" style={{ marginTop: '16px' }}>⚠️ {error}</div>}
              </>
            )}

            {/* Registrar lookup confirmation; the assigned window is informational only. */}
            {step === 'registrar-student' && (
              <>
                <div className="kiosk-card-header">
                  <h2>
                    <span className="material-symbols-outlined">person_search</span>
                    {studentLookupLoading ? 'Checking student record...' : studentRecord ? 'Student Found ✓' : 'Student lookup'}
                  </h2>
                  <p>{studentLookupLoading ? 'Please wait a moment.' : studentRecord ? 'Confirm your Registrar routing below.' : 'Please check your Student Number.'}</p>
                </div>
                {studentRecord && (
                  <div className="kiosk-user-info" style={{ textAlign: 'center', margin: '12px 0 24px', lineHeight: 1.8 }}>
                    <strong>{studentRecord.student_name}</strong><br />
                    <span>{studentRecord.course}</span><br />
                    <strong>Assigned Registrar Window: Window {studentRecord.registrar_window}</strong>
                  </div>
                )}
                {error && <div className="kiosk-error">⚠️ {error}</div>}
                <div className="kiosk-form-actions">
                  <button type="button" className="kiosk-back-btn" onClick={() => {
                    studentLookupRef.current?.abort()
                    setStep('student-id')
                    setError('')
                  }}>← Change Student Number</button>
                </div>
              </>
            )}


            {/* ── Select Priority ── */}
            {step === 'select-priority' && (
              <>
                <div className="kiosk-card-header">
                  <h2>
                    <span className="material-symbols-outlined">verified_user</span>
                    {selectedDepartment?.name} Service
                  </h2>
                  <p>Please select your queue type.</p>
                </div>
                {(serviceType === 'R' || serviceType === 'RT') && studentRecord && (
                  <div className="kiosk-user-info" style={{ textAlign: 'center', margin: '0 0 20px', lineHeight: 1.7 }}>
                    <strong>Student Found ✓</strong><br />
                    <strong>{studentRecord.student_name}</strong><br />
                    <span>{studentRecord.course}</span><br />
                    <strong>Assigned Registrar Window: Window {studentRecord.registrar_window}</strong>
                  </div>
                )}
                <div className="kiosk-service-grid">
                  {priorityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`kiosk-priority-card ${option.value === 'R' ? 'priority-regular' : 'priority-gold'}`}
                      onClick={() => handlePrioritySelect(option.value)}
                      disabled={loading}
                    >
                      <div className="kiosk-priority-icon">
                        <span className="material-symbols-outlined">{option.icon}</span>
                      </div>
                      <div className="kiosk-priority-title">{option.title}</div>
                      <div className="kiosk-priority-subtitle">{option.subtitle}</div>
                    </button>
                  ))}
                </div>
                {error && <div className="kiosk-error">⚠️ {error}</div>}
                <button className="kiosk-back-btn" onClick={() => {
                  setStep('select-service')
                  setServiceType(null)
                  setPriorityType(null)
                  setError('')
                }}>← Back to Services</button>
              </>
            )}

            {/* ── Security Code ── */}
            {/* Shown BEFORE select-transaction for Priority (any service) */}
            {step === 'security-code' && (
              <>
                <div className="kiosk-card-header">
                  <h2>
                    <span className="material-symbols-outlined">security</span>
                    Security Authorization
                  </h2>
                  <p>Priority tickets require a security guard's code</p>
                </div>
                <form className="kiosk-security-form" onSubmit={handleSecuritySubmit}>
                  <div className="kiosk-input-group">
                    <label>Security Code</label>
                    <input
                      type="password"
                      value={securityCode}
                      onChange={(e) => setSecurityCode(e.target.value)}
                      placeholder="Enter security PIN"
                      required
                      autoFocus
                      className="kiosk-pin-input"
                      inputMode="none"
                      maxLength={20}
                      onClick={openSecurityKeypad}
                    />
                  </div>
                  {error && <div className="kiosk-error">⚠️ {error}</div>}
                  <div className="kiosk-form-actions">
                    <button type="button" className="kiosk-back-btn" onClick={() => {
                      setStep('select-priority')
                      setSecurityCode('')
                      setShowSecurityKeypad(false)
                      setError('')
                    }}>
                      ← Back
                    </button>
                  </div>
                </form>
                {showSecurityKeypad && (
                  <div className="student-keypad-overlay">
                    <section className="student-keypad-modal" role="dialog" aria-modal="true" aria-labelledby="security-keypad-title">
                      <h2 id="security-keypad-title">Security Code</h2>
                      <div className={`student-keypad-display ${securityCode ? '' : 'is-empty'}`} aria-live="polite">
                        {securityCode ? '•'.repeat(securityCode.length) : 'Enter security code'}
                      </div>
                      <div className="student-touch-keyboard" aria-label="Security code on-screen keyboard">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0'].map(key => (
                          <button key={key} type="button" className="student-key" onClick={() => handleSecurityKey(key)} aria-label={key === '-' ? 'Hyphen' : key}>{key}</button>
                        ))}
                        <button type="button" className="student-key student-key-backspace" onClick={() => handleSecurityKey('backspace')} aria-label="Delete last character">
                          <span className="material-symbols-outlined" aria-hidden="true">backspace</span>
                        </button>
                      </div>
                      <button type="button" className="student-keypad-clear" onClick={() => handleSecurityKey('clear')} disabled={!securityCode}>Clear</button>
                      {error && <div className="kiosk-error">⚠️ {error}</div>}
                      <div className="student-keypad-actions">
                        <button type="button" className="student-keypad-cancel" onClick={() => closeSecurityKeypad(false)}>Cancel</button>
                        <button type="button" className="student-keypad-done" onClick={() => closeSecurityKeypad(true)} disabled={loading}>Done</button>
                      </div>
                    </section>
                  </div>
                )}
              </>
            )}

            {/* ── Select Transaction (Cashier & Registrar) ── */}
            {step === 'select-transaction' && (
              <>
                <div className="kiosk-card-header">
                  <h2>
                    <span className="material-symbols-outlined">receipt_long</span>
                    {selectedDepartment?.name} Transactions
                  </h2>
                  <p>Select the transaction you need</p>
                </div>
                <div className="kiosk-window-grid kiosk-transaction-grid">
                  {((serviceType === 'C' || serviceType === 'CS') ? cashierTransactions : (serviceType === 'R' || serviceType === 'RT') ? registrarTransactions : [{ title: `${selectedDepartment?.name} Service`, icon: selectedDepartment?.icon }]).map((transaction) => (
                    <button
                      key={transaction.title}
                      className="kiosk-transaction-card"
                      onClick={() => handleTransactionSelect(transaction.title)}
                      disabled={loading}
                      type="button"
                    >
                      <div className="kiosk-transaction-icon">
                        <span className="material-symbols-outlined">{transaction.icon}</span>
                      </div>
                      <div className="kiosk-transaction-title">{transaction.title}</div>
                    </button>
                  ))}
                </div>
                {error && <div className="kiosk-error">⚠️ {error}</div>}
                <button
                  className="kiosk-back-btn"
                  onClick={() => {
                    if (priorityType === 'P') {
                      setStep('security-code')
                    } else {
                      setStep('select-priority')
                    }
                  }}
                >
                  ← Back
                </button>
              </>
            )}

            {/* ── Select Window (Guest Registrar only) ── */}
            {step === 'select-window' && (
              <>
                <div className="kiosk-card-header">
                  <h2>Select Registrar Window</h2>
                  <p>Choose the Registrar window for your ticket.</p>
                </div>
                <div className="kiosk-window-grid kiosk-window-card-grid">
                  {windowOptions.map((win) => {
                    const isAvail = isWindowAvailable('Registrar', win)

                    return (
                      <button
                        key={win}
                        type="button"
                        className={`kiosk-window-card ${selectedWindow === win ? 'selected' : ''} ${!isAvail ? 'kiosk-window-card-unavailable' : ''}`}
                        onClick={isAvail ? () => handleWindowSelect(win) : undefined}
                        disabled={loading || !isAvail}
                        aria-pressed={selectedWindow === win}
                      >
                        <div className="kiosk-window-number">Window {win}</div>
                        <div className={`kiosk-window-programs${win === 10 ? ' kiosk-window-programs-two-columns' : ''}`}>
                          {REGISTRAR_WINDOW_COURSES[win].map((course) => (
                            <span key={course}>{course}</span>
                          ))}
                        </div>
                        <div className="kiosk-window-availability" aria-live="polite">
                          {!isAvail ? 'UNAVAILABLE' : ''}
                        </div>
                      </button>
                    )
                  })}
                </div>
                {error && <div className="kiosk-error">⚠️ {error}</div>}
                <div className="kiosk-form-actions">
                  <button className="kiosk-back-btn" type="button" onClick={() => {
                    setSelectedWindow(null)
                    setStep('select-transaction')
                  }}>← Back</button>
                  <button
                    className="kiosk-action-btn"
                    type="button"
                    onClick={continueWithGuestWindow}
                    disabled={loading || !selectedWindow}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {/* ── Ticket Result ── */}
            {step === 'ticket-result' && ticket && (
              <>
                <div className="kiosk-card-header">
                  <h2>
                    <span className="material-symbols-outlined">confirmation_number</span>
                    Your Queue Ticket
                  </h2>
                  <p>Please proceed to the waiting area</p>
                </div>
                <div className="kiosk-ticket-preview kiosk-receipt">
                  {['ITM', 'ADM'].includes(ticket.service_type) && (
                    <div className="kiosk-receipt-window" style={{ background: 'rgba(2, 132, 199, 0.1)', borderColor: '#0284c7' }}>
                      <div className="kiosk-receipt-window-num" style={{ color: '#0284c7', fontSize: '1.4rem', fontWeight: 800 }}>
                        {departmentFor(ticket.service_type)?.name} DEPARTMENT
                      </div>
                      <div className="kiosk-receipt-window-programs" style={{ color: '#0369a1' }}>
                        Institute of Technology & Management
                      </div>
                    </div>
                  )}

                  {(ticket.service_type === 'R' || ticket.service_type === 'RT') && (ticket.window || selectedWindow) && (
                    <div className="kiosk-receipt-window">
                      <div className="kiosk-receipt-window-num">
                        Window {ticket.window || selectedWindow}
                      </div>
                      {ticket.course && <div className="kiosk-receipt-window-programs">{ticket.course}</div>}
                    </div>
                  )}

                  {(ticket.transaction_type || transactionType) && (
                    <div className="kiosk-receipt-transaction">
                      {ticket.transaction_type || transactionType}
                    </div>
                  )}
  
                  <div className="kiosk-receipt-divider" />
  
                  <div className="kiosk-ticket-num-big">
                    {getTicketNumber(ticket)}
                  </div>

                  <div className="kiosk-receipt-issued">
                    Issued: {formatDate(ticketTime || currentTime)} • {formatTime(ticketTime || currentTime)}
                  </div>

                  <div className="kiosk-receipt-divider" />

                  <div className="kiosk-ticket-footer">
                    <p>Please wait until your number appears on the display board.</p>
                  </div>
                </div>

                {printStatus === 'printing' && (
                  <div className="kiosk-print-notice kiosk-print-notice--info" style={{ margin: '14px 0', padding: '10px 16px', background: '#e0f2fe', color: '#0369a1', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>print</span>
                    Printing queue ticket...
                  </div>
                )}
                {printStatus === 'printed' && (
                  <div className="kiosk-print-notice kiosk-print-notice--success" style={{ margin: '14px 0', padding: '10px 16px', background: '#dcfce7', color: '#15803d', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>check_circle</span>
                    Ticket printed successfully
                  </div>
                )}
                {printStatus === 'failed' && (
                  <div className="kiosk-print-notice kiosk-print-notice--warning" style={{ margin: '14px 0', padding: '12px 16px', background: '#fef3c7', color: '#92400e', borderRadius: '8px', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textAlign: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px', flexShrink: 0 }}>warning</span>
                    <span>Printer unavailable or disconnected. Please note your queue number above.</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', marginTop: '14px', width: '100%' }}>
                  <button
                    className="kiosk-action-btn print-ticket-btn"
                    type="button"
                    style={{ flex: 1, background: '#0284c7', color: '#fff', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={() => handlePrintTicket(ticket)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>print</span>
                    {printStatus === 'printed' ? 'Reprint Ticket' : 'Print Ticket'}
                  </button>
                  <button className="kiosk-action-btn new-ticket" type="button" style={{ flex: 1 }} onClick={handleReset}>Get Another Ticket</button>
                </div>
              </>
            )}

            </div>
          </div>
        </KioskLayout>
      )}
    </div>
  )
}

export default Kiosk
