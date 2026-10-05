import { getTicketNumber } from './queueNumber'
import { departmentFor } from './departments'

/**
 * Resolve the uppercase department label according to requirements:
 * CASHIER (for Cashier / Accounting), REGISTRAR, ITM, ADMISSION
 */
export function getPrintDepartment(ticket, fallbackService = null) {
  const serviceType = ticket?.service_type || fallbackService || ''
  const deptObj = departmentFor(serviceType)
  const deptName = deptObj?.name || ''
  const normDept = deptName.trim().toUpperCase()

  if (normDept === 'CASHIER' || normDept === 'ACCOUNTING') {
    return 'CASHIER'
  }
  if (normDept === 'REGISTRAR') {
    return 'REGISTRAR'
  }
  if (normDept === 'ITM') {
    return 'ITM'
  }
  if (normDept === 'ADMISSION' || normDept === 'ASSESSMENT') {
    return 'ADMISSION'
  }

  // Fallback checks from ticket number prefix
  const tNum = String(ticket?.ticket_number || '').trim().toUpperCase()
  if (tNum.startsWith('C-') || tNum.startsWith('CS-')) return 'CASHIER'
  if (tNum.startsWith('R-') || tNum.startsWith('RT-')) return 'REGISTRAR'
  if (tNum.startsWith('ITM')) return 'ITM'
  if (tNum.startsWith('ADM-') || tNum.startsWith('A-')) return 'ADMISSION'

  return 'CASHIER'
}

/**
 * Format date as MM/DD/YYYY (e.g., 10/05/2026)
 */
export function formatPrintDate(dateValue) {
  const d = dateValue ? new Date(dateValue) : new Date()
  if (isNaN(d.getTime())) {
    const today = new Date()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const yyyy = today.getFullYear()
    return `${mm}/${dd}/${yyyy}`
  }
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

/**
 * Generates clean, standalone 58mm thermal printable HTML for Xprinter-58IIB.
 * Content strictly matches the requested format:
 *   LYCEUM OF ALABANG
 *   [DEPARTMENT]
 *   QUEUE NUMBER
 *   [Ticket Number]
 *   Date: [Date]
 */
export function generateThermalTicketHtml(ticket, options = {}) {
  const department = getPrintDepartment(ticket, options.fallbackService)
  const ticketNumber = getTicketNumber(ticket) || ticket?.ticket_number || '—'
  const dateStr = formatPrintDate(ticket?.created_at || options.date || new Date())

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>LYCEUM OF ALABANG - Ticket ${ticketNumber}</title>
  <style>
    @page {
      size: 58mm auto;
      margin: 0;
    }
    @media print {
      html, body {
        width: 58mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      width: 48mm;
      max-width: 48mm;
      margin: 0 auto;
      padding: 5mm 1mm 16mm 1mm;
      text-align: center;
      font-family: 'Courier New', Courier, Consolas, monospace, sans-serif;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .ticket-header {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 0.5px;
      line-height: 1.25;
      margin-bottom: 14px;
      text-transform: uppercase;
    }
    .ticket-department {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 1px;
      margin-bottom: 14px;
      text-transform: uppercase;
    }
    .ticket-queue-label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .ticket-number {
      font-size: 32px;
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: 1px;
      margin-bottom: 14px;
      word-break: break-all;
    }
    .ticket-date {
      font-size: 11px;
      font-weight: 600;
      margin-top: 4px;
      margin-bottom: 14px;
    }
    .ticket-spacer {
      height: 14mm;
      display: block;
      content: "";
    }
  </style>
</head>
<body>
  <div class="ticket-header">LYCEUM OF ALABANG</div>
  <div class="ticket-department">${department}</div>
  <div class="ticket-queue-label">QUEUE NUMBER</div>
  <div class="ticket-number">${ticketNumber}</div>
  <div class="ticket-date">Date: ${dateStr}</div>
  <div class="ticket-spacer"></div>
</body>
</html>`
}

/**
 * Print a ticket using an isolated invisible iframe to avoid disrupting kiosk UI.
 * Suitable for Xprinter-58IIB (USB) on kiosk computers.
 * Supports silent printing with Chrome/Edge flag --kiosk-printing.
 */
export async function printThermalTicket(ticket, options = {}) {
  if (!ticket) {
    return { success: false, error: 'No ticket provided' }
  }

  return new Promise((resolve) => {
    try {
      const html = generateThermalTicketHtml(ticket, options)
      let iframe = document.getElementById('kiosk-thermal-print-frame')

      if (!iframe) {
        iframe = document.createElement('iframe')
        iframe.id = 'kiosk-thermal-print-frame'
        iframe.style.position = 'fixed'
        iframe.style.right = '100%'
        iframe.style.bottom = '100%'
        iframe.style.width = '0px'
        iframe.style.height = '0px'
        iframe.style.border = '0px'
        iframe.style.opacity = '0'
        iframe.style.pointerEvents = 'none'
        document.body.appendChild(iframe)
      }

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument
      if (!frameDoc) {
        resolve({ success: false, error: 'Unable to access print frame' })
        return
      }

      frameDoc.open()
      frameDoc.write(html)
      frameDoc.close()

      let hasPrinted = false
      const triggerPrint = () => {
        if (hasPrinted) return
        hasPrinted = true

        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
          resolve({ success: true })
        } catch (printErr) {
          console.warn('Thermal print exception:', printErr)
          resolve({ success: false, error: printErr?.message || 'Print error' })
        }
      }

      // Allow DOM to settle before calling print
      if (iframe.contentWindow?.document?.readyState === 'complete') {
        setTimeout(triggerPrint, 150)
      } else {
        iframe.onload = () => setTimeout(triggerPrint, 150)
        // Fallback timeout in case onload doesn't fire
        setTimeout(triggerPrint, 350)
      }
    } catch (err) {
      console.warn('Failed to dispatch thermal ticket print:', err)
      resolve({ success: false, error: err?.message || 'Printer unavailable' })
    }
  })
}
