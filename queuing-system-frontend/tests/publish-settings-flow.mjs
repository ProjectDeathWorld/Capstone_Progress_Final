import assert from 'node:assert/strict'
import { build } from 'esbuild'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'

// Build AdminPanel and DisplayBoard for node testing
await build({
  entryPoints: ['src/pages/AdminPanel.jsx'],
  outfile: 'tests/.compiled/AdminPanelFlow.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  packages: 'external',
})

await build({
  entryPoints: ['src/components/DisplayBoard.jsx'],
  outfile: 'tests/.compiled/DisplayBoardFlow.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  packages: 'external',
})

await build({
  entryPoints: ['src/utils/displayBoardConfig.js'],
  outfile: 'tests/.compiled/displayBoardConfig.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
})

import { MemoryRouter } from 'react-router-dom'

const { default: AdminPanel } = await import('./.compiled/AdminPanelFlow.js')
const { DisplayBoard } = await import('./.compiled/DisplayBoardFlow.js')
const {
  DEFAULT_DISPLAY_PANEL_COLORS,
  DEFAULT_WINDOW_TICKET_TEXT_COLOR,
  getColorContrastRatio,
  getDisplayBoardConfig,
  saveDisplayBoardConfig,
} = await import('./.compiled/displayBoardConfig.js')

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

// Mock fetch for API calls in AdminPanel
globalThis.fetch = async (url, options = {}) => {
  if (url.includes('/display-configuration')) {
    if (options.method === 'PUT') {
      const parsed = JSON.parse(options.body)
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

// 1. Test DisplayBoard color rendering & contrast fallback
console.log('Test 1: Verify DisplayBoard per-panel color styling and ticket contrast fallback...')
const sampleConfig = {
  settings: {
    enabledDepartments: ['Cashier', 'Registrar'],
    panelColors: {
      Cashier: { background: '#f2c64b', text: '#071b4d' }, // gold background, dark text
      Registrar: { background: '#10264d', text: '#ffffff' }, // dark navy background, white text
    },
    windowTicketTextColor: '#ffffff', // default white ticket text
  },
  windows: [
    { department: 'Cashier', windowNumber: 1, visible: true },
    { department: 'Registrar', windowNumber: 9, visible: true },
  ],
}

let boardTree
await act(async () => {
  boardTree = Renderer.create(React.createElement(DisplayBoard, {
    config: sampleConfig,
    servingTickets: [
      { ticket_id: 1, service_type: 'CS', window: 1, status: 'serving', ticket_number: 'C-001' },
      { ticket_id: 2, service_type: 'RT', window: 9, status: 'serving', ticket_number: 'R-001' },
    ],
  }))
})

const articles = boardTree.root.findAllByType('article')
assert.equal(articles.length, 8, 'Should render 8 window panels across Cashier (3) and Registrar (5)')

const cashierPanel = articles.find(p => p.props['aria-label'].includes('CASHIER'))
const registrarPanel = articles.find(p => p.props['aria-label'].includes('REGISTRAR'))

assert.ok(cashierPanel, 'Cashier panel must exist')
assert.ok(registrarPanel, 'Registrar panel must exist')

// Verify Cashier panel background is #f2c64b and text is #071b4d
assert.equal(cashierPanel.props.style['--card-background'], '#f2c64b')
assert.equal(cashierPanel.props.style['--card-text'], '#071b4d')
// Since white ticket text has low contrast (1.6:1) against gold, ticket color falls back to #071b4d
assert.equal(cashierPanel.props.style['--card-ticket-text'], '#071b4d', 'Ticket text should fall back to readable text color on gold panel')

// Verify Registrar panel background is #10264d and text is #ffffff
assert.equal(registrarPanel.props.style['--card-background'], '#10264d')
assert.equal(registrarPanel.props.style['--card-text'], '#ffffff')
// White ticket text has high contrast (14.8:1) against navy, so it stays #ffffff
assert.equal(registrarPanel.props.style['--card-ticket-text'], '#ffffff', 'Ticket text should use white on navy panel')

console.log('✓ DisplayBoard per-panel color styling and ticket contrast fallback verified.')

// 2. Test AdminPanel Settings flow
console.log('Test 2: Verify AdminPanel Settings color change, unsaved status, and Publish button enabled state...')

let adminTree
await act(async () => {
  adminTree = Renderer.create(
    React.createElement(MemoryRouter, null, React.createElement(AdminPanel, { initialPage: 'settings', user: { full_name: 'Admin', role: 'admin' } }))
  )
})

// Find "Publish to Display" button
const findPublishButton = () => {
  const buttons = adminTree.root.findAllByType('button')
  return buttons.find(b => {
    const text = typeof b.children[0] === 'string' ? b.children[0] : ''
    return text.includes('Publish to Display') || text.includes('Publishing...')
  })
}

// Find status text
const findStatusText = () => {
  const statusDiv = adminTree.root.findByProps({ className: 'settings-status' })
  return statusDiv ? statusDiv.children.join('') : ''
}

// Find Cashier background color input
const findColorInput = (ariaLabel) => {
  return adminTree.root.findByProps({ 'aria-label': ariaLabel })
}

let publishBtn = findPublishButton()
assert.ok(publishBtn, 'Publish to Display button must be present')
assert.equal(publishBtn.props.disabled, false, 'Publish to Display should be initially enabled')

// Change Cashier panel background color to gold (#f2c64b)
console.log('Simulating changing Cashier background to gold (#f2c64b)...')
const cashierBgInput = findColorInput('Cashier panel background color')
assert.ok(cashierBgInput, 'Cashier background color input must be present')

await act(async () => {
  cashierBgInput.props.onChange({ target: { value: '#f2c64b' } })
})

// After changing color:
// 1. Status must show 'Unsaved changes'
assert.equal(findStatusText(), 'Unsaved changes', 'Status should indicate unsaved changes')

// 2. Publish to Display button MUST remain enabled!
publishBtn = findPublishButton()
assert.equal(publishBtn.props.disabled, false, 'Publish to Display button MUST stay enabled when valid color is selected')

// 3. Change multiple settings: Registrar background to #0284c7, waiting queue colors, and active departments
console.log('Simulating multiple configuration changes before publishing...')
const registrarBgInput = findColorInput('Registrar panel background color')
await act(async () => {
  registrarBgInput.props.onChange({ target: { value: '#0284c7' } })
})

publishBtn = findPublishButton()
assert.equal(publishBtn.props.disabled, false, 'Publish button remains enabled after second color change')
assert.equal(findStatusText(), 'Unsaved changes')

// 4. Test clicking Publish
console.log('Simulating clicking Publish to Display...')
await act(async () => {
  await publishBtn.props.onClick()
})

assert.equal(findStatusText(), 'Display settings published successfully.')

// 5. Verify saved settings persist in storage
const savedConfig = getDisplayBoardConfig()
assert.equal(savedConfig.settings.panelColors.Cashier.background, '#f2c64b')
assert.equal(savedConfig.settings.panelColors.Registrar.background, '#0284c7')
console.log('✓ Published settings persist correctly.')

// 6. Test invalid state: unchecking all departments
console.log('Test 3: Verify button disabled when settings are genuinely invalid...')
const activeCheckboxes = adminTree.root.findAll(el => el.type === 'input' && el.props.type === 'checkbox' && el.parent?.props?.className === undefined && el.parent?.parent?.props?.className === 'department-activation-options')

// Uncheck all active departments
for (const cb of activeCheckboxes) {
  if (cb.props.checked) {
    await act(async () => {
      cb.props.onChange({ target: { checked: false } })
    })
  }
}

publishBtn = findPublishButton()
assert.equal(publishBtn.props.disabled, true, 'Publish button MUST be disabled when zero departments are active')

// Check that clear validation alert is displayed
const validationAlert = adminTree.root.findByProps({ className: 'settings-validation-alert' })
assert.ok(validationAlert, 'Validation alert banner must be displayed')
assert.ok(validationAlert.children.join('').includes('At least one department must be active'), 'Validation message must explain why publishing is blocked')

console.log('✓ Validation reason displayed and button disabled when settings are genuinely invalid.')

console.log('ALL TESTS PASSED!')
await act(async () => {
  adminTree.unmount()
  boardTree.unmount()
})
process.exit(0)
