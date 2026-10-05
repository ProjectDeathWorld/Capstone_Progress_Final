import { useAdminPolling } from './useAdminPolling'
import { useCallback, useState } from 'react'
import { getServingTickets, getWaitingTickets } from '../api'

export function useDisplayBoardData(enabled = true) {
  const [cashierTickets, setCashierTickets] = useState([])
  const [registrarTickets, setRegistrarTickets] = useState([])
  const [itmTickets, setItmTickets] = useState([])
  const [admissionTickets, setAdmissionTickets] = useState([])
  const [servingTickets, setServingTickets] = useState([])
  const [lastUpdatedAt, setLastUpdatedAt] = useState(Date.now())

  const refresh = useCallback(async (signal) => {
    const results = await Promise.allSettled([
      getWaitingTickets('CS', null, null, signal),
      getWaitingTickets('RT', null, null, signal),
      getWaitingTickets('ITM', null, null, signal),
      getServingTickets(null, signal),
      getWaitingTickets('ADM', null, null, signal),
    ])

    if (signal?.aborted) return

    const applyTicketResult = (result, setter, label) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        setter(result.value)
        return
      }

      // Keep the last successful list on screen during a temporary backend or
      // proxy failure instead of blanking the entire display board.
      console.error(`Failed to refresh ${label} display tickets`, result.status === 'rejected' ? result.reason : result.value)
    }

    applyTicketResult(results[0], setCashierTickets, 'cashier waiting')
    applyTicketResult(results[1], setRegistrarTickets, 'registrar waiting')
    applyTicketResult(results[2], setItmTickets, 'ITM waiting')
    applyTicketResult(results[3], setServingTickets, 'serving')
    applyTicketResult(results[4], setAdmissionTickets, 'Admission waiting')
    setLastUpdatedAt(Date.now())
  }, [])

  useAdminPolling(refresh, 'display-preview', enabled, 2000)

  return {
    cashierTickets,
    registrarTickets,
    itmTickets,
    admissionTickets,
    servingTickets,
    refresh,
    lastUpdatedAt,
  }
}
