const TICKET_NUMBER_PATTERN = /(?:[A-Z]+-[PRN]?\d{3,4}|ITMN-\d{4}|ITMP-\d{4})$/i

export function normalizeTicketNumber(ticketNumber) {
  if (ticketNumber === null || ticketNumber === undefined) return ticketNumber
  const rawString = String(ticketNumber).trim().toUpperCase()
  return rawString
    .replace(/^CS-/, 'C-')
    .replace(/^RT-/, 'R-')
    .replace(/^(C|R)-N(?=\d{3}$)/, '$1-R')
}

function findTicketNumberFromObject(obj, visited = new Set()) {
  if (!obj || typeof obj !== 'object' || visited.has(obj)) return null
  visited.add(obj)

  const candidates = [
    obj.ticket_number,
    obj.ticketNumber,
    obj.queue_number,
    obj.number,
    obj.ticket,
    obj.data?.ticket_number,
    obj.data?.ticketNumber,
    obj.data?.ticket,
    obj.attributes?.ticket_number,
    obj.attributes?.ticketNumber,
    obj.attributes?.ticket,
  ]

  for (const value of candidates) {
    if (value === null || value === undefined) continue
    if (typeof value === 'object') {
      const nested = findTicketNumberFromObject(value, visited)
      if (nested) return nested
      continue
    }

    const valueString = String(value).trim()
    if (valueString && TICKET_NUMBER_PATTERN.test(valueString)) {
      return valueString
    }
  }

  for (const value of Object.values(obj)) {
    if (value === null || value === undefined) continue
    if (typeof value === 'object') {
      const nested = findTicketNumberFromObject(value, visited)
      if (nested) return nested
      continue
    }

    const valueString = String(value).trim()
    if (valueString && TICKET_NUMBER_PATTERN.test(valueString)) {
      return valueString
    }
  }

  return null
}

export function getTicketNumber(ticket) {
  if (ticket === null || ticket === undefined) return '—'
  if (typeof ticket === 'string' || typeof ticket === 'number') {
    return normalizeTicketNumber(ticket)
  }

  const rawNumber = findTicketNumberFromObject(ticket)
  if (!rawNumber) return '—'

  return normalizeTicketNumber(rawNumber)
}
