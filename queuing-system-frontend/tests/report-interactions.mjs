import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'

const names = ['callNextTicket', 'completeTicket', 'cancelTicket', 'getWaitingTickets', 'getCurrentStaffTicket', 'getCurrentStaffWindow', 'setAssignedWindowStatus', 'getReportData', 'getDepartmentComparison', 'getWindowAvailability']
await build({entryPoints: ['src/pages/StaffPanel.jsx', 'src/pages/Reports.jsx', 'src/pages/Analytics.jsx'], outdir: 'tests/.compiled', bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', packages: 'external', external: ['react', 'react/jsx-runtime'], plugins: [{name: 'test-api', setup(b) {
  b.onResolve({filter: /\/api$/}, () => ({path: 'api', namespace: 'test'}))
  b.onLoad({filter: /.*/, namespace: 'test'}, () => ({contents: names.map(n => `export const ${n} = (...args) => globalThis.testApi.${n}(...args);`).join('\n')}))
  b.onResolve({filter: /\/reportPdf$/}, () => ({path: 'pdf', namespace: 'pdf'}))
  b.onLoad({filter: /.*/, namespace: 'pdf'}, () => ({contents: 'export const createReportPdf = data => ({save: () => globalThis.exported.push(data)});'}))
  b.onResolve({filter: /^@mui\/material$/}, () => ({path: 'mui', namespace: 'mui'}))
  b.onLoad({filter: /.*/, namespace: 'mui'}, () => ({contents: `import React from 'react'; ${['Box','Typography','Grid','Paper','Stack','Button','Card','CardContent','Divider','Skeleton'].map(n => `export const ${n} = props => React.createElement('${n === 'Button' ? 'button' : 'div'}', props, props.children);`).join('\n')}`}))
}}]})
const Staff = (await import('./.compiled/StaffPanel.js')).default
const Reports = (await import('./.compiled/Reports.js')).default
const Analytics = (await import('./.compiled/Analytics.js')).default
const intervals = new Map(); let timerId = 0
const originalInterval = globalThis.setInterval, originalClear = globalThis.clearInterval
Object.assign(globalThis, {
  window: Object.assign(new EventTarget(), {innerWidth: 1280, innerHeight: 900, location: {pathname: '/staff',origin:'http://localhost:3000'}, focus(){}}),
  document: Object.assign(new EventTarget(), {hidden: false}),
  sessionStorage: {getItem: () => null, setItem: () => {}}, requestAnimationFrame: fn => fn(),
  setInterval: (fn, ms) => {intervals.set(++timerId, {fn,ms}); return timerId}, clearInterval: id => intervals.delete(id), exported: []
})
window.open = () => { throw new Error('Mini View must not open a window') }
const flush = async fn => { await act(async () => {if (fn) await fn(); await Promise.resolve()}) }
const label = node => node.children.map(v => typeof v === 'string' ? v : label(v)).join('')
const visible = node => !node || (node.props.style?.display !== 'none' && visible(node.parent))
const button = (tree, name) => tree.root.findAllByType('button').find(n => visible(n) && label(n).includes(name))
const ticket = {ticket_id: 1, ticket_number: 'C-R005', service_type: 'C', priority_type: 'R', created_at: '2026-09-08T01:00:00Z'}
let reads = 0, completes = 0
const base = JSON.parse(readFileSync('../tmp/pdfs/test-database-report.json','utf8'))
globalThis.testApi = {
  getWaitingTickets: async () => {reads++; return [ticket]}, getCurrentStaffTicket: async () => {reads++; return {ticket: null}},
  callNextTicket: async () => ({ticket}), completeTicket: async () => {completes++; return {ticket}}, cancelTicket: async () => ({ticket}),
  getCurrentStaffWindow: async () => ({window_number: 9, status:'open'}), setAssignedWindowStatus: async status => ({status}),
  getDepartmentComparison: async () => [], getWindowAvailability: async () => []
}
let staff
await flush(() => {staff = Renderer.create(React.createElement(Staff, {user:{role:'staff', position:'cashier', username:'cashier1',full_name:'Test Staff'}}))})
assert.equal(staff.root.findAllByProps({className:'staff-page'}).length, 1)
assert.equal(staff.root.findAllByProps({className:'staff-mini-panel'}).length, 0)
const originalShell = staff.root.findByProps({className:'staff-shell'})
const readCount = reads, pollCount = intervals.size
const openMini = async tree => {
  await flush(() => button(tree,'Mini View').props.onClick())
}
await openMini(staff)
assert.equal(staff.root.findAllByProps({className:'staff-page'}).length,0)
assert.equal(staff.root.findByProps({className:'staff-shell'}),originalShell)
assert.equal(originalShell.props.style.display,'none')
assert.equal(window.location.pathname,'/staff'); assert.equal(reads,readCount); assert.equal(intervals.size,pollCount)
await flush(() => button(staff, 'Call Next Ticket').props.onClick())
assert.ok(JSON.stringify(staff.toJSON()).includes('C-R005'))
await flush(() => staff.root.findByProps({'aria-label':'Expand to full dashboard'}).props.onClick())
assert.ok(JSON.stringify(staff.toJSON()).includes('C-R005'))
assert.equal(staff.root.findByProps({className:'staff-shell'}),originalShell)
assert.equal(originalShell.props.style,undefined)
await openMini(staff)
await flush(() => button(staff, 'Complete').props.onClick())
assert.equal(completes, 1)
await flush(() => staff.root.findByProps({'aria-label':'Close Mini View'}).props.onClick())
assert.ok(!JSON.stringify(staff.toJSON()).includes('C-R005'))
assert.equal(staff.root.findAllByProps({className:'staff-page'}).length, 1)
assert.equal(staff.root.findAllByProps({className:'staff-mini-stage'}).length, 0)
assert.equal(staff.root.findAllByProps({className:'staff-mini-panel'}).length, 0)
await flush(() => staff.unmount()); assert.equal(intervals.size, 0)
console.log('PASS: Mini View shares ticket actions and opens/closes without new requests or timers')

let skipped = 0, toggled = null
testApi.getCurrentStaffTicket = async () => ({ticket})
testApi.cancelTicket = async () => {skipped++; return {ticket}}
testApi.setAssignedWindowStatus = async status => {toggled=status; return {status}}
await flush(() => {staff = Renderer.create(React.createElement(Staff, {user:{role:'staff', position:'registrar', username:'registrar1',full_name:'Registrar Staff'}}))})
await openMini(staff)
await flush(() => button(staff,'Close Window').props.onClick())
assert.equal(toggled,'closed')
await flush(() => button(staff,'Skip / No Show').props.onClick())
assert.equal(skipped,1)
await flush(() => staff.root.findByProps({'aria-label':'Close Mini View'}).props.onClick())
assert.ok(button(staff,'Open Window'))
await flush(() => staff.unmount())
console.log('PASS: Registrar Mini View shares skip and Open/Close window state')

const requests = []
testApi.getReportData = (...args) => new Promise(resolve => requests.push({args, resolve}))
const response = (id, department='Cashier') => ({...base, department, report_summary:{...base.report_summary,tickets_issued:id}, analytics:{...base.analytics,dashboard:{...base.analytics.dashboard,customers_served:id}}})
for (const [Component, weekly, monthly] of [[Reports,'Weekly','Monthly'], [Analytics,'7 Days','30 Days']]) {
  requests.length=0; let tree
  await flush(() => {tree=Renderer.create(React.createElement(Component))})
  assert.equal(requests.length,1)
  await flush(() => button(tree,weekly).props.onClick()); assert.equal(requests.length,2)
  await flush(() => button(tree,monthly).props.onClick()); assert.equal(requests.length,3)
  assert.equal(requests[2].args[0],'monthly')
  assert.ok(requests[0].args[4].aborted); assert.ok(requests[1].args[4].aborted)
  for (const {fn,ms} of intervals.values()) if (ms === 10000) await flush(fn)
  assert.equal(requests.length,3,'poll must not duplicate in-flight filter request')
  await flush(() => requests[2].resolve(response(98765)))
  await flush(() => requests[0].resolve(response(11111)))
  await flush(() => requests[1].resolve(response(22222)))
  assert.ok(JSON.stringify(tree.toJSON()).includes('98765'))
  assert.ok(!JSON.stringify(tree.toJSON()).includes('11111'))
  assert.ok(!JSON.stringify(tree.toJSON()).includes('22222'))
  await flush(() => button(tree,'Semester').props.onClick())
  assert.equal(requests.at(-1).args[0], 'semester')
  await flush(() => requests.at(-1).resolve(response(76543)))
  await flush(() => button(tree, Component === Reports ? 'Custom Date' : 'Custom Range').props.onClick())
  assert.equal(requests.at(-1).args[0], 'custom')
  await flush(() => requests.at(-1).resolve(response(65432)))
  const dates = tree.root.findAllByProps({type:'date'})
  await flush(() => dates[0].props.onChange({target:{value:'2026-09-01'}}))
  assert.equal(requests.at(-1).args[1], '2026-09-01')
  await flush(() => dates[1].props.onChange({target:{value:'2026-09-07'}}))
  assert.equal(requests.at(-1).args[2], '2026-09-07')
  await flush(() => requests.at(-1).resolve(response(54321)))
  const countBeforeInvalid = requests.length
  await flush(() => dates[0].props.onChange({target:{value:'2026-09-08'}}))
  assert.equal(requests.length,countBeforeInvalid,'invalid range must not fetch')
  await flush(() => dates[0].props.onChange({target:{value:'2026-09-01'}}))
  await flush(() => requests.at(-1).resolve(response(54321)))
  await flush(() => Component === Reports ? tree.root.findByType('select').props.onChange({target:{value:'ITM'}}) : button(tree,'ITM Analytics').props.onClick())
  assert.equal(requests.at(-1).args[3], 'ITM')
  await flush(() => requests.at(-1).resolve(response(43210,'ITM')))
  await flush(() => button(tree, monthly).props.onClick())
  await flush(() => requests.at(-1).resolve(response(43210,'ITM')))
  if (Component === Reports) {
    let exportPromise
    const beforeExport = requests.length
    await flush(() => {exportPromise = button(tree,'Generate PDF Report').props.onClick()})
    assert.equal(requests.length,beforeExport + 1); assert.equal(exported.length,0)
    await flush(() => requests.at(-1).resolve(response(87654,'ITM')))
    await exportPromise; assert.equal(exported[0].report_summary.tickets_issued,87654)
  }
  for (const {fn,ms} of intervals.values()) if (ms===10000) await flush(fn)
  assert.equal(requests.at(-1).args[0],'monthly')
  await flush(() => tree.unmount()); assert.equal(intervals.size,0)
  console.log(`PASS: ${Component.name} immediate filters, stale response protection, current-filter polling${Component===Reports?', fresh PDF export':''}`)
}
globalThis.setInterval=originalInterval; globalThis.clearInterval=originalClear

