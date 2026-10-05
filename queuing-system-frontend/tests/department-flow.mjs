import assert from 'node:assert/strict'
import { build } from 'esbuild'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'
import { MemoryRouter } from 'react-router-dom'

await build({ entryPoints: ['src/pages/Kiosk.jsx', 'src/components/DisplayBoard.jsx'], outdir: 'tests/.compiled/departments', bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', packages: 'external', plugins: [{ name: 'api-fixture', setup(b) {
  b.onResolve({ filter: /\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }))
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: ['generateTicket', 'verifySecurityCode', 'getWindowAvailability', 'getDisplayConfiguration', 'getStudent'].map(name => `export const ${name}=(...args)=>globalThis.testApi.${name}(...args);`).join('\n') }))
} }] })
const Kiosk = (await import('./.compiled/departments/pages/Kiosk.js')).default
const { DisplayBoard } = await import('./.compiled/departments/components/DisplayBoard.js')
let active = ['Cashier', 'Registrar', 'ITM'], generated = []
const timers = new Map(); let nextId = 0
const originalInterval = globalThis.setInterval, originalClear = globalThis.clearInterval
globalThis.setInterval = callback => { timers.set(++nextId, callback); return nextId }
globalThis.clearInterval = id => timers.delete(id)
globalThis.window = Object.assign(new EventTarget(), { localStorage: { getItem: () => null }, location: { pathname: '/kiosk' } })
globalThis.testApi = {
  getDisplayConfiguration: async () => ({ settings: { enabledDepartments: [...active] } }),
  getWindowAvailability: async () => ['ITM', 'Admission'].map(department => ({ department, window_number: 1, is_available: true, status: 'open', staff: { status: 'active', position: department.toLowerCase() } })),
  verifySecurityCode: async () => ({ valid: true, security_user: 'Guard' }),
  getStudent: async () => ({ student_name: 'Student', student_number: '1234-23', course: 'BSIT', registrar_window: 10 }),
  generateTicket: async data => { generated.push(data); return { ...data, ticket_number: `${data.service_type}${data.priority_type === 'P' ? 'P' : 'N'}-0001` } },
}
const flush = async fn => act(async () => { await fn?.(); await Promise.resolve() })
const text = node => typeof node === 'string' ? node : (node?.children || []).map(text).join(' ')
const buttons = tree => tree.root.findAllByType('button')
const button = (tree, label) => buttons(tree).find(node => text(node).includes(label))
let tree
const mount = async () => {
  await flush(() => { tree = Renderer.create(React.createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, React.createElement(Kiosk))) })
  await flush(() => tree.root.findByProps({ className: 'kiosk-splash' }).props.onClick())
  await flush(() => button(tree, 'Guest').props.onClick())
}
await mount()
assert(button(tree, 'Cashier')); assert(button(tree, 'Registrar')); assert(button(tree, 'ITM')); assert(!button(tree, 'Admission'))
active.push('Admission')
await flush(() => window.dispatchEvent(new Event('display-board-config-updated')))
assert(button(tree, 'Admission'), 'new department appears without remounting')
await flush(() => button(tree, 'Admission').props.onClick())
assert(button(tree, 'Regular')); assert(button(tree, 'Priority'))
await flush(() => button(tree, 'Regular').props.onClick())
assert.equal(generated.length, 0, 'department selection does not immediately issue a ticket')
await flush(() => button(tree, 'Admission Service').props.onClick())
assert.equal(generated[0].service_type, 'ADM'); assert.equal(generated[0].priority_type, 'R'); assert.equal(generated[0].student_number, 'Guest')
await flush(() => tree.unmount())
await mount()
await flush(() => button(tree, 'ITM').props.onClick())
active = ['Cashier', 'Registrar']
await flush(() => window.dispatchEvent(new Event('display-board-config-updated')))
assert(button(tree, 'Cashier')); assert(!button(tree, 'ITM')); assert(!button(tree, 'Regular'))
await flush(() => tree.unmount())

for (const department of ['Cashier', 'Registrar', 'ITM', 'Admission']) {
  active = ['Cashier', 'Registrar', 'ITM', 'Admission']
  await mount()
  await flush(() => button(tree, department).props.onClick())
  await flush(() => button(tree, 'Priority').props.onClick())
  const input = tree.root.findAllByType('input').find(node => node.props.value === '')
  await flush(() => input.props.onChange({ target: { value: '1234' } }))
  await flush(() => tree.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  const label = department === 'Cashier' ? 'Payment' : department === 'Registrar' ? 'Document Request' : `${department} Service`
  await flush(() => button(tree, label).props.onClick())
  if (department === 'Registrar') {
    assert(tree.root.findAllByType('h2').some(node => text(node).includes('Select Registrar Window')))
  } else {
    const ticket = generated.at(-1)
    assert.equal(ticket.priority_type, 'P'); assert.equal(ticket.security_code, '1234')
  }
  await flush(() => tree.unmount())
}
const config = { settings: { enabledDepartments: ['Cashier', 'ITM', 'Admission'], schoolName: 'Test' }, windows: ['Cashier', 'ITM', 'Admission'].map((department, order) => ({ department, windowNumber: 1, visible: true, order })) }
const tickets = ['C', 'ITM', 'ADM'].map((service_type, ticket_id) => ({ service_type, ticket_id, ticket_number: `${service_type}N-0001`, status: 'serving', window: 1 }))
await flush(() => { tree = Renderer.create(React.createElement(DisplayBoard, { config, servingTickets: tickets })) })
const panels = tree.root.findAllByType('article')
assert.deepEqual(panels.map(panel => panel.props['aria-label']), [
  'CASHIER WINDOW 1', 'CASHIER WINDOW 2', 'CASHIER WINDOW 3', 'ADMISSION WINDOW 1', 'ITM WINDOW 1',
])
assert.equal(text(panels[0]).includes('CN-0001'), true)
assert.equal(text(panels[3]).includes('ADMN-0001'), true)
assert.equal(text(panels[4]).includes('ITMN-0001'), true)
assert.equal(panels.slice(1, 3).every(panel =>
  !text(panel).includes('No ticket') && panel.findAllByProps({ className: 'card-ticket-number' }).length === 0), true)
await flush(() => tree.unmount())
globalThis.setInterval = originalInterval; globalThis.clearInterval = originalClear
console.log('PASS department activation refresh, shared regular/priority kiosk flows, Registrar routing, and department-isolated display panels')
