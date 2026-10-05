import assert from 'node:assert/strict'
import { build } from 'esbuild'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'

// Build AdminPanel and DisplayBoard for node testing
await build({
  entryPoints: ['src/pages/AdminPanel.jsx'],
  outfile: 'tests/.compiled/AdminPanelFontFlow.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  packages: 'external',
})

await build({
  entryPoints: ['src/components/DisplayBoard.jsx'],
  outfile: 'tests/.compiled/DisplayBoardFontFlow.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  packages: 'external',
})

await build({
  entryPoints: ['src/utils/displayBoardConfig.js'],
  outfile: 'tests/.compiled/displayBoardConfigFontFlow.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
})

import { MemoryRouter } from 'react-router-dom'

const { default: AdminPanel } = await import('./.compiled/AdminPanelFontFlow.js')
const { DisplayBoard } = await import('./.compiled/DisplayBoardFontFlow.js')
const {
  DISPLAY_FONT_OPTIONS,
  ELEMENT_FONT_SIZE_OPTIONS,
  ELEMENT_FONT_WEIGHT_OPTIONS,
  DISPLAY_FONT_ELEMENTS,
  DEFAULT_DISPLAY_FONT_CONTROLS,
  getDisplayBoardConfig,
  saveDisplayBoardConfig,
  getDefaultDisplayBoardConfig,
} = await import('./.compiled/displayBoardConfigFontFlow.js')

// Mock window and localStorage
const storage = new Map()
globalThis.window = {
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  },
  sessionStorage: {
    getItem: key => key === 'token' ? 'mock-admin-token' : storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  },
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
}
globalThis.sessionStorage = globalThis.window.sessionStorage
globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelectorAll: () => [],
  head: { append: () => {}, querySelectorAll: () => [] },
  body: { offsetHeight: 1080 },
  fonts: { ready: Promise.resolve() },
}

let lastPublishedBody = null
globalThis.fetch = async (url, options = {}) => {
  if (url.includes('/display-configuration')) {
    if (options.method === 'PUT') {
      const parsed = JSON.parse(options.body)
      lastPublishedBody = parsed
      return {
        ok: true,
        json: async () => ({
          settings: parsed.settings,
          windows: parsed.windows,
        }),
      }
    }
    return {
      ok: true,
      json: async () => ({
        settings: getDisplayBoardConfig().settings,
        windows: getDisplayBoardConfig().windows,
      }),
    }
  }
  return {
    ok: true,
    json: async () => ({}),
  }
}

console.log('Test 1: Verify Display Design panel is removed and font controls are added to Display Text & Labels...')

let adminTree
await act(async () => {
  adminTree = Renderer.create(
    React.createElement(MemoryRouter, null, React.createElement(AdminPanel, { initialPage: 'settings', user: { full_name: 'Admin', role: 'admin' } }))
  )
})

// 1. Verify "Display Design" panel does NOT exist
const designPanels = adminTree.root.findAllByProps({ className: 'settings-card display-typography-settings' })
assert.equal(designPanels.length, 0, 'Display Design panel should be completely removed')

// 2. Verify all 6 font control elements exist in "Display Text & Labels"
const fontControlsGroup = adminTree.root.findByProps({ className: 'display-text-group display-font-controls-group' })
assert.ok(fontControlsGroup, 'Font controls group must exist inside Display Text & Labels')

for (const { label } of DISPLAY_FONT_ELEMENTS) {
  const familySelect = adminTree.root.findByProps({ 'aria-label': `${label} Font Family` })
  const sizeSelect = adminTree.root.findByProps({ 'aria-label': `${label} Font Size` })
  const weightSelect = adminTree.root.findByProps({ 'aria-label': `${label} Font Weight` })

  assert.ok(familySelect, `Font family select for ${label} must exist`)
  assert.ok(sizeSelect, `Font size select for ${label} must exist`)
  assert.ok(weightSelect, `Font weight select for ${label} must exist`)
}

console.log('✓ Display Design panel removed and font controls verified in Display Text & Labels.')

console.log('Test 2: Simulating multiple font changes at once across all 6 text elements...')

// Update multiple font elements at once:
await act(async () => {
  // 1. NOW SERVING: Inter, xlarge, 900
  adminTree.root.findByProps({ 'aria-label': '“NOW SERVING” Heading Font Family' }).props.onChange({ target: { value: 'inter' } })
  adminTree.root.findByProps({ 'aria-label': '“NOW SERVING” Heading Font Size' }).props.onChange({ target: { value: 'xlarge' } })
  adminTree.root.findByProps({ 'aria-label': '“NOW SERVING” Heading Font Weight' }).props.onChange({ target: { value: '900' } })

  // 2. WAITING QUEUE: Trebuchet MS, small, 600
  adminTree.root.findByProps({ 'aria-label': '“WAITING QUEUE” Heading Font Family' }).props.onChange({ target: { value: 'trebuchet' } })
  adminTree.root.findByProps({ 'aria-label': '“WAITING QUEUE” Heading Font Size' }).props.onChange({ target: { value: 'small' } })
  adminTree.root.findByProps({ 'aria-label': '“WAITING QUEUE” Heading Font Weight' }).props.onChange({ target: { value: '600' } })

  // 3. Service Names: Georgia, large, 700
  adminTree.root.findByProps({ 'aria-label': 'Service Names (Cashier, Registrar, ITM, Admission) Font Family' }).props.onChange({ target: { value: 'georgia' } })
  adminTree.root.findByProps({ 'aria-label': 'Service Names (Cashier, Registrar, ITM, Admission) Font Size' }).props.onChange({ target: { value: 'large' } })
  adminTree.root.findByProps({ 'aria-label': 'Service Names (Cashier, Registrar, ITM, Admission) Font Weight' }).props.onChange({ target: { value: '700' } })

  // 4. Window Labels: Arial, medium, 500
  adminTree.root.findByProps({ 'aria-label': 'Window Number Labels Font Family' }).props.onChange({ target: { value: 'arial' } })
  adminTree.root.findByProps({ 'aria-label': 'Window Number Labels Font Size' }).props.onChange({ target: { value: 'medium' } })
  adminTree.root.findByProps({ 'aria-label': 'Window Number Labels Font Weight' }).props.onChange({ target: { value: '500' } })

  // 5. Ticket Numbers: Roboto, large, 800
  adminTree.root.findByProps({ 'aria-label': 'Ticket Numbers Font Family' }).props.onChange({ target: { value: 'roboto' } })
  adminTree.root.findByProps({ 'aria-label': 'Ticket Numbers Font Size' }).props.onChange({ target: { value: 'large' } })
  adminTree.root.findByProps({ 'aria-label': 'Ticket Numbers Font Weight' }).props.onChange({ target: { value: '800' } })

  // 6. Waiting Queue Tickets: Poppins, small, 400
  adminTree.root.findByProps({ 'aria-label': 'Waiting Queue Text & Ticket Numbers Font Family' }).props.onChange({ target: { value: 'poppins' } })
  adminTree.root.findByProps({ 'aria-label': 'Waiting Queue Text & Ticket Numbers Font Size' }).props.onChange({ target: { value: 'small' } })
  adminTree.root.findByProps({ 'aria-label': 'Waiting Queue Text & Ticket Numbers Font Weight' }).props.onChange({ target: { value: '400' } })
})

// Verify status indicates unsaved changes
const statusDiv = adminTree.root.findByProps({ className: 'settings-status' })
assert.equal(statusDiv.children.join(''), 'Unsaved changes')

// Find "Publish to Display" button
const buttons = adminTree.root.findAllByType('button')
const publishBtn = buttons.find(b => {
  const text = typeof b.children[0] === 'string' ? b.children[0] : ''
  return text.includes('Publish to Display')
})
assert.ok(publishBtn, 'Publish to Display button must be present')
assert.equal(publishBtn.props.disabled, false, 'Publish to Display button must be enabled')

console.log('✓ Multiple font changes updated draft state and kept Publish button enabled.')

console.log('Test 3: Publish to Display in one click and verify persistence...')

await act(async () => {
  await publishBtn.props.onClick()
})

assert.equal(statusDiv.children.join(''), 'Display settings published successfully.')
assert.ok(lastPublishedBody, 'API must have received published payload')
assert.ok(lastPublishedBody.settings.fontControls, 'Payload must include fontControls')

// Check that all 6 font settings were published together:
const publishedFonts = lastPublishedBody.settings.fontControls
assert.deepEqual(publishedFonts.nowServing, { fontFamily: 'inter', fontSize: 'xlarge', fontWeight: '900' })
assert.deepEqual(publishedFonts.waitingQueue, { fontFamily: 'trebuchet', fontSize: 'small', fontWeight: '600' })
assert.deepEqual(publishedFonts.serviceNames, { fontFamily: 'georgia', fontSize: 'large', fontWeight: '700' })
assert.deepEqual(publishedFonts.windowLabels, { fontFamily: 'arial', fontSize: 'medium', fontWeight: '500' })
assert.deepEqual(publishedFonts.ticketNumbers, { fontFamily: 'roboto', fontSize: 'large', fontWeight: '800' })
assert.deepEqual(publishedFonts.waitingQueueTickets, { fontFamily: 'poppins', fontSize: 'small', fontWeight: '400' })

// Verify localStorage persistence
const persistedConfig = getDisplayBoardConfig()
assert.deepEqual(persistedConfig.settings.fontControls.nowServing, { fontFamily: 'inter', fontSize: 'xlarge', fontWeight: '900' })
assert.deepEqual(persistedConfig.settings.fontControls.ticketNumbers, { fontFamily: 'roboto', fontSize: 'large', fontWeight: '800' })

console.log('✓ All 6 font settings successfully published and persisted.')

console.log('Test 4: Verify DisplayBoard applies published fonts in styles and CSS variables...')

let boardTree
await act(async () => {
  boardTree = Renderer.create(React.createElement(DisplayBoard, {
    config: persistedConfig,
    servingTickets: [
      { ticket_id: 1, service_type: 'CS', window: 1, status: 'serving', ticket_number: 'C-101' },
    ],
    cashierTickets: [
      { ticket_id: 2, service_type: 'CS', status: 'waiting', ticket_number: 'C-102' },
    ],
  }))
})

// Check root displayStyle variables
const divs = boardTree.root.findAllByType('div')
const boardRoot = divs.find(d => d.props.className && d.props.className.includes('display-page'))
assert.ok(boardRoot, 'boardRoot must exist')
const style = boardRoot.props.style
assert.equal(style['--now-serving-font-family'], DISPLAY_FONT_OPTIONS.inter.family)
assert.equal(style['--now-serving-size-scale'], ELEMENT_FONT_SIZE_OPTIONS.xlarge.scale)
assert.equal(style['--now-serving-font-weight'], '900')

assert.equal(style['--waiting-queue-font-family'], DISPLAY_FONT_OPTIONS.trebuchet.family)
assert.equal(style['--waiting-queue-size-scale'], ELEMENT_FONT_SIZE_OPTIONS.small.scale)
assert.equal(style['--waiting-queue-font-weight'], '600')

assert.equal(style['--service-name-font-family'], DISPLAY_FONT_OPTIONS.georgia.family)
assert.equal(style['--service-name-size-scale'], ELEMENT_FONT_SIZE_OPTIONS.large.scale)
assert.equal(style['--service-name-font-weight'], '700')

assert.equal(style['--window-label-font-family'], DISPLAY_FONT_OPTIONS.arial.family)
assert.equal(style['--window-label-size-scale'], ELEMENT_FONT_SIZE_OPTIONS.medium.scale)
assert.equal(style['--window-label-font-weight'], '500')

assert.equal(style['--ticket-number-font-family'], DISPLAY_FONT_OPTIONS.roboto.family)
assert.equal(style['--ticket-number-size-scale'], ELEMENT_FONT_SIZE_OPTIONS.large.scale)
assert.equal(style['--ticket-number-font-weight'], '800')

assert.equal(style['--waiting-tickets-font-family'], DISPLAY_FONT_OPTIONS.poppins.family)
assert.equal(style['--waiting-tickets-size-scale'], ELEMENT_FONT_SIZE_OPTIONS.small.scale)
assert.equal(style['--waiting-tickets-font-weight'], '400')

// Verify elements directly
const nowServingTitle = boardTree.root.findByProps({ className: 'display-now-serving-title' })
assert.equal(nowServingTitle.props.style.fontFamily, DISPLAY_FONT_OPTIONS.inter.family)
assert.equal(nowServingTitle.props.style.fontWeight, '900')

const waitingQueueTitle = boardTree.root.findByProps({ className: 'panel-title display-waiting-queue-title' })
assert.equal(waitingQueueTitle.props.style.fontFamily, DISPLAY_FONT_OPTIONS.trebuchet.family)
assert.equal(waitingQueueTitle.props.style.fontWeight, '600')

const categoryEls = boardTree.root.findAllByProps({ className: 'card-category' })
assert.ok(categoryEls.length > 0)
assert.ok(categoryEls.every(el => el.props.style.fontFamily === DISPLAY_FONT_OPTIONS.georgia.family))
assert.ok(categoryEls.every(el => el.props.style.fontWeight === '700'))

const windowEls = boardTree.root.findAllByProps({ className: 'card-window' })
assert.ok(windowEls.length > 0)
assert.ok(windowEls.every(el => el.props.style.fontFamily === DISPLAY_FONT_OPTIONS.arial.family))
assert.ok(windowEls.every(el => el.props.style.fontWeight === '500'))

const ticketNumEls = boardTree.root.findAllByProps({ className: 'card-ticket-number' })
assert.ok(ticketNumEls.length > 0)
assert.ok(ticketNumEls.every(el => el.props.style.fontFamily === DISPLAY_FONT_OPTIONS.roboto.family))
assert.ok(ticketNumEls.every(el => el.props.style.fontWeight === '800'))

console.log('✓ DisplayBoard font styles and CSS variables verified matching published settings.')

console.log('ALL FONT CONTROLS AND PUBLISH FLOW TESTS PASSED!')
process.exit(0)
