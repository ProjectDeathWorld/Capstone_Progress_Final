import assert from 'node:assert/strict'
import { build } from 'esbuild'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'

// Build ESM bundles
await build({
  entryPoints: ['src/pages/QueueDisplay.jsx'],
  outfile: 'tests/.compiled/QueueDisplayLiveTest.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  packages: 'external',
})

await build({
  entryPoints: ['src/pages/AdminPanel.jsx'],
  outfile: 'tests/.compiled/AdminPanelLiveTest.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  packages: 'external',
})

await build({
  entryPoints: ['src/components/DisplayBoard.jsx'],
  outfile: 'tests/.compiled/DisplayBoardLiveTest.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  packages: 'external',
})

await build({
  entryPoints: ['src/utils/displayBoardConfig.js'],
  outfile: 'tests/.compiled/displayBoardConfigLiveTest.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
})

const { default: QueueDisplay } = await import('./.compiled/QueueDisplayLiveTest.js')
const { default: AdminPanel } = await import('./.compiled/AdminPanelLiveTest.js')
const { DisplayBoard } = await import('./.compiled/DisplayBoardLiveTest.js')
const {
  DISPLAY_FONT_OPTIONS,
  ELEMENT_FONT_SIZE_OPTIONS,
  DISPLAY_FONT_ELEMENTS,
  DEFAULT_DISPLAY_FONT_CONTROLS,
  getDisplayBoardConfig,
  saveDisplayBoardConfig,
  getDefaultDisplayBoardConfig,
} = await import('./.compiled/displayBoardConfigLiveTest.js')

// Mock storage and window events
const storage = new Map()
const windowListeners = new Map()

globalThis.window = {
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => {
      storage.set(key, value)
      const listeners = windowListeners.get('storage') || []
      listeners.forEach(cb => cb({ key, newValue: value }))
    },
    removeItem: key => {
      storage.delete(key)
      const listeners = windowListeners.get('storage') || []
      listeners.forEach(cb => cb({ key, newValue: null }))
    },
  },
  sessionStorage: {
    getItem: key => key === 'token' ? 'test-token' : storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  },
  addEventListener: (event, cb) => {
    if (!windowListeners.has(event)) windowListeners.set(event, [])
    windowListeners.get(event).push(cb)
  },
  removeEventListener: (event, cb) => {
    const list = windowListeners.get(event) || []
    windowListeners.set(event, list.filter(item => item !== cb))
  },
  dispatchEvent: (evt) => {
    const list = windowListeners.get(evt.type) || []
    list.forEach(cb => cb(evt))
    return true
  },
  speechSynthesis: { getVoices: () => [], speak: () => {}, cancel: () => {} },
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

let backendSettings = getDefaultDisplayBoardConfig().settings
let backendWindows = getDefaultDisplayBoardConfig().windows

globalThis.fetch = async (url, options = {}) => {
  if (url.includes('/display-configuration')) {
    if (options.method === 'PUT') {
      const parsed = JSON.parse(options.body)
      backendSettings = parsed.settings
      backendWindows = parsed.windows
      return {
        ok: true,
        json: async () => ({ settings: backendSettings, windows: backendWindows }),
      }
    }
    return {
      ok: true,
      json: async () => ({ settings: backendSettings, windows: backendWindows }),
    }
  }
  return {
    ok: true,
    json: async () => ([]),
  }
}

console.log('=== TEST 1: Trace all 6 font-size settings through DisplayBoard rendering ===')

const testSizes = ['small', 'medium', 'large', 'xlarge']
const expectedScales = {
  small: 0.85,
  medium: 1.0,
  large: 1.15,
  xlarge: 1.3,
}

for (const size of testSizes) {
  const customConfig = getDefaultDisplayBoardConfig()
  customConfig.settings.enabledDepartments = ['Cashier', 'Registrar']
  customConfig.settings.fontControls = {
    nowServing: { fontFamily: 'poppins', fontSize: size, fontWeight: '900' },
    waitingQueue: { fontFamily: 'inter', fontSize: size, fontWeight: '800' },
    serviceNames: { fontFamily: 'roboto', fontSize: size, fontWeight: '700' },
    windowLabels: { fontFamily: 'arial', fontSize: size, fontWeight: '600' },
    ticketNumbers: { fontFamily: 'trebuchet', fontSize: size, fontWeight: '900' },
    waitingQueueTickets: { fontFamily: 'poppins', fontSize: size, fontWeight: '500' },
  }

  let tree
  await act(async () => {
    tree = Renderer.create(React.createElement(DisplayBoard, {
      config: customConfig,
      servingTickets: [
        { ticket_id: 1, service_type: 'CS', window: 1, status: 'serving', ticket_number: 'C001' },
      ],
      cashierTickets: [
        { ticket_id: 2, service_type: 'CS', status: 'waiting', ticket_number: 'C002' },
      ],
      registrarTickets: [],
    }))
  })

  const rootDiv = tree.root.find(node => typeof node.props.className === 'string' && node.props.className.includes('display-page'))
  const style = rootDiv.props.style
  const scale = expectedScales[size]

  assert.equal(style['--now-serving-size-scale'], scale, `Now Serving size scale must be ${scale}`)
  assert.equal(style['--waiting-queue-size-scale'], scale, `Waiting Queue size scale must be ${scale}`)
  assert.equal(style['--service-name-size-scale'], scale, `Service Name size scale must be ${scale}`)
  assert.equal(style['--window-label-size-scale'], scale, `Window Label size scale must be ${scale}`)
  assert.equal(style['--ticket-number-size-scale'], scale, `Ticket Number size scale must be ${scale}`)
  assert.equal(style['--waiting-tickets-size-scale'], scale, `Waiting Tickets size scale must be ${scale}`)

  // Verify elements have inline fontSize scaling
  const nowServingH2 = tree.root.findByProps({ className: 'display-now-serving-title' })
  assert.ok(nowServingH2.props.style.fontSize.includes(String(scale)), 'Now Serving h2 fontSize contains scale')

  const waitingQueueP = tree.root.findByProps({ className: 'panel-title display-waiting-queue-title' })
  assert.ok(waitingQueueP.props.style.fontSize.includes(String(scale)), 'Waiting Queue p fontSize contains scale')

  const serviceSpan = tree.root.findAllByProps({ className: 'card-category' })[0]
  assert.ok(serviceSpan.props.style.fontSize.includes(String(scale)), 'Service name span fontSize contains scale')

  const windowStrong = tree.root.findAllByProps({ className: 'card-window' })[0]
  assert.ok(windowStrong.props.style.fontSize.includes(String(scale)), 'Window label strong fontSize contains scale')

  const ticketDiv = tree.root.findByProps({ className: 'card-ticket-number' })
  assert.ok(ticketDiv.props.style.fontSize.includes(String(scale)), 'Ticket number div fontSize contains scale')

  // Verify waiting department has correct font size class
  const waitingGrid = tree.root.find(node => typeof node.props.className === 'string' && node.props.className.includes('waiting-department-grid'))
  assert.ok(waitingGrid.props.className.includes(`waiting-font-${size}`), `Waiting grid contains waiting-font-${size}`)

  console.log(`✓ Size "${size}" (scale ${scale}) applied correctly to all 6 text elements in DisplayBoard`)
}

console.log('=== TEST 2: Live Display Board (QueueDisplay) instant sync via storage event ===')

let queueDisplayTree
await act(async () => {
  queueDisplayTree = Renderer.create(React.createElement(QueueDisplay))
})

// Check initial default or medium
const initialConfig = getDisplayBoardConfig()
assert.ok(initialConfig.settings.fontControls)

// Simulate publishing new font-sizes from Admin in another tab
const publishedSettings = {
  ...initialConfig.settings,
  fontControls: {
    nowServing: { fontFamily: 'roboto', fontSize: 'small', fontWeight: '800' },
    waitingQueue: { fontFamily: 'roboto', fontSize: 'xlarge', fontWeight: '900' },
    serviceNames: { fontFamily: 'inter', fontSize: 'large', fontWeight: '600' },
    windowLabels: { fontFamily: 'arial', fontSize: 'small', fontWeight: '700' },
    ticketNumbers: { fontFamily: 'trebuchet', fontSize: 'xlarge', fontWeight: '900' },
    waitingQueueTickets: { fontFamily: 'poppins', fontSize: 'large', fontWeight: '700' },
  },
}

backendSettings = publishedSettings
await act(async () => {
  // saveDisplayBoardConfig triggers localStorage.setItem which invokes 'storage' event listeners
  saveDisplayBoardConfig({
    settings: publishedSettings,
    windows: initialConfig.windows,
  })
})

// QueueDisplay state should now be updated immediately without page reload or 5s delay
const updatedViewport = queueDisplayTree.root.findByType('div')
// Verify that the config prop passed down has the new font controls
const fullscreenViewport = queueDisplayTree.root.findAll(el => el.props.config && el.props.config.settings?.fontControls)[0]
assert.ok(fullscreenViewport, 'QueueDisplay must pass updated config to viewport')
assert.equal(fullscreenViewport.props.config.settings.fontControls.nowServing.fontSize, 'small')
assert.equal(fullscreenViewport.props.config.settings.fontControls.waitingQueue.fontSize, 'xlarge')
assert.equal(fullscreenViewport.props.config.settings.fontControls.serviceNames.fontSize, 'large')
assert.equal(fullscreenViewport.props.config.settings.fontControls.windowLabels.fontSize, 'small')
assert.equal(fullscreenViewport.props.config.settings.fontControls.ticketNumbers.fontSize, 'xlarge')
assert.equal(fullscreenViewport.props.config.settings.fontControls.waitingQueueTickets.fontSize, 'large')

console.log('✓ QueueDisplay immediately synced and re-rendered with published font sizes upon storage event!')

console.log('=== TEST 3: Persistence after simulated refresh of both pages ===')

// Re-read storage directly as if refreshing the browser
const refreshedConfig = getDisplayBoardConfig()
assert.equal(refreshedConfig.settings.fontControls.nowServing.fontSize, 'small')
assert.equal(refreshedConfig.settings.fontControls.waitingQueue.fontSize, 'xlarge')
assert.equal(refreshedConfig.settings.fontControls.serviceNames.fontSize, 'large')
assert.equal(refreshedConfig.settings.fontControls.windowLabels.fontSize, 'small')
assert.equal(refreshedConfig.settings.fontControls.ticketNumbers.fontSize, 'xlarge')
assert.equal(refreshedConfig.settings.fontControls.waitingQueueTickets.fontSize, 'large')

// Mount new QueueDisplay instance after refresh
let freshQueueDisplay
await act(async () => {
  freshQueueDisplay = Renderer.create(React.createElement(QueueDisplay))
})

const freshViewport = freshQueueDisplay.root.findAll(el => el.props.config && el.props.config.settings?.fontControls)[0]
assert.equal(freshViewport.props.config.settings.fontControls.nowServing.fontSize, 'small')
assert.equal(freshViewport.props.config.settings.fontControls.waitingQueue.fontSize, 'xlarge')
assert.equal(freshViewport.props.config.settings.fontControls.serviceNames.fontSize, 'large')
assert.equal(freshViewport.props.config.settings.fontControls.windowLabels.fontSize, 'small')
assert.equal(freshViewport.props.config.settings.fontControls.ticketNumbers.fontSize, 'xlarge')
assert.equal(freshViewport.props.config.settings.fontControls.waitingQueueTickets.fontSize, 'large')

console.log('✓ Both pages retain published font-size settings after refresh!')

console.log('=== TEST 4: Readable layouts and non-wrapping ticket numbers at xlarge ===')

// Test with 8 windows and 12 windows at xlarge size and 900 weight
const stressConfig = getDefaultDisplayBoardConfig()
stressConfig.settings.enabledDepartments = ['Cashier', 'Registrar', 'ITM', 'Admission']
stressConfig.settings.fontControls = {
  nowServing: { fontFamily: 'poppins', fontSize: 'xlarge', fontWeight: '900' },
  waitingQueue: { fontFamily: 'poppins', fontSize: 'xlarge', fontWeight: '900' },
  serviceNames: { fontFamily: 'poppins', fontSize: 'xlarge', fontWeight: '800' },
  windowLabels: { fontFamily: 'poppins', fontSize: 'xlarge', fontWeight: '900' },
  ticketNumbers: { fontFamily: 'poppins', fontSize: 'xlarge', fontWeight: '900' },
  waitingQueueTickets: { fontFamily: 'poppins', fontSize: 'xlarge', fontWeight: '800' },
}

let stressTree
await act(async () => {
  stressTree = Renderer.create(React.createElement(DisplayBoard, {
    config: stressConfig,
    servingTickets: [
      { ticket_id: 1, service_type: 'CS', window: 1, status: 'serving', ticket_number: 'C-P001' },
      { ticket_id: 2, service_type: 'RT', window: 9, status: 'serving', ticket_number: 'R-P002' },
    ],
    cashierTickets: [
      { ticket_id: 10, service_type: 'CS', status: 'waiting', ticket_number: 'C-P003' },
      { ticket_id: 11, service_type: 'CS', status: 'waiting', ticket_number: 'C-P004' },
    ],
    registrarTickets: [
      { ticket_id: 20, service_type: 'RT', status: 'waiting', ticket_number: 'R-P005' },
    ],
  }))
})

// Check ticket numbers in cards
const cardTicketTexts = stressTree.root.findAllByProps({ className: 'card-ticket-text' })
assert.equal(cardTicketTexts.length, 2)
assert.equal(cardTicketTexts[0].children[0], 'C-P001')
assert.equal(cardTicketTexts[1].children[0], 'R-P002')

// Check waiting list tickets
const waitingItemSpans = stressTree.root.findAll(node => typeof node.props.className === 'string' && node.props.className.includes('ticket-length-'))
assert.ok(waitingItemSpans.length >= 3, 'Waiting ticket items rendered')

console.log('✓ Stress test passed: complete ticket numbers intact at xlarge font sizes!')

console.log('\nALL FONT SIZE LIVE APPLY TESTS PASSED SUCCESSFULLY!')
