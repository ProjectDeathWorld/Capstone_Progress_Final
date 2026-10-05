import assert from 'node:assert/strict'
import { build } from 'esbuild'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'
import { MemoryRouter } from 'react-router-dom'

await build({entryPoints:['src/App.jsx'],outfile:'tests/.compiled/StaffLauncher.js',bundle:true,format:'esm',platform:'node',jsx:'automatic',packages:'external',external:['react','react/jsx-runtime'],plugins:[{name:'launcher-fixture',setup(b){
  b.onResolve({filter:/\/api$/},()=>({path:'api',namespace:'mock'}))
  b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:['login','getMe','logout','logoutStaff'].map(n=>`export const ${n}=(...args)=>globalThis.testApi.${n}(...args);`).join('\n')}))
  b.onResolve({filter:/\/pages\/(Kiosk|QueueDisplay|StaffPanel|AdminPanel)$/},args=>({path:args.path.split('/').at(-1),namespace:'page'}))
  b.onLoad({filter:/.*/,namespace:'page'},args=>({contents:`import React from 'react'; export default function Page(props){return React.createElement('div',{'data-page':'${args.path}'},React.createElement('button',{onClick:props.onLogout,disabled:props.logoutPending},'Logout'));}`}))
}}]})
const App=(await import('./.compiled/StaffLauncher.js')).default
const staff={user_id:3,username:'registrar3',role:'staff',position:'registrar',full_name:'Registrar Staff 3'}
let user=staff, loginCount=0, requests=[], blocked=false, token=null, activated=0
Object.assign(globalThis,{
  localStorage:{getItem:()=>token,setItem:(key,value)=>token=value,removeItem:()=>token=null},
  window:Object.assign(new EventTarget(),{name:'',location:{origin:'http://localhost'},screen:{availWidth:1920,availHeight:1040,availLeft:0,availTop:0},resizeTo(){assert.fail('login must never resize')},open(...args){requests.push(args);return blocked?null:{closed:false,focus(){},__staffPresentationReady:{staffId:3,mode:'full'},__staffActivate(){activated++}}}}),
  testApi:{login:async()=>{loginCount++;return {user,token:'same-session'}},getMe:async()=>user,logout:async()=>({})},
})
const flush=async fn=>act(async()=>{await fn?.();await Promise.resolve()})
let tree
const mount=async(path='/login')=>flush(()=>{tree=Renderer.create(React.createElement(MemoryRouter,{initialEntries:[path],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(App)))})
const submit=()=>flush(()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}))
const unmount=()=>flush(()=>tree.unmount())
for (const position of ['cashier','registrar']) {
  user={...staff,position};token=null;requests=[];window.name=''
  await mount();await submit()
  assert.equal(token,'same-session')
  assert.equal(requests.length,0,'login stays in the current Staff tab; no launcher')
  assert.equal(tree.root.findAllByProps({'data-page':'StaffPanel'}).length,1)
  assert.equal(tree.root.findAllByProps({'data-page':'Kiosk'}).length,0)
  assert.equal(tree.root.findAllByType('form').length,0)
  await unmount()
  // Query strings select Staff presentation, never a public-route fallback.
  for(const path of ['/staff?view=mini','/staff']) {
    await mount(path)
    assert.equal(tree.root.findAllByProps({'data-page':'StaffPanel'}).length,1)
    assert.equal(tree.root.findAllByProps({'data-page':'Kiosk'}).length,0)
    assert.equal(token,'same-session')
    await unmount()
  }
  console.log(`PASS ${position}: same-tab Staff login and both Staff routes, no Kiosk or extra login`)
}

token=null;requests=[];window.name='';user={...staff,role:'admin'}
await mount();await submit()
assert.equal(requests.length,0)
assert.equal(tree.root.findAllByProps({'data-page':'AdminPanel'}).length,1)
await unmount()
console.log('PASS Staff-only routing and unchanged Admin routing')

for(const mode of ['full','mini']) {
  user=staff;token='same-session';requests=[];window.name=`qms-staff-${mode}-3`
  let paused=0,resumed=0,logoutCalls=0,resolveLogout,logoutPromise
  window.__staffPause=()=>paused++
  window.__staffResume=()=>resumed++
  testApi.logoutStaff=()=>{logoutCalls++;return new Promise(resolve=>resolveLogout=resolve)}
  await mount(mode==='mini'?'/staff?view=mini':'/staff')
  const getLogout=()=>tree.root.findByProps({'data-page':'StaffPanel'}).findByType('button')
  const started=performance.now()
  await flush(()=>{logoutPromise=getLogout().props.onClick();getLogout().props.onClick()})
  const feedbackMs=performance.now()-started
  assert.equal(paused,1);assert.equal(logoutCalls,1)
  assert.equal(getLogout().props.disabled,true)
  assert.equal(token,'same-session','do not clear authentication before backend success')
  const succeeded=performance.now()
  await flush(async()=>{resolveLogout({});await logoutPromise})
  assert.equal(token,null);assert.equal(tree.root.findAllByType('form').length,1)
  assert.equal(requests.length,0,'logout never opens/restores a window')
  console.log(`SIMULATED ${mode} logout: UI pause/feedback ${feedbackMs.toFixed(2)} ms; server-success to Login ${(performance.now()-succeeded).toFixed(2)} ms (network excluded)`)
  await unmount()
}
user=staff;token='same-session';window.name='qms-staff-full-3'
let resumed=0
window.__staffResume=()=>resumed++
testApi.logoutStaff=async()=>{throw new Error('Server unavailable')}
await mount('/staff')
await flush(()=>tree.root.findByProps({'data-page':'StaffPanel'}).findByType('button').props.onClick())
assert.equal(token,'same-session');assert.equal(resumed,1)
assert.equal(tree.root.findByProps({'data-page':'StaffPanel'}).findByType('button').props.disabled,false)
await unmount()
console.log('PASS secure logout: one request, immediate pause, success-only cleanup, no restore and failure recovery')
