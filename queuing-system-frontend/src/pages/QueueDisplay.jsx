import { departmentFor, enabledDepartments } from '../utils/departments'
import FullscreenDisplayViewport from '../components/FullscreenDisplayViewport'
import { useState, useEffect } from 'react'
import { getDisplayConfiguration } from '../api'
import { useDisplayBoardData } from '../hooks/useDisplayBoardData'
import { announceTicket, initializeVoices } from '../utils/voiceAnnouncement'
import { getDefaultDisplayBoardConfig, getDisplayBoardConfig, saveDisplayBoardConfig } from '../utils/displayBoardConfig'
import { getTicketNumber } from '../utils/queueNumber'

export { DisplayBoard } from '../components/DisplayBoard'

function QueueDisplay() {
  const { cashierTickets, registrarTickets, itmTickets, admissionTickets, servingTickets } = useDisplayBoardData()
  const [announcedTickets, setAnnouncedTickets] = useState(new Set())
  const [displayConfig, setDisplayConfig] = useState(() => getDisplayBoardConfig())
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    initializeVoices()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let active = true
    const syncConfig = async () => {
      try {
        const data = await getDisplayConfiguration()
        if (!active) return
        const defaults = getDefaultDisplayBoardConfig()
        const published = {
          settings: { ...defaults.settings, ...(data?.settings || {}) },
          windows: Array.isArray(data?.windows) && data.windows.length ? data.windows : defaults.windows.map((window) => ({ ...window, staffName: '' })),
        }
        setDisplayConfig(saveDisplayBoardConfig(published))
      } catch (err) {
        if (active) setDisplayConfig(getDisplayBoardConfig())
      }
    }
    syncConfig()
    const interval = setInterval(syncConfig, 5000)

    const handleLocalUpdate = () => {
      if (active) {
        setDisplayConfig(getDisplayBoardConfig())
      }
    }
    window.addEventListener('storage', handleLocalUpdate)
    window.addEventListener('display-board-config-updated', handleLocalUpdate)

    return () => {
      active = false
      clearInterval(interval)
      window.removeEventListener('storage', handleLocalUpdate)
      window.removeEventListener('display-board-config-updated', handleLocalUpdate)
    }
  }, [])

  useEffect(() => {
    if (!displayConfig.settings.voiceEnabled) return

    servingTickets.filter(ticket => enabledDepartments(displayConfig.settings).includes(departmentFor(ticket.service_type)?.name)).forEach((ticket) => {
      const normalizedTicketNumber = getTicketNumber(ticket)
      if (!announcedTickets.has(normalizedTicketNumber)) {
        const windowNum = ticket.window ? ticket.window.toString() : '1'
        const position = ticket.service_type === 'ADM' ? 'admission' : ticket.service_type === 'ITM'
          ? 'itm'
          : ticket.service_type === 'C' || ticket.service_type === 'CS' ? 'cashier' : 'registrar'
        announceTicket(normalizedTicketNumber, windowNum, position, {
          language: displayConfig.settings.voiceLanguage,
          speed: displayConfig.settings.voiceSpeed,
          volume: displayConfig.settings.voiceVolume,
        })
        setAnnouncedTickets((prev) => new Set([...prev, normalizedTicketNumber]))
      }
    })
  }, [servingTickets, announcedTickets, displayConfig.settings.voiceEnabled, displayConfig.settings.voiceLanguage, displayConfig.settings.voiceSpeed, displayConfig.settings.voiceVolume])

  useEffect(() => {
    if (servingTickets.length === 0) {
      setAnnouncedTickets(new Set())
    }
  }, [servingTickets.length])

  return (
    <FullscreenDisplayViewport
      config={displayConfig}
      currentTime={currentTime}
      cashierTickets={cashierTickets}
      registrarTickets={registrarTickets}
      itmTickets={itmTickets}
      admissionTickets={admissionTickets}
      servingTickets={servingTickets}
    />
  )
}

export default QueueDisplay
