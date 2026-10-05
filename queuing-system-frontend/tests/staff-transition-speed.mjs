import assert from 'node:assert/strict'
import React from 'react'
import Renderer,{act} from 'react-test-renderer'
import {handoffStaffWindow} from '../src/utils/staffMiniWindow.js'
const Staff=(await import('./.compiled/StaffPopup.js')).default
const origin='http://localhost'
const values=new Map([['qms-staff-view-3',JSON.stringify({id:'source',mode:'full'})]])
const source=Object.assign(new EventTarget(),{name:'qms-staff-full-3',location:{origin},closed:false,close(){this.closed=true},focus(){}})
const target=Object.assign(new EventTarget(),{name:'qms-staff-mini-3',location:{origin,pathname:'/staff',search:'?view=mini'},focus(){},localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}})
target.opener={postMessage(data){const event=new Event('message');Object.assign(event,{data,origin,source:target});source.dispatchEvent(event)}}
globalThis.window=target
const pending=[]
const read=(name,signal)=>new Promise((resolve,reject)=>{
  pending.push({name,signal,resolve})
  signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true})
})
globalThis.testApi={getWaitingTickets:(_service,_window,_mode,signal)=>read('waiting',signal),getCurrentStaffTicket:signal=>read('current',signal),getCurrentStaffWindow:signal=>read('window',signal)}
for(const name of ['callNextTicket','completeTicket','cancelTicket','setAssignedWindowStatus'])testApi[name]=()=>assert.fail('transition must not mutate ticket/window state')
let readyMs,closeMs,tree
const clicked=performance.now()
handoffStaffWindow(source,target,3,'mini',message=>assert.fail(message),id=>{
  readyMs=performance.now()-clicked
  values.set('qms-staff-view-3',JSON.stringify({id,mode:'mini'}))
  const event=new Event('storage');Object.assign(event,{key:'qms-staff-view-3'});target.dispatchEvent(event)
})
await act(async()=>{tree=Renderer.create(React.createElement(Staff,{user:{user_id:3,username:'cashier3',role:'staff',position:'cashier',full_name:'Cashier Staff 3'}}))})
closeMs=performance.now()-clicked
assert.equal(source.closed,true,'source closes while ALL Staff reads are unfinished')
assert.ok(target.__staffPresentationReady)
assert.equal(pending.length,3,'one initial request per endpoint')
const ticket={ticket_id:5,ticket_number:'C-R005',priority_type:'R',service_type:'C'}
await act(async()=>{
  pending[0].resolve([])
  pending[1].resolve({ticket,transaction:{start_time:new Date(Date.now()-134000).toISOString()}})
  pending[2].resolve({window_number:3,status:'open'})
})
assert.ok(JSON.stringify(tree.toJSON()).includes('C-R005'))
assert.equal(pending.length,3,'data completion does not trigger a second initial refresh')
await act(async()=>target.dispatchEvent(new Event('focus')))
assert.equal(pending.length,6)
await act(async()=>target.__staffPause())
assert.ok(pending.slice(3).every(request=>request.signal.aborted),'logout aborts pending GETs')
await act(async()=>target.dispatchEvent(new Event('focus')))
assert.equal(pending.length,6,'logout detaches focus refresh')
await act(async()=>tree.unmount())
console.log(`SIMULATED click/mount to MINI_READY ${readyMs.toFixed(2)} ms; source closed within ${closeMs.toFixed(2)} ms; backend requests deliberately unresolved (not a live browser timing)`)
console.log('PASS fast authenticated mount readiness, no backend-data gate, one initial fetch per endpoint, ticket restoration and immediate read cancellation')

const guardedSource=Object.assign(new EventTarget(),{location:{origin},name:'qms-staff-full-3',closed:false,close(){this.closed=true}})
const guardedTarget={closed:false,focus(){}}
handoffStaffWindow(guardedSource,guardedTarget,3,'mini',message=>assert.fail(message))
guardedTarget.__staffPresentationReady={staffId:3,mode:'mini',instanceId:'current-mount'}
const send=(instanceId,eventOrigin=origin,eventSource=guardedTarget)=>{
  const event=new Event('message')
  Object.assign(event,{origin:eventOrigin,source:eventSource,data:{type:'STAFF_READY',staffId:3,mode:'mini',instanceId}})
  guardedSource.dispatchEvent(event)
}
send('discarded-strictmode-mount');assert.equal(guardedSource.closed,false)
send('current-mount','http://another-origin');assert.equal(guardedSource.closed,false)
send('current-mount',origin,{});assert.equal(guardedSource.closed,false)
send('current-mount');assert.equal(guardedSource.closed,true)
console.log('PASS readiness ignores stale StrictMode mounts, other origins and other windows')
