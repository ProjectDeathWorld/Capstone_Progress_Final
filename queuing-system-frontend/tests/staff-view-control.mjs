import assert from 'node:assert/strict'
import { createStaffViewControl } from '../src/utils/staffViewControl.js'
import { restoreStaffWindow } from '../src/utils/staffMiniWindow.js'

for (const broadcast of [true, false]) {
  const values=new Map(), hosts=[], channels=[]
  let sequence=0
  class Channel {
    constructor(name){this.name=name;channels.push(this)}
    postMessage(data){for(const peer of channels)if(peer!==this&&peer.name===this.name&&!peer.closed)peer.onmessage?.({data})}
    close(){this.closed=true}
  }
  function host(opener=null){
    const result=Object.assign(new EventTarget(),{opener,crypto:{randomUUID:()=>String(++sequence)}})
    if(broadcast)result.BroadcastChannel=Channel
    result.localStorage={getItem:key=>values.get(key)??null,setItem(key,value){values.set(key,value);for(const peer of hosts)if(peer!==result){const e=new Event('storage');Object.assign(e,{key,newValue:value});peer.dispatchEvent(e)}}}
    hosts.push(result)
    return result
  }
  const fullHost=host(),miniHost=host(fullHost)
  let fullActive=false,miniActive=false
  const full=createStaffViewControl(fullHost,3,'full',value=>fullActive=value)
  const mini=createStaffViewControl(miniHost,3,'mini',value=>miniActive=value)
  assert.equal(fullActive,true);assert.equal(miniActive,false,'new Mini is standby until backend readiness')
  mini.ready()
  assert.equal(full.active(),true,'READY alone does not grant transaction ownership')
  full.transfer(mini.id,'mini')
  assert.equal(fullActive,false);assert.equal(miniActive,true)
  assert.equal(full.active(),false);assert.equal(mini.active(),true)
  mini.transfer(full.id,'full')
  assert.equal(fullActive,true);assert.equal(miniActive,false)
  full.transfer(mini.id,'mini')
  miniHost.dispatchEvent(new Event('pagehide'))
  assert.equal(full.active(),true,'browser X reactivates surviving Full')
  assert.equal(mini.active(),false)
  mini.dispose()

  const nextHost=host(fullHost)
  let nextActive=false
  const next=createStaffViewControl(nextHost,3,'mini',value=>nextActive=value)
  full.transfer(next.id,'mini')
  full.dispose()
  assert.equal(next.active(),true,'Mini does not depend on its opener surviving')
  assert.equal(nextActive,true)
  const restoredHost=host(nextHost)
  const restored=createStaffViewControl(restoredHost,3,'full',()=>{})
  assert.equal(restored.active(),false,'new Full waits for readiness and transfer')
  next.transfer(restored.id,'full')
  next.dispose()
  assert.equal(restored.active(),true)
  const owner=JSON.parse(values.get('qms-staff-view-3'))
  assert.deepEqual(Object.keys(owner).sort(),['id','mode'],'storage contains coordination only')
  restored.dispose()
  assert.equal(channels.every(channel=>channel.closed),true)
  console.log(`PASS ${broadcast?'BroadcastChannel':'storage-event fallback'}: exclusive ownership, readiness, repeat restore, browser X, opener closure and cleanup`)
}
let opened=0
const prior={closed:false,location:{origin:'http://localhost',pathname:'/staff',search:''},__staffPrepare(){assert.fail('never reactivate an old manual Full tab')}}
const destination={closed:false,focus(){}}
assert.equal(restoreStaffWindow({opener:prior,screen:{availWidth:1920,availHeight:1040},open(url,name,features){opened++;assert.equal(url,'/staff');assert.equal(name,'qms-staff-full-3');assert.match(features,/width=1920,height=1040/);return destination}},3),destination)
assert.equal(opened,1)
console.log('PASS restore opens a script-created full-size operational window, not the original manual tab')
