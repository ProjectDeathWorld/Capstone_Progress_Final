import assert from 'node:assert/strict'
import { build } from 'esbuild'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'

// Build fresh ESM bundles of the components
await build({
  entryPoints: ['src/components/DisplayBoard.jsx'],
  outfile: 'tests/.compiled/DisplayBoardTicketTest.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  packages: 'external',
})

await build({
  entryPoints: ['src/utils/displayBoardConfig.js'],
  outfile: 'tests/.compiled/displayBoardConfigTicketTest.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
})

const { DisplayBoard } = await import('./.compiled/DisplayBoardTicketTest.js')
const {
  DISPLAY_FONT_OPTIONS,
  ELEMENT_FONT_SIZE_OPTIONS,
  ELEMENT_FONT_WEIGHT_OPTIONS,
  getDefaultDisplayBoardConfig,
  getDisplayBoardConfig,
  saveDisplayBoardConfig,
} = await import('./.compiled/displayBoardConfigTicketTest.js')

console.log('--- Test 1: Screenshot scenario (8 panels: Cashier 1-3, Registrar 9-13) ---')

const baseConfig = getDefaultDisplayBoardConfig()
baseConfig.settings.enabledDepartments = ['Cashier', 'Registrar']
// 8 windows: Cashier 1, 2, 3 and Registrar 9, 10, 11, 12, 13
baseConfig.windows = [
  ...[1, 2, 3].map(n => ({ id: `w-${n}`, windowNumber: n, department: 'Cashier', visible: true })),
  ...[9, 10, 11, 12, 13].map(n => ({ id: `w-${n}`, windowNumber: n, department: 'Registrar', visible: true })),
]

const servingTickets = [
  { ticket_id: 101, service_type: 'CS', window: 2, status: 'serving', ticket_number: 'C-P004' },
  { ticket_id: 102, service_type: 'RT', window: 13, status: 'serving', ticket_number: 'R-P005' },
]

let tree
await act(async () => {
  tree = Renderer.create(React.createElement(DisplayBoard, {
    config: baseConfig,
    servingTickets,
    cashierTickets: [
      { ticket_id: 201, service_type: 'CS', status: 'waiting', ticket_number: 'C-P005' },
      { ticket_id: 202, service_type: 'CS', status: 'waiting', ticket_number: 'C-P006' },
    ],
    registrarTickets: [
      { ticket_id: 301, service_type: 'RT', status: 'waiting', ticket_number: 'R-P004' },
      { ticket_id: 302, service_type: 'RT', status: 'waiting', ticket_number: 'R-P006' },
    ],
  }))
})

// Find cards
const articles = tree.root.findAllByType('article')
assert.equal(articles.length, 8, 'Must have 8 panels rendered')

// Find ticket number elements
const ticketNumberContainers = tree.root.findAllByProps({ className: 'card-ticket-number' })
assert.equal(ticketNumberContainers.length, 2, 'Exactly 2 serving tickets must be rendered')

// Check window 2 ticket
const ticketW2 = ticketNumberContainers[0]
const textW2 = ticketW2.children.map(c => typeof c === 'string' ? c : c.children.join('')).join('')
assert.equal(textW2, 'C-P004', 'Window 2 must render full ticket number preserving prefix and leading zeros')
assert.equal(ticketW2.props.style['--ticket-len'], 6, 'Ticket length must be 6')
assert.equal(ticketW2.props.style['--ticket-cqw'], `${(80 / 6).toFixed(2)}cqw`, 'Computed cqw variable must match 80/6')

// Check window 13 ticket
const ticketW13 = ticketNumberContainers[1]
const textW13 = ticketW13.children.map(c => typeof c === 'string' ? c : c.children.join('')).join('')
assert.equal(textW13, 'R-P005', 'Window 13 must render full ticket number preserving prefix and leading zeros')
assert.equal(ticketW13.props.style['--ticket-len'], 6)

// Check inner text element
const textSpans = tree.root.findAllByProps({ className: 'card-ticket-text' })
assert.equal(textSpans.length, 2, 'Inner card-ticket-text spans must be present for clean single-line containment')
assert.equal(textSpans[0].children[0], 'C-P004')
assert.equal(textSpans[1].children[0], 'R-P005')

console.log('✓ Screenshot scenario passes: prefixes and leading zeros intact, 8 panels rendered cleanly.')

console.log('--- Test 2: All windows visible (12 panels: Cashier, Registrar, ITM, Admission) ---')

const allDeptsConfig = getDefaultDisplayBoardConfig()
allDeptsConfig.settings.enabledDepartments = ['Cashier', 'Registrar', 'ITM', 'Admission']
allDeptsConfig.windows = [
  ...[1, 2, 3].map(n => ({ id: `w-c-${n}`, windowNumber: n, department: 'Cashier', visible: true })),
  ...[9, 10, 11, 12, 13].map(n => ({ id: `w-r-${n}`, windowNumber: n, department: 'Registrar', visible: true })),
  ...[1, 2, 3].map(n => ({ id: `w-i-${n}`, windowNumber: n, department: 'ITM', visible: true })),
  { id: 'w-a-1', windowNumber: 1, department: 'Admission', visible: true },
]

const allServingTickets = [
  { ticket_id: 1, service_type: 'CS', window: 1, status: 'serving', ticket_number: 'C-001' },
  { ticket_id: 2, service_type: 'RT', window: 9, status: 'serving', ticket_number: 'R-P001' },
  { ticket_id: 3, service_type: 'ITM', window: 1, status: 'serving', ticket_number: 'ITMN-0001' },
  { ticket_id: 4, service_type: 'ADM', window: 1, status: 'serving', ticket_number: 'ADMN-0001' },
]

await act(async () => {
  tree.update(React.createElement(DisplayBoard, {
    config: allDeptsConfig,
    servingTickets: allServingTickets,
  }))
})

const allArticles = tree.root.findAllByType('article')
assert.equal(allArticles.length, 12, 'Must render 12 panels when all windows are configured')

const allTicketContainers = tree.root.findAllByProps({ className: 'card-ticket-number' })
assert.equal(allTicketContainers.length, 4, 'Must render 4 serving tickets across the 12 panels')

const itmContainer = allTicketContainers.find(c => {
  const t = c.children.map(ch => typeof ch === 'string' ? ch : ch.children.join('')).join('')
  return t.includes('ITMN-0001')
})
assert.ok(itmContainer, 'ITMN-0001 ticket must be rendered in its window')
assert.equal(itmContainer.props.style['--ticket-len'], 9, 'ITMN-0001 length is 9')
assert.equal(itmContainer.props.style['--ticket-cqw'], `${(80 / 9).toFixed(2)}cqw`)

console.log('✓ All 12 windows layout verified with long ticket numbers.')

console.log('--- Test 3: Fewer active departments (1 panel, 3 panels, 5 panels) ---')

// 1 panel: only Admission with 1 window
const singleConfig = getDefaultDisplayBoardConfig()
singleConfig.settings.enabledDepartments = ['Admission']
singleConfig.windows = [{ id: 'w-adm-1', windowNumber: 1, department: 'Admission', visible: true }]

await act(async () => {
  tree.update(React.createElement(DisplayBoard, {
    config: singleConfig,
    servingTickets: [{ ticket_id: 10, service_type: 'ADM', window: 1, status: 'serving', ticket_number: 'A-001' }],
  }))
})

const singlePanel = tree.root.findAllByType('article')
assert.equal(singlePanel.length, 1, '1 panel layout rendered')
const singleTicket = tree.root.findByProps({ className: 'card-ticket-number' })
assert.equal(singleTicket.props.style['--ticket-len'], 5)
assert.equal(singleTicket.props.style['--ticket-cqw'], `${(80 / 5).toFixed(2)}cqw`)

// 3 panels: Cashier only
const cashierOnlyConfig = getDefaultDisplayBoardConfig()
cashierOnlyConfig.settings.enabledDepartments = ['Cashier']
cashierOnlyConfig.windows = [1, 2, 3].map(n => ({ id: `w-${n}`, windowNumber: n, department: 'Cashier', visible: true }))

await act(async () => {
  tree.update(React.createElement(DisplayBoard, {
    config: cashierOnlyConfig,
    servingTickets: [{ ticket_id: 11, service_type: 'CS', window: 3, status: 'serving', ticket_number: 'C-P003' }],
  }))
})

const cashierPanels = tree.root.findAllByType('article')
assert.equal(cashierPanels.length, 3, '3 panels layout rendered')

// 5 panels: Registrar only
const regOnlyConfig = getDefaultDisplayBoardConfig()
regOnlyConfig.settings.enabledDepartments = ['Registrar']
regOnlyConfig.windows = [9, 10, 11, 12, 13].map(n => ({ id: `w-${n}`, windowNumber: n, department: 'Registrar', visible: true }))

await act(async () => {
  tree.update(React.createElement(DisplayBoard, {
    config: regOnlyConfig,
    servingTickets: [{ ticket_id: 12, service_type: 'RT', window: 10, status: 'serving', ticket_number: 'R-0042' }],
  }))
})

const regPanels = tree.root.findAllByType('article')
assert.equal(regPanels.length, 5, '5 panels layout rendered')

console.log('✓ Fewer active departments (1, 3, 5 panels) rendered cleanly.')

console.log('--- Test 4: Font customization responsiveness across all sizes and weights ---')

for (const [sizeKey, sizeOpt] of Object.entries(ELEMENT_FONT_SIZE_OPTIONS)) {
  for (const [weightKey, weightOpt] of Object.entries(ELEMENT_FONT_WEIGHT_OPTIONS)) {
    const customConfig = getDefaultDisplayBoardConfig()
    customConfig.settings.fontControls = {
      ...customConfig.settings.fontControls,
      ticketNumbers: {
        fontFamily: 'roboto',
        fontSize: sizeKey,
        fontWeight: weightOpt.value,
      },
    }
    customConfig.settings.enabledDepartments = ['Cashier']
    customConfig.windows = [{ id: 'w-1', windowNumber: 1, department: 'Cashier', visible: true }]

    await act(async () => {
      tree.update(React.createElement(DisplayBoard, {
        config: customConfig,
        servingTickets: [{ ticket_id: 99, service_type: 'CS', window: 1, status: 'serving', ticket_number: 'C-P004' }],
      }))
    })

    const rootDiv = tree.root.findAllByType('div').find(d => d.props.className && d.props.className.includes('display-page'))
    assert.equal(rootDiv.props.style['--ticket-number-font-family'], DISPLAY_FONT_OPTIONS.roboto.family)
    assert.equal(rootDiv.props.style['--ticket-number-size-scale'], sizeOpt.scale)
    assert.equal(rootDiv.props.style['--ticket-number-font-weight'], weightOpt.value)

    const ticketEl = tree.root.findByProps({ className: 'card-ticket-number' })
    assert.equal(ticketEl.props.style.fontFamily, DISPLAY_FONT_OPTIONS.roboto.family)
    assert.equal(ticketEl.props.style.fontWeight, weightOpt.value)
  }
}

console.log('✓ Font customization works across all size scales (small, medium, large, xlarge) and weights (400-900).')

console.log('ALL TICKET APPEARANCE TESTS PASSED!')
process.exit(0)
