export default function CalendarDateInput({ value, onChange, ...props }) {
  const label = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Select date'

  return (
    <div className="date-range-trigger activity-date-control">
      <span className="date-range-icon" aria-hidden="true">📅</span>
      <span>{label}</span>
      <input {...props} type="date" value={value} onChange={onChange} />
    </div>
  )
}
