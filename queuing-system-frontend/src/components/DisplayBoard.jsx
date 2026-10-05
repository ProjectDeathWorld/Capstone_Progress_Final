import { useLayoutEffect, useRef, useState } from 'react'
import { departmentFor, enabledDepartments } from '../utils/departments'
import {
  DISPLAY_FONT_OPTIONS,
  DISPLAY_TEXT_SIZE_OPTIONS,
  ELEMENT_FONT_SIZE_OPTIONS,
  DEFAULT_DISPLAY_FONT_CONTROLS,
  DEFAULT_DISPLAY_TEXT_LABELS,
  DEFAULT_DISPLAY_PANEL_COLORS,
  DEFAULT_WINDOW_TICKET_TEXT_COLOR,
  formatDisplayDate,
  formatMoreLabel,
  getColorContrastRatio,
  getDisplayBoardConfig,
  getDisplayWindowOptions,
} from '../utils/displayBoardConfig'
import { getTicketNumber } from '../utils/queueNumber'
import { countTicketsThatFit } from '../utils/waitingQueueLayout'

const DEPARTMENT_COLORS = {
  Cashier: '#2563eb',
  Registrar: '#f2c64b',
  Accounting: '#f59e0b',
  Admission: '#8b5cf6',
  ITM: '#0284c7',
  Inactive: '#6b7280',
}

function WaitingDepartment({ name, displayName, tickets, waitingFontSize, labels, waitingTicketsFont }) {
  const sectionRef = useRef(null)
  const listRef = useRef(null)
  const moreRef = useRef(null)
  const [visibleTicketCount, setVisibleTicketCount] = useState(tickets.length)
  const density = tickets.length >= 9 ? 'many' : tickets.length >= 5 ? 'medium' : 'few'
  const hiddenCount = Math.max(0, tickets.length - visibleTicketCount)

  useLayoutEffect(() => {
    const measure = () => {
      const list = listRef.current
      if (!list) return

      const listBounds = list.getBoundingClientRect()
      const isOverflowing = visibleTicketCount < tickets.length
      const indicatorSpace = isOverflowing
        ? (moreRef.current?.getBoundingClientRect().height || 0) + 8
        : 0
      const ticketBounds = Array.from(list.children).map(ticket => ticket.getBoundingClientRect())
      const nextVisibleTicketCount = countTicketsThatFit(
        ticketBounds,
        listBounds.bottom,
        indicatorSpace,
      )

      setVisibleTicketCount(current => current === nextVisibleTicketCount ? current : nextVisibleTicketCount)
    }

    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (observer) {
      if (sectionRef.current) observer.observe(sectionRef.current)
      if (listRef.current) observer.observe(listRef.current)
      Array.from(listRef.current?.children || []).forEach(ticket => observer.observe(ticket))
    }
    if (typeof window !== 'undefined') window.addEventListener('resize', measure)

    return () => {
      observer?.disconnect()
      if (typeof window !== 'undefined') window.removeEventListener('resize', measure)
    }
  }, [tickets, visibleTicketCount])

  return (
    <section
      ref={sectionRef}
      className={`waiting-department waiting-density-${density}`}
      style={{
        fontFamily: waitingTicketsFont?.family,
        fontWeight: waitingTicketsFont?.weight,
        '--waiting-tickets-size-scale': waitingTicketsFont?.sizeScale ?? 1,
      }}
    >
      <header className="waiting-department-header">
        <strong style={{ fontSize: `calc(.78rem * ${waitingTicketsFont?.sizeScale ?? 1})` }}>{displayName.toUpperCase()}</strong>
        <span style={{ fontSize: `calc(.66rem * ${waitingTicketsFont?.sizeScale ?? 1})` }}>{tickets.length} {labels.waiting}</span>
      </header>
      {tickets.length === 0 ? (
        <div className="waiting-department-empty">{labels.noWaitingTickets}</div>
      ) : (
        <div
          ref={listRef}
          className={`waiting-department-tickets waiting-font-${waitingFontSize || 'medium'}`}
          style={{ '--waiting-tickets-size-scale': waitingTicketsFont?.sizeScale ?? 1 }}
        >
          {tickets.map((ticket, index) => {
            const ticketNumber = getTicketNumber(ticket)
            const lengthClass = ticketNumber.length > 12 ? 'ticket-length-extra-long' : ticketNumber.length > 8 ? 'ticket-length-long' : 'ticket-length-normal'
            const isVisible = index < visibleTicketCount

            return (
              <div
                key={ticket.ticket_id || ticket.ticket_number}
                className="waiting-ticket-item"
                style={{ visibility: isVisible ? 'visible' : 'hidden' }}
                aria-hidden={!isVisible}
              >
                <span
                  className={lengthClass}
                  style={{
                    fontFamily: waitingTicketsFont?.family,
                    fontWeight: waitingTicketsFont?.weight,
                  }}
                >
                  {ticketNumber}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <div
        ref={moreRef}
        className="waiting-more-indicator"
        aria-hidden={hiddenCount === 0}
        style={{ visibility: hiddenCount > 0 ? 'visible' : 'hidden' }}
      >
        {hiddenCount > 0 ? formatMoreLabel(labels.moreTemplate, hiddenCount) : ''}
      </div>
    </section>
  )
}

export function DisplayBoard({
  config,
  currentTime,
  cashierTickets = [],
  registrarTickets = [],
  itmTickets = [],
  admissionTickets = [],
  servingTickets = [],
  mode = 'full',
  className = '',
}) {
  const displayConfig = config || getDisplayBoardConfig()
  const now = currentTime || new Date()
  const labels = displayConfig.settings.displayLabels || DEFAULT_DISPLAY_TEXT_LABELS

  const activeDepartments = enabledDepartments(displayConfig.settings)
  const activeServingTickets = servingTickets
    .filter(ticket => activeDepartments.includes(departmentFor(ticket.service_type)?.name))
    .filter((ticket) => String(ticket.status || '').toLowerCase() === 'serving')
    .sort((a, b) => {
      const aStarted = new Date(a.serving_started_at || a.called_at || a.created_at || 0).getTime()
      const bStarted = new Date(b.serving_started_at || b.called_at || b.created_at || 0).getTime()
      return bStarted - aStarted
    })

  const windowKeyFor = (department, number) => `${departmentFor(department)?.name}:${Number(number)}`
  const configuredWindows = getDisplayWindowOptions(displayConfig)
  const displayWindows = configuredWindows.map(window => ({
    ...window,
    ticket: activeServingTickets.find(ticket =>
      windowKeyFor(ticket.service_type, ticket.window) === windowKeyFor(window.department, window.windowNumber)),
  }))

  const waitingDepartments = Object.entries({ Cashier: cashierTickets, Registrar: registrarTickets, ITM: itmTickets, Admission: admissionTickets })
    .filter(([name]) => activeDepartments.includes(name))
    .map(([name, tickets]) => ({ name, tickets }))
  const waitingTicketsTotal = waitingDepartments.reduce((total, department) => total + department.tickets.length, 0)

  const fontControls = {
    ...DEFAULT_DISPLAY_FONT_CONTROLS,
    ...(displayConfig.settings.fontControls || {}),
  }

  const getElementFont = (key) => {
    const elConfig = fontControls[key] || DEFAULT_DISPLAY_FONT_CONTROLS[key]
    const family = DISPLAY_FONT_OPTIONS[elConfig?.fontFamily]?.family || DISPLAY_FONT_OPTIONS.poppins.family
    const sizeScale = ELEMENT_FONT_SIZE_OPTIONS[elConfig?.fontSize]?.scale ?? 1.0
    const weight = elConfig?.fontWeight || '700'
    return { family, sizeScale, weight }
  }

  const nowServingFont = getElementFont('nowServing')
  const waitingQueueFont = getElementFont('waitingQueue')
  const serviceNamesFont = getElementFont('serviceNames')
  const windowLabelsFont = getElementFont('windowLabels')
  const ticketNumbersFont = getElementFont('ticketNumbers')
  const waitingTicketsFont = getElementFont('waitingQueueTickets')

  const displayStyle = {
    '--display-accent': '#f2c64b',
    '--announcement-background': displayConfig.settings.accentColor || '#f2c64b',
    '--announcement-text': displayConfig.settings.announcementTextColor || '#071b4d',
    '--now-serving-text': displayConfig.settings.nowServingTextColor || '#ffffff',
    '--now-serving-background': displayConfig.settings.nowServingBackgroundColor || '#071238',
    '--date-time-text': displayConfig.settings.dateTimeTextColor || '#ffffff',
    '--waiting-queue-background': displayConfig.settings.waitingQueueColors?.background || '#071238',
    '--waiting-queue-text': displayConfig.settings.waitingQueueColors?.text || '#ffffff',
    '--display-ink': displayConfig.settings.theme === 'light' ? '#071b4d' : '#f8fbff',
    '--display-text': displayConfig.settings.theme === 'light' ? '#071b4d' : '#ffffff',
    '--display-muted': displayConfig.settings.theme === 'light' ? '#4b5c7a' : '#dce5ff',
    '--display-surface': displayConfig.settings.theme === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(6, 18, 40, 0.82)',
    '--display-border': displayConfig.settings.theme === 'light' ? 'rgba(7,27,77,0.18)' : 'rgba(255,255,255,0.16)',
    '--now-serving-font-family': nowServingFont.family,
    '--now-serving-size-scale': nowServingFont.sizeScale,
    '--now-serving-font-weight': nowServingFont.weight,
    '--waiting-queue-font-family': waitingQueueFont.family,
    '--waiting-queue-size-scale': waitingQueueFont.sizeScale,
    '--waiting-queue-font-weight': waitingQueueFont.weight,
    '--service-name-font-family': serviceNamesFont.family,
    '--service-name-size-scale': serviceNamesFont.sizeScale,
    '--service-name-font-weight': serviceNamesFont.weight,
    '--window-label-font-family': windowLabelsFont.family,
    '--window-label-size-scale': windowLabelsFont.sizeScale,
    '--window-label-font-weight': windowLabelsFont.weight,
    '--ticket-number-font-family': ticketNumbersFont.family,
    '--ticket-number-size-scale': ticketNumbersFont.sizeScale,
    '--ticket-number-font-weight': ticketNumbersFont.weight,
    '--waiting-tickets-font-family': waitingTicketsFont.family,
    '--waiting-tickets-size-scale': waitingTicketsFont.sizeScale,
    '--waiting-tickets-font-weight': waitingTicketsFont.weight,
    fontFamily: DISPLAY_FONT_OPTIONS[displayConfig.settings.displayFontFamily]?.family || DISPLAY_FONT_OPTIONS.poppins.family,
    fontSize: DISPLAY_TEXT_SIZE_OPTIONS[displayConfig.settings.displayTextSize]?.scale || DISPLAY_TEXT_SIZE_OPTIONS.medium.scale,
    backgroundColor: displayConfig.settings.backgroundType === 'image' && displayConfig.settings.backgroundImage
      ? undefined
      : displayConfig.settings.backgroundType === 'gradient'
        ? undefined
        : (displayConfig.settings.backgroundColor || '#071b4d'),
    backgroundImage: displayConfig.settings.backgroundType === 'image' && displayConfig.settings.backgroundImage
      ? `url(${displayConfig.settings.backgroundImage})`
      : displayConfig.settings.backgroundType === 'gradient'
        ? displayConfig.settings.backgroundGradient
        : undefined,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
  }

  const themeClass = displayConfig.settings.theme === 'light' ? 'display-theme-light' : 'display-theme-dark'
  return (
    <div className={`display-page ${themeClass} layout-${displayConfig.settings.layout || 'modern'} flash-${displayConfig.settings.flashSpeed || 'medium'} ${mode === 'preview' ? 'display-preview-mode' : ''} ${className}`.trim()} style={displayStyle}>
      <header className="display-board-header">
        <div className="display-board-brand">
          <img src={displayConfig.settings.logoImage || '/loa-logo.png'} alt="School logo" />
          <div><strong>{displayConfig.settings.schoolName}</strong><span>{displayConfig.settings.subtitle}</span></div>
        </div>
        <div className="display-board-timebar">
          {displayConfig.settings.showClock && <span className="display-board-time">{now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
          {displayConfig.settings.showDate && <span className="display-board-day">{formatDisplayDate(now, labels)}</span>}
          {displayConfig.settings.showLiveIndicator && <span className="display-live-indicator">{labels.live}</span>}
        </div>
      </header>

      <section className="display-content-header">
        <div>
          <h2
            className="display-now-serving-title"
            style={{
              fontFamily: nowServingFont.family,
              fontWeight: nowServingFont.weight,
              fontSize: `calc(clamp(2rem, 2.8vw, 3.5rem) * ${nowServingFont.sizeScale})`,
            }}
          >
            {labels.nowServing}
          </h2>
        </div>
        {(displayConfig.settings.showClock || displayConfig.settings.showDate) && <div className="display-board-clock">
          <div className="clock-day">{displayConfig.settings.showDate && now.toLocaleDateString('en-PH', { weekday: 'long' })}</div>
          <div className="clock-date">{displayConfig.settings.showDate && formatDisplayDate(now, false)}</div>
          <div className="clock-time">{displayConfig.settings.showClock && now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        </div>}
      </section>

      <div className={`display-board-body queue-${displayConfig.settings.queuePosition || 'right'} ${displayConfig.settings.showWaitingQueue ? '' : 'single-column'}`}>
        <main className="now-serving-shell">
          <div className={`now-serving-grid now-serving-adaptive-grid ${displayWindows.length >= 9 ? 'has-many-panels' : ''} panels-${displayWindows.length}`} data-panel-count={displayWindows.length}>
            {displayWindows.map(({ department, windowNumber, ticket }) => {
              const shouldFlash = displayConfig.settings.flashEnabled && Boolean(ticket)
              const departmentName = labels.departmentNames[department]
              const windowLabel = labels.windowLabels[`${department}:${windowNumber}`] ?? `${labels.window} ${windowNumber}`
              const panelLabel = `${departmentName.toUpperCase()} ${windowLabel}`
              const ticketNumber = ticket ? getTicketNumber(ticket) : ''

              const deptPanelColors = displayConfig.settings.panelColors?.[department] || DEFAULT_DISPLAY_PANEL_COLORS[department]
              const deptBg = deptPanelColors.background
              const deptText = deptPanelColors.text
              const globalTicketColor = displayConfig.settings.windowTicketTextColor || DEFAULT_WINDOW_TICKET_TEXT_COLOR
              const panelTicketColor = getColorContrastRatio(globalTicketColor, deptBg) >= 3.0
                ? globalTicketColor
                : deptText

              return (
                <article
                  key={`${department}-${windowNumber ?? 'service'}-${ticket?.ticket_id ?? ticket?.ticket_number ?? 'empty'}`}
                  aria-label={panelLabel}
                  className={`now-serving-card ${shouldFlash ? `${displayConfig.settings.animation || 'pulse'} window-flash` : ''}`}
                  style={{
                    '--card-accent': DEPARTMENT_COLORS[department],
                    '--card-background': deptBg,
                    '--card-text': deptText,
                    '--card-ticket-text': panelTicketColor,
                  }}
                >
                  <div className="card-header">
                    <div>
                      <span
                        className="card-category"
                        style={{
                          fontFamily: serviceNamesFont.family,
                          fontWeight: serviceNamesFont.weight,
                          fontSize: `calc(clamp(11px, 3.8cqw, 20px) * ${serviceNamesFont.sizeScale})`,
                        }}
                      >
                        {departmentName}
                      </span>
                      <strong
                        className="card-window"
                        style={{
                          fontFamily: windowLabelsFont.family,
                          fontWeight: windowLabelsFont.weight,
                          fontSize: `calc(clamp(16px, 6.8cqw, 32px) * ${windowLabelsFont.sizeScale})`,
                        }}
                      >
                        {windowLabel}
                      </strong>
                    </div>
                  </div>

                  {ticket && (
                    <div
                      className="card-ticket-number"
                      aria-live="polite"
                      aria-atomic="true"
                      style={{
                        '--ticket-len': Math.max(ticketNumber.length, 4),
                        '--ticket-cqw': `${(80 / Math.max(ticketNumber.length, 4)).toFixed(2)}cqw`,
                        fontFamily: ticketNumbersFont.family,
                        fontWeight: ticketNumbersFont.weight,
                        fontSize: `calc(clamp(24px, min(${(80 / Math.max(ticketNumber.length, 4)).toFixed(2)}cqw, 68px), 74px) * ${ticketNumbersFont.sizeScale})`,
                      }}
                    >
                      <span className="card-ticket-text">{ticketNumber}</span>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </main>

        {displayConfig.settings.showWaitingQueue && (
          <aside className={`waiting-queue-shell queue-${displayConfig.settings.queuePosition || 'right'}`}>
            <div className="panel-header display-waiting-queue-header">
              <div>
                <p
                  className="panel-title display-waiting-queue-title"
                  style={{
                    fontFamily: waitingQueueFont.family,
                    fontWeight: waitingQueueFont.weight,
                    fontSize: `calc(clamp(1.3rem, 1.7vw, 1.95rem) * ${waitingQueueFont.sizeScale})`,
                  }}
                >
                  {labels.waitingQueue}
                </p>
              </div>
              <span
                className="panel-subtitle display-waiting-queue-subtitle"
                style={{
                  fontFamily: waitingTicketsFont.family,
                  fontWeight: waitingTicketsFont.weight,
                  fontSize: `calc(clamp(0.95rem, 1.1vw, 1.25rem) * ${waitingTicketsFont.sizeScale})`,
                }}
              >
                {waitingTicketsTotal} {waitingTicketsTotal === 1 ? labels.waitingTicket : labels.waitingTickets}
              </span>
            </div>

            <div className={`waiting-queue-content waiting-department-grid waiting-font-${fontControls.waitingQueueTickets?.fontSize || displayConfig.settings.waitingFontSize || 'medium'}`}>
              {waitingDepartments.map(department => (
                <WaitingDepartment
                  key={department.name}
                  name={department.name}
                  displayName={labels.departmentNames[department.name]}
                  tickets={department.tickets}
                  waitingFontSize={fontControls.waitingQueueTickets?.fontSize || displayConfig.settings.waitingFontSize || 'medium'}
                  labels={labels}
                  waitingTicketsFont={waitingTicketsFont}
                />
              ))}
            </div>
          </aside>
        )}
      </div>

      {displayConfig.settings.announcementEnabled && displayConfig.settings.announcement && (
        <div className={`display-announcement ticker-${displayConfig.settings.announcementSpeed || 'medium'}`}>
          <span className="display-announcement-track">{displayConfig.settings.announcement}</span>
        </div>
      )}
    </div>
  )
}
