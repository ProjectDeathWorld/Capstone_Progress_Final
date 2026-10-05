import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs/promises'

const source=(await fs.readFile(new URL('../src/api.js',import.meta.url),'utf8')).replaceAll('export async function','async function')
const shared=new Map()
const storage=map=>({getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)})
function openView(token) {
  const session=storage(new Map([['token',token]]))
  const context=vm.createContext({sessionStorage:session,localStorage:storage(shared),AbortController,setTimeout,clearTimeout,Event,window:{dispatchEvent(){}},fetch:async(url,options)=>{
    const auth=options.headers.Authorization
    const id=auth==='Bearer cashier-token'?1:9
    return {ok:true,json:async()=>({ticket:{ticket_id:id,service_type:id===1?'C':'R'},transaction:{staff_id:id}})}
  }})
  vm.runInContext(source,context)
  return {session,current:()=>vm.runInContext('getCurrentStaffTicket()',context)}
}
const cashier=openView('cashier-token')
shared.set('token','registrar-token') // The original bug: another login overwrites shared storage.
const registrar=openView('registrar-token')
for(const view of [cashier,openView(cashier.session.getItem('token'))]) {
  assert.equal((await view.current()).ticket.service_type,'C')
  assert.equal((await view.current()).transaction.staff_id,1)
}
assert.equal((await registrar.current()).ticket.service_type,'R')
registrar.session.removeItem('token')
assert.equal((await cashier.current()).ticket.service_type,'C')
console.log('PASS cross-window login/logout isolation and Full/Mini/refresh token restoration')

import { build } from 'esbuild'
import React from 'react'
import Renderer, { act } from 'react-test-renderer'
import { MemoryRouter } from 'react-router-dom'
await build({entryPoints:['src/App.jsx'],outfile:'tests/.compiled/AuthRouting.js',bundle:true,format:'esm',platform:'node',jsx:'automatic',packages:'external',external:['react','react/jsx-runtime'],plugins:[{name:'fixture',setup(b){
 b.onResolve({filter:/\/api$/},()=>({path:'api',namespace:'mock'}))
 b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:['login','getMe','logout','logoutStaff'].map(n=>`export const ${n}=(...args)=>globalThis.testApi.${n}(...args);`).join('\n')}))
 b.onResolve({filter:/\/pages\/(Kiosk|QueueDisplay|StaffPanel|AdminPanel)$/},a=>({path:a.path.split('/').at(-1),namespace:'page'}))
 b.onLoad({filter:/.*/,namespace:'page'},a=>({contents:`import React from 'react'; export default p=>React.createElement('div',{'data-page':'${a.path}','data-user':p.user?.user_id});`}))
}}]})
const App=(await import('./.compiled/AuthRouting.js')).default
const flush=async fn=>act(async()=>{await fn?.();await Promise.resolve()})
for(const position of ['cashier','registrar']) {
 const user={user_id:position==='cashier'?1:9,username:position+'1',position,role:'staff',full_name:position},token=position+'-token'
 globalThis.sessionStorage=storage(new Map());globalThis.localStorage=storage(shared)
 const popup={closed:false,sessionStorage:storage(new Map()),focus(){},location:{replace(path){this.path=path}}}
 globalThis.window=Object.assign(new EventTarget(),{name:'',location:{origin:'http://localhost:3000'},open(){return popup},focus(){}})
 globalThis.testApi={login:async()=>({user,token}),getMe:async()=>user,logout:async()=>({}),logoutStaff:async()=>({})}
 let tree
 const mount=path=>flush(()=>{tree=Renderer.create(React.createElement(MemoryRouter,{initialEntries:[path],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(App)))})
 await mount('/login');await flush(()=>tree.root.findByType('form').props.onSubmit({preventDefault(){}}))
 assert.equal(sessionStorage.getItem('token'),token);assert.equal(popup.sessionStorage.getItem('token'),token);assert.equal(popup.location.path,'/staff?view=mini')
 await flush(()=>tree.unmount());globalThis.sessionStorage=popup.sessionStorage
 for(const path of ['/staff?view=mini','/staff']) {
  await mount(path);assert.equal(tree.root.findByProps({'data-page':'StaffPanel'}).props['data-user'],user.user_id)
  const event=new Event('message');Object.assign(event,{origin:window.location.origin,source:{},data:{type:'STAFF_MINI_LOGOUT_COMPLETE',token:'unrelated-session'}})
  await flush(()=>window.dispatchEvent(event));assert.equal(sessionStorage.getItem('token'),token)
  assert.equal(tree.root.findByProps({'data-page':'StaffPanel'}).props['data-user'],user.user_id);await flush(()=>tree.unmount())
 }
 console.log(`PASS ${position}: popup credentials, Full/Mini reload identity, unrelated logout ignored`)
}

