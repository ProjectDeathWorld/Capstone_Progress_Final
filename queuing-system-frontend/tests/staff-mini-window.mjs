import assert from 'node:assert/strict'
import { build } from 'esbuild'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'
import { openStaffMiniWindow, restoreStaffWindow, handoffStaffWindow, withStaffWindowLock } from '../src/utils/staffMiniWindow.js'

const names = ['callNextTicket','completeTicket','cancelTicket','getWaitingTickets','getCurrentStaffTicket','getCurrentStaffWindow','setAssignedWindowStatus']
await build({entryPoints:['src/pages/StaffPanel.jsx'],outfile:'tests/.compiled/StaffPopup.js',bundle:true,format:'esm',platform:'node',jsx:'automatic',packages:'external',plugins:[{name:'api',setup(b){
  b.onResolve({filter:/\/api$/},()=>({path:'api',namespace:'mock'}))
  b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:names.map(n=>`export const ${n}=(...args)=>globalThis.testApi.${n}(...args);`).join('\n')}))
}}]})
const Staff=(await import('./.compiled/StaffPopup.js')).default
const timers=new Map(), channels=[]
let timer=0, reads=0, calls=0, completes=0, skips=0, closed=0, opened=0
const oldInterval=globalThis.setInterval, oldClear=globalThis.clearInterval, oldTimeout=globalThis.setTimeout, oldClearTimeout=globalThis.clearTimeout
class Channel { constructor(){channels.push(this)} postMessage(data){this.last=data} close(){} }
globalThis.BroadcastChannel=Channel
const saved=new Map()
const localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}
const popup={closed:false,focus(){},close(){this.closed=true}}
globalThis.window=Object.assign(new EventTarget(),{localStorage,BroadcastChannel:Channel,location:{search:'',origin:'http://localhost:3000',pathname:'/staff'},open(...args){opened++;assert.equal(args[0],'/staff?view=mini');assert.match(args[2],/width=480,height=760/);return popup},close(){closed++},opener:null})
globalThis.setInterval=(fn,ms)=>{timers.set(++timer,{fn,ms});return timer}
globalThis.clearInterval=id=>timers.delete(id)
globalThis.setTimeout=(fn,ms)=>{const id=++timer;timers.set(id,{fn:()=>{timers.delete(id);fn()},ms});return id}
globalThis.clearTimeout=id=>timers.delete(id)
const ticket={ticket_id:5,ticket_number:'C-P001',priority_type:'P',service_type:'C',created_at:new Date().toISOString()}
let current=null
const transaction={start_time:new Date().toISOString()}
globalThis.testApi={getWaitingTickets:async()=>{reads++;return current?[]:[ticket]},getCurrentStaffTicket:async()=>({ticket:current,transaction:current?transaction:null}),getCurrentStaffWindow:async()=>({window_number:2,status:'open'}),callNextTicket:async()=>{calls++;current=ticket;return {ticket,transaction}},completeTicket:async()=>{completes++;current=null;return {ticket}},cancelTicket:async()=>{skips++;current=null;return {ticket}},setAssignedWindowStatus:async status=>({status})}
const user={user_id:6,username:'cashier1',full_name:'Cashier Test',position:'cashier',role:'staff'}
const flush=async fn=>act(async()=>{await fn?.();await Promise.resolve()})
const label=n=>n.children.map(x=>typeof x==='string'?x:label(x)).join('')
const visible=n=>!n||(n.props.style?.display!=='none'&&visible(n.parent))
const button=(tree,name)=>tree.root.findAllByType('button').find(n=>visible(n)&&label(n).includes(name))
let tree
try {
  await flush(()=>{tree=Renderer.create(React.createElement(Staff,{user}))})
  const before=reads
  await flush(()=>button(tree,'Mini View').props.onClick())
  assert.equal(opened,1);assert.equal(tree.root.findAllByProps({className:'staff-mini-panel'}).length,0)
  await flush(()=>button(tree,'Mini View').props.onClick());assert.equal(opened,1)
  assert.equal(closed,0,'source stays open until backend readiness')
  popup.__staffPresentationReady={staffId:user.user_id,mode:'mini',instanceId:'mini-test'}
  await flush(()=>{const event=new Event('message');Object.assign(event,{origin:window.location.origin,source:popup,data:{type:'STAFF_READY',...popup.__staffPresentationReady}});window.dispatchEvent(event)})
  assert.equal(closed,0,'manual Full tab is not force-closed')
  assert.equal(popup.closed,false,'Mini survives the manual-tab restriction')
  assert.ok(JSON.stringify(tree.toJSON()).includes('This Staff view is paused'))
  for(const t of [...timers.values()]) if(t.ms===5000) await flush(t.fn)
  assert.equal(reads,before,'inactive Full has no API polling')
  await flush(()=>button(tree,'Call Next Ticket').props.onClick())
  assert.equal(calls,0,'inactive source rejects transactions even when handler is invoked directly')
  popup.closed=true
  for(const t of [...timers.values()]) if(t.ms===500) await flush(t.fn)
  assert.ok(reads>before,'closing Mini reactivates Full and reloads backend data')
  window.open=()=>null
  await flush(()=>button(tree,'Mini View').props.onClick())
  assert.ok(JSON.stringify(tree.toJSON()).includes('Please allow popups'))
  await flush(()=>tree.unmount())
  console.log('PASS popup URL/size, reuse, blocker, full-view preservation, readiness, inactive Full ownership and polling recovery')

  saved.clear();window.name='qms-staff-mini-6';window.location.search='?view=mini';current=ticket
  await flush(()=>{tree=Renderer.create(React.createElement(Staff,{user}))})
  assert.equal(tree.root.findAllByProps({className:'staff-mini-panel'}).length,1)
  assert.ok(JSON.stringify(tree.toJSON()).includes('C-P001'))
  const callsBeforeWait=calls
  for(let second=0;second<30;second+=5) for(const t of [...timers.values()]) if(t.ms===5000) await flush(t.fn)
  assert.ok(JSON.stringify(tree.toJSON()).includes('C-P001'),'same backend ticket survives 30 seconds of polling')
  assert.equal(calls,callsBeforeWait,'polling does not call a ticket')
  await flush(()=>button(tree,'Complete').props.onClick());assert.equal(completes,1)
  await flush(()=>button(tree,'Call Next Ticket').props.onClick());assert.equal(calls,1)
  await flush(()=>button(tree,'Skip / No Show').props.onClick());assert.equal(skips,1)
  window.opener={closed:true}
  for(const t of timers.values()) if(t.ms===5000) await flush(t.fn)
  assert.equal(closed,0)
  window.opener={closed:false,location:{origin:window.location.origin,pathname:'/staff'},focus(){}}
  window.open=(url,name,features)=>{assert.equal(url,'/staff');assert.match(features,/width=1280,height=900/);assert.doesNotMatch(features,/width=480/);popup.closed=false;popup.__staffPresentationReady={staffId:user.user_id,mode:'full'};return popup}
  window.close=()=>{closed++;window.closed=true}
  await flush(()=>tree.root.findByProps({'aria-label':'Close Mini View'}).props.onClick())
  assert.equal(closed,1,'already mounted restore target hands off immediately')
  await flush(()=>{const event=new Event('message');Object.assign(event,{origin:window.location.origin,source:popup,data:{type:'STAFF_READY',...popup.__staffPresentationReady}});window.dispatchEvent(event)})
  assert.equal(closed,1)
  assert.equal(popup.closed,false,'target survives source unmount')
  await flush(()=>tree.unmount());assert.equal(timers.size,0)
  assert.equal(window.__staffPresentationReady,undefined)
  console.log('PASS mini current-ticket restore, complete/call/skip, opener independence, restore and cleanup')

  assert.equal(restoreStaffWindow({open:()=>null},6),null)
  assert.equal(openStaffMiniWindow({open:()=>null},6),null)
  let failure=''
  popup.closed=false;delete popup.__staffPresentationReady
  handoffStaffWindow(window,popup,user.user_id,'mini',message=>failure=message)
  for(const t of [...timers.values()]) if(t.ms===30000)t.fn()
  assert.match(failure,/could not initialize/)
  assert.equal(popup.closed,true)
  assert.equal(timers.size,0)
  for(const mode of Array.from({length:10},(_,index)=>index%2?'full':'mini')) {
    const source=Object.assign(new EventTarget(),{name:'qms-staff-full-6',location:window.location,closed:false,close(){this.closed=true}})
    const destination={closed:false,focus(){},__staffPresentationReady:{staffId:user.user_id,mode}}
    handoffStaffWindow(source,destination,user.user_id,mode,()=>assert.fail('successful handoff'))
    for(const t of [...timers.values()]) if(t.ms===30000)t.fn()
    for(const t of [...timers.values()]) if(t.ms===250)t.fn()
    assert.equal(source.closed,true);assert.equal(destination.closed,false)
    assert.equal(timers.size,0)
  }
  const delayedSource=Object.assign(new EventTarget(),{location:window.location,closed:false,close(){}})
  const delayedTarget={closed:false,focus(){},close(){assert.fail('must not close target while source is closing')},__staffPresentationReady:{staffId:user.user_id,mode:'mini'}}
  handoffStaffWindow(delayedSource,delayedTarget,user.user_id,'mini',()=>assert.fail('close has not been refused'))
  for(const t of [...timers.values()]) if(t.ms===30000)t.fn()
  delayedSource.closed=true
  for(const t of [...timers.values()]) if(t.ms===250)t.fn()
  assert.equal(timers.size,0)
  let held=false,release,actionCount=0
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:async(name,options,fn)=>{assert.equal(options.ifAvailable,true);if(held)return fn(null);held=true;try{return await fn({name})}finally{held=false}}}})
  const first=withStaffWindowLock(6,()=>{actionCount++;return new Promise(r=>release=r)})
  await withStaffWindowLock(6,()=>{actionCount++});assert.equal(actionCount,1);release();await first
  console.log('PASS readiness timeout, blocked restore and simultaneous action suppression')
} finally {globalThis.setInterval=oldInterval;globalThis.clearInterval=oldClear;globalThis.setTimeout=oldTimeout;globalThis.clearTimeout=oldClearTimeout;delete navigator.locks}
