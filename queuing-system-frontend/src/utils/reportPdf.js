import { displayValue, isMissingValue } from './adminDisplay'
import { jsPDF } from 'jspdf'

const navy = '#142b4c', gold = '#b39142', muted = '#637185'
const palette = [navy, gold, '#638996', '#a9b6c4', '#796e88', '#c2cbd5']
const minutes = value => isMissingValue(value) || !Number.isFinite(Number(value)) ? '0' : `${Number(value).toFixed(2)} min`

// All metrics and series are returned by QueueReport; this module only draws them.
export function createReportPdf(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const text = (value, x, y, size = 9, color = navy, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(color)
    doc.text(Array.isArray(value) ? value : String(displayValue(value)), x, y)
  }
  const box = (x, y, w, h) => { doc.setDrawColor('#dce3eb').setFillColor('#ffffff'); doc.roundedRect(x, y, w, h, 2, 2, 'FD') }
  const header = subtitle => {
    text('LYCEUM OF ALABANG', 15, 17, 12, navy, true)
    text('Queue Management System', 15, 23, 8, muted)
    doc.setDrawColor(gold).setLineWidth(.7).line(15, 28, 195, 28)
    text(subtitle, 15, 39, 17, navy, true)
  }
  const newPage = title => { doc.addPage(); header(title) }
  const empty = (x, y) => text('No transaction data for selected period', x, y, 9, muted)
  const chartTitle = (title, x, y) => text(title, x, y, 10, navy, true)
  const line = (title, rows, series, x, y, w, h) => {
    box(x, y, w, h); chartTitle(title, x + 4, y + 8)
    const values = rows.flatMap(r => series.map(s => r[s.key])).filter(v => v != null)
    if (!rows.length || !values.length) { empty(x + 4, y + 24); return }
    const max = series[0].key === 'tickets_issued' ? Math.max(4, Math.ceil(Math.max(...values) / 4) * 4) : Math.max(...values, 1)
    const left = x + 12, top = y + 19, pw = w - 18, ph = h - 35
    for (let i = 0; i <= 4; i++) {
      const yy = top + ph - ph * i / 4
      doc.setDrawColor('#e4e9ef').setLineWidth(.15).line(left, yy, left + pw, yy)
      text(Number((max * i / 4).toFixed(1)), x + 3, yy + 1, 6, muted)
    }
    series.forEach((s, index) => {
      doc.setDrawColor(palette[index]).setFillColor(palette[index]).setLineWidth(.6)
      let previous = null
      rows.forEach((r, i) => {
        if (r[s.key] == null) { previous = null; return }
        // Position by actual calendar day, preserving gaps in sparse historical data.
        const first = Date.parse(rows[0].date), last = Date.parse(rows.at(-1).date)
        const xx = left + (last === first ? pw / 2 : (Date.parse(r.date) - first) / (last - first) * pw)
        const yy = top + ph - r[s.key] / max * ph
        if (previous) doc.line(previous[0], previous[1], xx, yy)
        doc.circle(xx, yy, .65, 'F'); previous = [xx, yy]
      })
      text(s.label, x + 5 + index * 58, y + h - 3, 7, palette[index])
    })
    const indexes = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])]
    indexes.forEach(i => text(rows[i].label, left + (indexes.length === 1 ? pw / 2 : i / Math.max(rows.length - 1, 1) * (pw - 10)), top + ph + 5, 6, muted))
  }
  const donut = (title, rows, x, y, w, h) => {
    box(x, y, w, h); chartTitle(title, x + 4, y + 8)
    const total = rows.reduce((sum, r) => sum + r.value, 0)
    if (!total) { empty(x + 4, y + 24); return }
    const cx = x + 24, cy = y + 32, radius = 15
    let angle = -Math.PI / 2
    rows.forEach((r, i) => {
      const sweep = r.value / total * Math.PI * 2
      doc.setFillColor(palette[i % palette.length]).setDrawColor(palette[i % palette.length])
      if (sweep > 0) {
        const points = [[radius * Math.cos(angle), radius * Math.sin(angle)]]
        let previous = points[0]
        for (let a = angle + .025; a < angle + sweep + .025; a += .025) {
          const at = Math.min(a, angle + sweep)
          const next = [radius * Math.cos(at), radius * Math.sin(at)]
          points.push([next[0] - previous[0], next[1] - previous[1]])
          previous = next
        }
        points.push([-previous[0], -previous[1]])
        doc.lines(points, cx, cy, [1, 1], 'F', true)
      }
      angle += sweep
      text(`${r.label}: ${r.value}`, x + 46, y + 21 + i * 7, 7, palette[i % palette.length])
    })
    doc.setFillColor('#ffffff').circle(cx, cy, 11, 'F')
    text(total, cx - 5, cy + 2, 11, navy, true)
    text('Tickets issued', x + 6, y + h - 5, 7, muted)
  }
  const bars = (title, rows, x, y, w, h, metric = 'value') => {
    box(x, y, w, h); chartTitle(title, x + 4, y + 8)
    if (!rows.length || !rows.some(r => r[metric] > 0)) { empty(x + 4, y + 24); return }
    const max = Math.max(...rows.map(r => r[metric]), 1), step = (h - 21) / rows.length
    rows.forEach((r, i) => {
      const yy = y + 17 + step * i
      doc.setFont('helvetica', 'normal').setFontSize(7)
      const label = doc.splitTextToSize(r.label, 56)
      text(label, x + 4, yy, 7)
      doc.setFillColor(i % 2 ? '#638996' : navy).rect(x + 64, yy - 3, (w - 82) * r[metric] / max, Math.min(4, step - 2), 'F')
      text(r[metric], x + w - 14, yy, 7)
    })
  }
  const finish = () => {
    const pages = doc.getNumberOfPages()
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setDrawColor('#dce3eb').line(15, 277, 195, 277)
      text('Generated by Queue Management System', 15, 284, 7, muted)
      text(`Page ${i} of ${pages}`, 175, 284, 7, muted)
    }
    return doc
  }
  const s = data.report_summary, c = data.charts
  header('QUEUE PERFORMANCE REPORT')
  text(data.department === 'all' ? 'All Departments' : data.department, 15, 49, 11, navy, true)
  text(data.date_range.formatted, 15, 56, 9)
  text(`Generated: ${data.generated_at} | ${data.timezone}`, 15, 63, 7, muted)
  const cards = [ ['Tickets Issued', s.tickets_issued], ['Students Served', s.students_served], ['Completed', s.completed],
    ['Skipped / No Show', s.cancelled_skipped], ['Avg Waiting Time', minutes(s.average_waiting_time)],
    ['Avg Service Time', minutes(s.average_service_time)], ['Completion Rate', `${displayValue(s.completion_rate)}%`] ]
  cards.forEach(([label, value], i) => {
    const x = 15 + (i % 4) * 46, y = 71 + Math.floor(i / 4) * 24
    box(x, y, 42, 20); text(label, x + 3, y + 6, 7, muted); text(value, x + 3, y + 15, 12, navy, true)
  })
  if (!s.tickets_issued) { empty(15, 138); return finish() }
  line('Ticket volume trend', c.daily, [{key: 'tickets_issued', label: 'Tickets issued'}, {key: 'completed', label: 'Completed'}], 15, 122, 180, 75)
  donut('Status distribution', c.statuses, 15, 204, 180,  60)

  newPage('SERVICE PERFORMANCE')
  const comparison = data.department === 'all'
    ? Object.values(data.department_summary).map(r => ({...r, label: r.department})) : c.windows
  bars(data.department === 'all' ? 'Completed tickets by department' : 'Completed tickets by window', comparison.slice(0, 10), 15, 47, 180, 72, 'completed')
  line('Waiting and service time by ticket creation day', c.daily,
    [{key: 'average_waiting_time', label: 'Average waiting (min)'}, {key: 'average_service_time', label: 'Average service (min)'}], 15, 126, 180, 76)
  donut('Student vs Guest', c.visitors, 15, 209, 180, 55)

  newPage('QUEUE ACTIVITY / STAFF PERFORMANCE')
  const hourHeight = Math.max(45, c.hourly.length * 6 + 24)
  bars('Hourly ticket creation volume', c.hourly, 15, 47, 180, hourHeight)
  let cursor = 47 + hourHeight + 13
  const categories = c.transactions
  for (let i = 0; i < Math.max(categories.length, 1); i += 10) {
    const rows = categories.slice(i, i + 10)
    const height = Math.max(40, rows.length * 12 + 24)
    if (cursor + height > 260) { newPage('TRANSACTION / STAFF PERFORMANCE'); cursor = 47 }
    bars('Completed tickets by transaction type', rows, 15, cursor, 180, height)
    cursor += height + 13
  }
  if (comparison.length > 10) {
    for (let i = 10; i < comparison.length; i += 10) {
      if (cursor + 110 > 260) { newPage('WINDOW PERFORMANCE - CONTINUED'); cursor = 47 }
      bars('Completed tickets by window', comparison.slice(i, i + 10), 15, cursor, 180, 110, 'completed')
      cursor += 123
    }
  }
  if (cursor + 38 > 260) { newPage('REPORT INSIGHTS'); cursor = 47 }
  text(`Peak hour: ${data.kpi_summary.busiest_peak_hour || 'No activity'}  |  Completion: ${s.completion_rate}%`, 15, cursor, 9)
  text(`Excluded duration samples: waiting ${s.excluded_waiting_samples}; service ${s.excluded_service_samples}`, 15, cursor + 8, 8, muted)
  text(data.population, 15, cursor + 16, 8, muted)
  let tableTop = cursor + 32
  if (tableTop + 30 > 260) { newPage('STAFF / WINDOW PERFORMANCE'); tableTop = 47 }
  text('Staff / window performance', 15, tableTop - 4, 10, navy, true)
  const columns = [15, 65, 94, 124, 145, 172], widths = [48, 27, 28, 19, 25, 23]
  const tableHeader = () => {
    doc.setFillColor(navy).rect(15, tableTop, 180, 10, 'F')
    ;['Staff', 'Department', 'Window', 'Served', 'Avg service', 'Completion'].forEach((v, i) => text(v, columns[i] + 2, tableTop + 6, 7, '#ffffff', true))
  }
  tableHeader(); let y = tableTop + 12
  if (!data.staff_summary.length) empty(17, y + 8)
  data.staff_summary.forEach(row => {
    doc.setFont('helvetica', 'normal').setFontSize(7)
    const cells = [row.staff_name, row.department, row.window, row.tickets_served, minutes(row.average_service_time), `${row.completion_rate}%`]
      .map((v, i) => doc.splitTextToSize(String(v), widths[i] - 4))
    const height = Math.max(...cells.map(v => v.length)) * 3.2 + 3
    if (y + height > 263) { newPage('STAFF / WINDOW PERFORMANCE'); tableTop = 47; tableHeader(); y = 59 }
    cells.forEach((v, i) => text(v, columns[i] + 2, y + 4, 7))
    doc.setDrawColor('#e4e9ef').line(15, y + height, 195, y + height); y += height
  })
  return finish()
}
