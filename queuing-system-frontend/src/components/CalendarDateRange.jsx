import { useEffect, useRef, useState } from 'react'

export default function CalendarDateRange({ start, end, onApply, label, triggerLabel, dashboardStyle = false }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(start)
  const [to, setTo] = useState(end)
  const container = useRef(null)
  const trigger = useRef(null)
  const format = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select date'
  const valid = Boolean(from && to && from <= to)

  useEffect(() => {
    if (!open) return
    const dismiss = event => { if (!container.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  return (
    <div ref={container} style={{ position: 'relative', display: 'inline-block' }} onKeyDown={event => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }}>
      <button ref={trigger} type="button" className="date-range-trigger" style={{ maxWidth: '100%' }} aria-label={label} aria-expanded={open} onClick={() => {
        setFrom(start); setTo(end); setOpen(!open)
      }}>
        <span className="date-range-icon" aria-hidden="true">📅</span>
        <span>{triggerLabel || (start === end ? format(start) : `${format(start)} – ${format(end)}`)}</span>
      </button>
      {open && <div className={`date-range-popover calendar-range-popup${dashboardStyle ? ' dashboard-style' : ''}`} style={{ left: 0, right: 'auto' }} role="group" aria-label={`${label} selection`}>
        <div className="date-range-popover-header">Select date range</div>
        <div className="date-range-popover-body">
          <label className="date-range-field"><span>From</span><input autoFocus className="dashboard-date-input" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
          <label className="date-range-field"><span>To</span><input className="dashboard-date-input" type="date" min={from || undefined} value={to} onChange={event => setTo(event.target.value)} /></label>
          {!valid && <span role="alert">Choose both dates, with From on or before To.</span>}
          {dashboardStyle ? (
            <div className="date-range-actions">
              <button type="button" className="date-range-clear-btn" onClick={() => {
                const currentDay = new Date().toISOString().slice(0, 10)
                setFrom(currentDay)
                setTo(currentDay)
                onApply(currentDay, currentDay)
                setOpen(false)
                trigger.current?.focus()
              }}>Today</button>
              <button type="button" className="date-range-apply-btn" disabled={!valid} onClick={() => { onApply(from, to); setOpen(false); trigger.current?.focus() }}>Apply</button>
            </div>
          ) : (
            <div className="calendar-range-actions">
              <button type="button" className="calendar-range-cancel" onClick={() => { setOpen(false); trigger.current?.focus() }}>Cancel</button>
              <button type="button" className="calendar-range-apply" disabled={!valid} onClick={() => { onApply(from, to); setOpen(false); trigger.current?.focus() }}>Apply</button>
            </div>
          )}
        </div>
      </div>}
    </div>
  )
}
