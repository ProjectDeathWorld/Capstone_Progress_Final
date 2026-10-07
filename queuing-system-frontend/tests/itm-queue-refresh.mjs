import assert from 'node:assert/strict'
import { build } from 'esbuild'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'
const names=['callNextTicket','completeTicket','cancelTicket','getWaitingTickets','getCurrentStaffTicket','getCurrentStaffWindow','setAssignedWindowStatus','getStaffQueueHistory']
await build({entryPoints:['src/pages/StaffPanel.jsx'],outfile:'tests/.compiled/ItmQueue.js',bundle:true,format:'esm',platform:'node',jsx:'automatic',packages:'external',plugins:[{name:'api',setup(b){
 b.onResolve({filter:/\/api$/},()=>({path:'api',namespace:'mock'}))
 b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:names.map(n=>`export const ${n}=(...a)=>globalThis.testApi?.${n} ? globalThis.testApi.${n}(...a) : Promise.resolve({ data: [], total: 0, current_page: 1, last_page: 1, per_page: 10, from: 0, to: 0 });`).join('\n')}))
}}]})
const Staff=(await import('./.compiled/ItmQueue.js')).default
const originalSet=globalThis.setInterval,originalClear=globalThis.clearInterval
const timers=new Map();let serial=0
const flush=async fn=>act(async()=>{await fn?.();await Promise.resolve()})
const label=n=>n.children.map(x=>typeof x==='string'?x:label(x)).join('')
const visible=n=>!n||(n.props.style?.display!=='none'&&visible(n.parent))
const button=(tree,name)=>tree.root.findAllByType('button').find(n=>visible(n)&&label(n).includes(name))
try {
 for(const mini of [false,true]) {
  const saved=new Map();let queue=[{ticket_id:99,ticket_number:'ITMN-0099',service_type:'ITM',priority_type:'R',status:'waiting',created_at:new Date().toISOString()}],current=null,reads=0,windowAssigned=false
  globalThis.window=Object.assign(new EventTarget(),{location:{search:mini?'?view=mini':'',origin:'http://localhost:3000'},localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},opener:null})
  globalThis.setInterval=(fn,ms)=>{timers.set(++serial,{fn,ms});return serial};globalThis.clearInterval=id=>timers.delete(id)
  globalThis.testApi={getWaitingTickets:async(service,window,position)=>{assert.equal(service,'ITM');assert.equal(window,null);assert.equal(position,'itm');reads++;return [...queue]},getCurrentStaffTicket:async()=>({ticket:current,transaction:current?{staff_id:3,start_time:new Date().toISOString()}:null}),getCurrentStaffWindow:async()=>{if(!windowAssigned)throw Object.assign(new Error('This account is not assigned to a service window.'),{status:403});return {window_number:1,department:'ITM',status:'open'}},callNextTicket:async()=>{current=queue.shift();return {ticket:current,transaction:{staff_id:3,start_time:new Date().toISOString()}}},completeTicket:async()=>{const ticket=current;current=null;return {ticket}},cancelTicket:async()=>{const ticket=current;current=null;return {ticket}}}
  let tree;await flush(()=>{tree=Renderer.create(React.createElement(Staff,{user:{user_id:3,username:'itm',full_name:'ITM Staff 1',role:'staff',position:'itm'}}))})
  const count=()=>label(tree.root.findAllByProps({className:mini?'staff-mini-metric':'staff-stat-number'})[0])
  assert.ok(JSON.stringify(tree.toJSON()).includes('ITMN-0099'),'ITM queue renders tickets even when the optional assigned-window request returns 403')
  queue=[];windowAssigned=true
  await flush(()=>{const event=new Event('storage');Object.assign(event,{key:'queue-data-changed',newValue:'window-assigned'});window.dispatchEvent(event)})
  assert.match(count(),/0/)
  for(const n of [1,2]) {
   queue.push({ticket_id:n,ticket_number:`ITM-N00${n}`,service_type:'ITM',priority_type:'R',status:'waiting',created_at:new Date().toISOString()})
   await flush(()=>{const event=new Event('storage');Object.assign(event,{key:'queue-data-changed',newValue:String(n)});window.dispatchEvent(event)})
   assert.ok(count().includes(String(n)),`ITM ${mini?'Mini':'Full'} should immediately display ${n} waiting after kiosk change notification; got ${count()}`)
   assert.ok(JSON.stringify(tree.toJSON()).includes(`ITM-N00${n}`))
  }
  assert.equal([...timers.values()].filter(t=>t.ms===5000).length,1,'one existing polling loop')
  await flush(()=>button(tree,'Call Next Ticket').props.onClick());assert.equal(current.ticket_number,'ITM-N001');assert.ok(count().includes('1'))
  await flush(()=>button(tree,'Complete').props.onClick());await flush(()=>button(tree,'Call Next Ticket').props.onClick());assert.equal(current.ticket_number,'ITM-N002')
  await flush(()=>tree.unmount());assert.equal(timers.size,0)
  console.log(`PASS ITM ${mini?'Mini':'Full'}: unassigned-window queue visibility, 0 -> 1 -> 2 via kiosk events, Call Next, Complete, next ticket, no duplicate polling`)
 }
} finally {globalThis.setInterval=originalSet;globalThis.clearInterval=originalClear}
