import assert from 'node:assert/strict'
import { build } from 'esbuild'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'
import { isMiniStaffUser } from '../src/utils/staffMiniWindow.js'

await build({ entryPoints: ['src/pages/StaffPanel.jsx'], outfile: 'tests/.compiled/DepartmentStaff.js', bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', packages: 'external', plugins: [{ name: 'api', setup(b) {
  b.onResolve({ filter: /\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }))
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: ['callNextTicket', 'completeTicket', 'cancelTicket', 'getWaitingTickets', 'getCurrentStaffTicket', 'getCurrentStaffWindow', 'setAssignedWindowStatus'].map(name => `export const ${name}=(...args)=>globalThis.testApi.${name}(...args);`).join('\n') }))
} }] })
const Staff = (await import('./.compiled/DepartmentStaff.js')).default
const timers = new Map(); let nextId = 0
const originalInterval = globalThis.setInterval, originalClear = globalThis.clearInterval
globalThis.setInterval = (fn, ms) => { timers.set(++nextId, { fn, ms }); return nextId }
globalThis.clearInterval = id => timers.delete(id)
const store = new Map()
globalThis.window = Object.assign(new EventTarget(), { location: { origin: 'http://localhost', search: '' }, localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) } })
globalThis.document = Object.assign(new EventTarget(), { hidden: false })
const flush = async fn => act(async () => { await fn?.(); await Promise.resolve() })
const label = node => typeof node === 'string' ? node : (node?.children || []).map(label).join(' ')
const visible = node => !node || (node.props.style?.display !== 'none' && visible(node.parent))
const button = (tree, text) => tree.root.findAllByType('button').find(node => visible(node) && label(node).includes(text))
const poll = () => flush(async () => { for (const { fn, ms } of [...timers.values()]) if (ms === 5000) await fn() })

for (const position of ['itm', 'admission', 'registrar']) {
  for (const mini of [false, true]) {
    store.clear()
    window.location.search = mini ? '?view=mini' : ''
    let available = position !== 'registrar', enabled = true, serving = null, completed = false, calls = 0, windowStatusCalls = 0
    const type = position === 'itm' ? 'ITM' : position === 'registrar' ? 'RT' : 'ADM'
    const ticket = { ticket_id: 1, ticket_number: `${type}N-0001`, priority_type: 'R', service_type: type, created_at: new Date().toISOString(), student_number: 'Guest' }
    const user = { user_id: 1, username: `${position}1`, full_name: 'Test Staff', role: 'staff', position }
    assert(isMiniStaffUser(user), `${position} supports the existing staff login/mini launcher`)
    const guard = () => { if (!enabled) throw new Error('This department is disabled by the administrator.') }
    globalThis.testApi = {
      getWaitingTickets: async service => { guard(); assert.equal(service, type); return serving || completed ? [] : [ticket] },
      getCurrentStaffTicket: async () => { guard(); return { ticket: serving, transaction: serving ? { start_time: new Date().toISOString() } : null } },
      getCurrentStaffWindow: async () => { guard(); return { window_number: 1, status: available ? 'open' : 'closed', recent_activity: [{ log_id: 1, action: 'Window status updated', created_at: new Date().toISOString() }] } },
      setAssignedWindowStatus: async status => { windowStatusCalls++; available = status === 'open'; return { window: { status } } },
      callNextTicket: async () => { guard(); assert(available); calls++; serving = ticket; return { ticket, transaction: { start_time: new Date().toISOString() } } },
      completeTicket: async () => { guard(); completed = true; serving = null; return { ticket: { ...ticket, status: 'done' } } },
      cancelTicket: async () => { throw new Error('Unexpected cancel') },
    }
    let tree
    await flush(() => { tree = Renderer.create(React.createElement(Staff, { user, onLogout() {} })) })
    if (position === 'registrar') {
      assert(button(tree, 'Open Window'), 'Registrar retains the window status control')
      await flush(() => button(tree, 'Open Window').props.onClick())
      assert.equal(windowStatusCalls, 1, 'Registrar can reopen their assigned window')
      assert(button(tree, 'Close Window'), 'Registrar can close their assigned window')
    } else {
      assert.equal(button(tree, 'Close Window'), undefined, `${position} cannot render window controls`)
      assert(!button(tree, 'Call Next Ticket').props.disabled, `${position} can call from its already-open assigned window`)
    }
    await flush(() => button(tree, 'Call Next Ticket').props.onClick())
    assert.equal(calls, 1)
    await flush(() => button(tree, 'Complete').props.onClick())
    assert(completed)
    await poll()
    const hasRecentActivity = tree.root.findAllByType('summary').some(node => visible(node) && label(node) === 'Recent activity')
    assert.equal(hasRecentActivity, position === 'registrar', `${position} recent activity access follows its role`)
    if (position !== 'registrar') assert.equal(windowStatusCalls, 0, `${position} cannot trigger the window status API`)
    enabled = false
    await poll()
    assert(button(tree, 'Call Next Ticket').props.disabled)
    if (position === 'registrar') assert(button(tree, 'Close Window').props.disabled)
    else assert.equal(button(tree, 'Close Window'), undefined)
    enabled = true
    await poll()
    if (position === 'registrar') assert(!button(tree, 'Close Window').props.disabled)
    else assert.equal(button(tree, 'Close Window'), undefined)
    await flush(() => tree.unmount())
  }
}
globalThis.setInterval = originalInterval; globalThis.clearInterval = originalClear
console.log('PASS Registrar-only window controls and recent activity; ITM/Admission queues remain available in Full and Mini views')
