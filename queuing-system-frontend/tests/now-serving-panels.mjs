import assert from 'node:assert/strict'
import { build } from 'esbuild'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'
import { countTicketsThatFit } from '../src/utils/waitingQueueLayout.js'

await build({ entryPoints: ['src/components/DisplayBoard.jsx'], outfile: 'tests/.compiled/NowServing.js', bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', packages: 'external' })
await build({ entryPoints: ['src/utils/displayBoardConfig.js'], outfile: 'tests/.compiled/displayBoardConfig.js', bundle: true, format: 'esm', platform: 'node' })
const { DisplayBoard } = await import('./.compiled/NowServing.js')
const { getColorContrastRatio, getDisplayBoardConfig, saveDisplayBoardConfig } = await import('./.compiled/displayBoardConfig.js')
const makeConfig = (enabledDepartments, windows = []) => ({ settings: { enabledDepartments, flashEnabled: true, showWaitingQueue: true, windowTicketTextColor: '#f0a020' }, windows })
let config = makeConfig(['Cashier', 'Registrar', 'ITM', 'Admission'])
const text = node => typeof node === 'string' ? node : (node.children || []).map(text).join(' ')
const hasBlankTicketArea = panel => (
  !text(panel).includes('No ticket')
  && panel.findAllByProps({ className: 'card-ticket-number' }).length === 0
  && panel.findAllByProps({ className: 'card-category' }).length === 1
  && panel.findAllByProps({ className: 'card-window' }).length === 1
)
let tree
const render = async (tickets, queueTickets = {}) => act(async () => {
  const element = React.createElement(DisplayBoard, { config, servingTickets: tickets, ...queueTickets })
  if (tree) tree.update(element)
  else tree = Renderer.create(element)
})

const panelLabels = () => tree.root.findAllByType('article').map(panel => panel.props['aria-label'])

config = makeConfig(['Registrar'])
await render([])
const registrarLabels = [9, 10, 11, 12, 13].map(number => `REGISTRAR WINDOW ${number}`)
assert.deepEqual(panelLabels(), registrarLabels)
assert(tree.root.findAllByType('article').every(hasBlankTicketArea))
assert(tree.root.findAllByType('article').every(panel => panel.props.style['--card-ticket-text'] === '#f0a020'))

config = makeConfig(['Cashier'])
await render([])
assert.deepEqual(panelLabels(), [1, 2, 3].map(number => `CASHIER WINDOW ${number}`))

config = makeConfig(['ITM'])
const itmTicket = { ticket_id: 20, service_type: 'ITM', window: 1, status: 'serving', ticket_number: 'ITMN-0020', called_at: '2026-09-27T10:00:00Z' }
await render([itmTicket])
let panels = tree.root.findAllByType('article')
assert.deepEqual(panelLabels(), ['ITM WINDOW 1'])
assert(text(panels[0]).includes(itmTicket.ticket_number))
assert(text(panels[0]).replace(/\s+/g, ' ').includes('WINDOW 1'), 'Numbered ITM panel label should be visible without a separator')

config = makeConfig(['Cashier', 'Registrar', 'ITM'])
const numberedLabels = [
  ...[1, 2, 3].map(number => `CASHIER WINDOW ${number}`),
  ...[9, 10, 11, 12, 13].map(number => `REGISTRAR WINDOW ${number}`),
]
const tickets = [
  ...numberedLabels.map((label, index) => ({
    ticket_id: index + 1,
    service_type: index < 3 ? 'CS' : 'RT',
    window: index < 3 ? index + 1 : index + 6,
    status: 'serving',
    ticket_number: `${index < 3 ? 'C' : 'R'}-R${String(321 + index).padStart(3, '0')}`,
    called_at: '2026-09-27T10:00:00Z',
  })),
  itmTicket,
  { ticket_id: 21, service_type: 'ADM', window: 1, status: 'serving', ticket_number: 'ADMN-0021', called_at: '2026-09-27T10:01:00Z' },
]
await render([])
assert.deepEqual(panelLabels(), [...numberedLabels, 'ITM WINDOW 1'], 'ITM has a numbered panel beside service windows')
assert(tree.root.findAllByType('article').every(hasBlankTicketArea))
await render([...tickets].reverse())
panels = tree.root.findAllByType('article')
assert.deepEqual(panelLabels(), [...numberedLabels, 'ITM WINDOW 1'])
panels.slice(0, numberedLabels.length).forEach((panel, index) => {
  assert(text(panel).includes(tickets[index].ticket_number))
  assert.equal(panel.props.style['--card-accent'], index < 3 ? '#2563eb' : '#f2c64b')
})
assert(text(panels.at(-1)).includes(itmTicket.ticket_number))

config = makeConfig(['Cashier', 'Registrar', 'ITM', 'Admission'], [
  { department: 'Admission', windowNumber: 1, visible: true },
  { department: 'ITM', windowNumber: 1, visible: true },
])
await render([
  ...tickets.filter(ticket => !['ITM', 'ADM'].includes(ticket.service_type)),
  { ...itmTicket, window: 2 },
  { ticket_id: 22, service_type: 'ADM', window: 2, status: 'serving', ticket_number: 'ADMN-0022' },
])
panels = tree.root.findAllByType('article')
assert(hasBlankTicketArea(panels.at(-1)), 'empty ITM Window 1 has a blank ticket area and keeps its labels')
assert(!text(panels.at(-1)).includes('ADMN-0022'), 'ITM panel never displays an Admission ticket with the same window number')
assert(hasBlankTicketArea(panels.at(-2)), 'empty Admission Window 1 has a blank ticket area and keeps its labels')
assert(!text(panels.at(-2)).includes('ITMN-0020'), 'Admission panel never displays an ITM ticket with the same window number')

config = makeConfig(['Cashier', 'Registrar', 'ITM', 'Admission'])
await render([...tickets, {
  ticket_id: 30,
  service_type: 'ADM',
  window: 15,
  status: 'serving',
  ticket_number: 'ADMN-0030',
  called_at: '2026-09-27T10:10:00Z',
}])
panels = tree.root.findAllByType('article')
assert.deepEqual(panelLabels(), [...numberedLabels, 'ADMISSION WINDOW 1', 'ITM WINDOW 1'])
assert(text(panels.at(-2)).includes('ADMN-0021'), 'Admission window 1 shows its matching ticket')

config = makeConfig(['Cashier', 'Admission'], [{
  department: 'Admission',
  windowNumber: 15,
  visible: true,
}])
await render([...tickets, {
  ticket_id: 31,
  service_type: 'ADM',
  window: 15,
  status: 'serving',
  ticket_number: 'ADMP-0031',
  called_at: '2026-09-27T10:11:00Z',
}])
panels = tree.root.findAllByType('article')
assert.deepEqual(panelLabels(), ['CASHIER WINDOW 1', 'CASHIER WINDOW 2', 'CASHIER WINDOW 3', 'ADMISSION WINDOW 15'])
assert(text(panels.at(-1)).includes('ADMP-0031'), 'configured Admission window uses its own live ticket')

config = makeConfig(['Cashier', 'Registrar'])
await render([
  ...tickets.slice(1),
  { ...tickets[0], status: 'done' },
  { ...tickets[3], service_type: 'R', ticket_number: 'R-P999', called_at: '2026-09-27T10:05:00Z' },
])
panels = tree.root.findAllByType('article')
assert(hasBlankTicketArea(panels[0]), 'completed or other-department tickets must not occupy Cashier Window 1')
assert(text(panels[3]).includes('R-P999'), 'newest live ticket wins even when alias differs')
assert.equal(panels.length, 8)

const customColors = {
  Cashier: { background: '#112233', text: '#ffffff' },
  Registrar: { background: '#ffffff', text: '#111111' },
  ITM: { background: '#003300', text: '#ffffff' },
  Admission: { background: '#eeeeee', text: '#111111' },
}
const customDisplayTextColors = {
  nowServingTextColor: '#fdfdfd',
  dateTimeTextColor: '#eeeeee',
  waitingQueueColors: { background: '#102030', text: '#ffffff' },
}
config = {
  settings: {
    enabledDepartments: ['Cashier', 'Registrar', 'ITM', 'Admission'],
    panelColors: customColors,
    backgroundColor: '#123456',
    ...customDisplayTextColors,
    accentColor: '#123abc',
    announcementTextColor: '#ffffff',
  },
  windows: [
    { department: 'Admission', windowNumber: 1, visible: true },
    { department: 'ITM', windowNumber: 1, visible: true },
  ],
}
await render([])
panels = tree.root.findAllByType('article')
assert.equal(tree.root.findByType('div').props.style.backgroundColor, '#123456')
assert.equal(tree.root.findByType('div').props.style['--now-serving-text'], customDisplayTextColors.nowServingTextColor)
assert.equal(tree.root.findByType('div').props.style['--date-time-text'], customDisplayTextColors.dateTimeTextColor)
assert.equal(tree.root.findByType('div').props.style['--waiting-queue-background'], customDisplayTextColors.waitingQueueColors.background)
assert.equal(tree.root.findByType('div').props.style['--waiting-queue-text'], customDisplayTextColors.waitingQueueColors.text)
assert.equal(tree.root.findByType('div').props.style['--announcement-background'], '#123abc')
assert.equal(tree.root.findByType('div').props.style['--announcement-text'], '#ffffff')
assert.equal(tree.root.findByType('h2').props.className, 'display-now-serving-title')
assert.equal(panels.find(panel => panel.props['aria-label'] === 'CASHIER WINDOW 1').props.style['--card-background'], customColors.Cashier.background)
assert.equal(panels.find(panel => panel.props['aria-label'] === 'CASHIER WINDOW 1').props.style['--card-text'], customColors.Cashier.text)
assert.equal(panels.find(panel => panel.props['aria-label'] === 'REGISTRAR WINDOW 9').props.style['--card-background'], customColors.Registrar.background)
assert.equal(panels.find(panel => panel.props['aria-label'] === 'ITM WINDOW 1').props.style['--card-text'], customColors.ITM.text)
assert.equal(panels.find(panel => panel.props['aria-label'] === 'ADMISSION WINDOW 1').props.style['--card-background'], customColors.Admission.background)
assert(getColorContrastRatio('#ffffff', '#112233') >= 4.5)
assert(getColorContrastRatio('#777777', '#ffffff') < 4.5)
assert.equal(countTicketsThatFit(Array.from({ length: 4 }, (_, index) => ({ bottom: 40 + index * 40 })), 200), 4)
assert.equal(countTicketsThatFit(Array.from({ length: 6 }, (_, index) => ({ bottom: 40 + index * 40 })), 240), 6)
assert.equal(countTicketsThatFit(Array.from({ length: 10 }, (_, index) => ({ bottom: 40 + index * 40 })), 280, 40), 6)
assert.equal(countTicketsThatFit(Array.from({ length: 15 }, (_, index) => ({ bottom: 40 + index * 40 })), 400, 40), 9)

const waitingConfig = makeConfig(['Cashier', 'Registrar', 'ITM', 'Admission'])
config = { ...waitingConfig, settings: { ...waitingConfig.settings, waitingFontSize: 'large' } }
const waitingByDepartment = Object.fromEntries(['Cashier', 'Registrar', 'ITM', 'Admission'].map(department => [
  `${department.toLowerCase()}Tickets`,
  Array.from({ length: 4 }, (_, index) => ({
    ticket_id: `${department}-${index + 1}`,
    ticket_number: `${department.slice(0, 1)}-R${String(index + 1).padStart(3, '0')}`,
  })),
]))
await render([], waitingByDepartment)
const waitingPanels = tree.root.findAllByType('section')
  .filter(section => section.props.className?.includes('waiting-department'))
assert.equal(waitingPanels.length, 4)
for (const department of ['Cashier', 'Registrar', 'ITM', 'Admission']) {
  const panel = waitingPanels.find(candidate => text(candidate).includes(department.toUpperCase()))
  assert(panel, `${department} has an independent waiting queue panel`)
  assert(panel.findByProps({ className: 'waiting-department-tickets waiting-font-large' }))
  assert.equal((text(panel).match(/waiting/g) || []).length, 1)
  for (let ticketNumber = 1; ticketNumber <= 4; ticketNumber += 1) {
    assert(text(panel).includes(`${department.slice(0, 1)}-R${String(ticketNumber).padStart(3, '0')}`))
  }
  assert(!text(panel).includes('more'), 'a department with only four tickets has no +more indicator')
}

config = {
  settings: {
    enabledDepartments: ['Cashier'],
    showWaitingQueue: false,
    theme: 'light',
    backgroundType: 'gradient',
    backgroundGradient: 'linear-gradient(90deg, #000000, #ffffff)',
    accentColor: '#ff8800',
    queuePosition: 'left',
    animation: 'fade',
    flashEnabled: true,
    flashSpeed: 'fast',
    fontSize: 'large',
    layout: 'compact',
  },
  windows: [],
}
await render([{ ...tickets[0], ticket_id: 901 }])
const board = tree.root.findByType('div')
const activeCard = tree.root.findAllByType('article')[0]
assert(board.props.className.includes('display-theme-light'))
assert(board.props.className.includes('flash-fast'))
assert.equal(board.props.style['--display-accent'], '#f2c64b', 'announcement color does not change general display accents')
assert.equal(board.props.style['--announcement-background'], '#ff8800')
assert.equal(board.props.style['--announcement-text'], '#071b4d')
assert(!board.props.className.includes('layout-'), 'obsolete layout setting no longer affects the board')
assert(!board.props.className.includes('display-font-'), 'obsolete main-card font setting no longer affects the board')
assert.equal(board.props.style.backgroundImage, config.settings.backgroundGradient)
const boardBody = tree.root.find(node => node.props.className?.includes('display-board-body'))
assert(boardBody.props.className.includes('queue-left'))
assert(!tree.root.findAllByType('aside').some(node => node.props.className?.includes('waiting-queue-shell')))
assert(activeCard.props.className.includes('fade'))
assert(activeCard.props.className.includes('window-flash'))
config = {
  ...config,
  settings: {
    ...config.settings,
    backgroundType: 'image',
    backgroundImage: '/uploaded-board-background.png',
  },
}
await render([{ ...tickets[0], ticket_id: 903 }])
assert.equal(tree.root.findByType('div').props.style.backgroundImage, 'url(/uploaded-board-background.png)')
config = { ...config, settings: { ...config.settings, flashEnabled: false } }
await render([{ ...tickets[0], ticket_id: 902 }])
assert(!tree.root.findAllByType('article')[0].props.className.includes('window-flash'))

const savedValues = new Map()
globalThis.window = {
  localStorage: {
    getItem: key => savedValues.get(key) || null,
    setItem: (key, value) => savedValues.set(key, value),
  },
  dispatchEvent: () => true,
}
saveDisplayBoardConfig({
  ...config,
  settings: {
    ...config.settings,
    panelColors: customColors,
    ...customDisplayTextColors,
    accentColor: '#123abc',
    announcementTextColor: '#ffffff',
  },
})
assert.deepEqual(getDisplayBoardConfig().settings.panelColors, customColors, 'service colors persist through the existing display configuration storage')
assert.deepEqual(getDisplayBoardConfig().settings.waitingQueueColors, customDisplayTextColors.waitingQueueColors)
assert.equal(getDisplayBoardConfig().settings.nowServingTextColor, customDisplayTextColors.nowServingTextColor)
assert.equal(getDisplayBoardConfig().settings.dateTimeTextColor, customDisplayTextColors.dateTimeTextColor)
assert.equal(getDisplayBoardConfig().settings.accentColor, '#123abc')
assert.equal(getDisplayBoardConfig().settings.announcementTextColor, '#ffffff')
const normalizedLegacyConfig = saveDisplayBoardConfig({
  windows: [],
  settings: { backgroundType: 'default', animation: 'glow', theme: 'university' },
})
assert.equal(normalizedLegacyConfig.settings.backgroundType, 'solid')
assert.equal(normalizedLegacyConfig.settings.animation, 'pulse')
assert.equal(normalizedLegacyConfig.settings.theme, 'dark')
assert.equal(normalizedLegacyConfig.settings.announcementTextColor, '#071b4d')
delete globalThis.window

await act(async () => tree.unmount())
console.log('PASS department visibility, adaptive panels, live ticket routing, per-service colors, contrast and persistence')
