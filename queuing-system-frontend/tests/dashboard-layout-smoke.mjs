import { build } from 'esbuild'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import assert from 'node:assert/strict'
await build({ entryPoints:['src/pages/AdminPanel.jsx'], outfile:'tests/.compiled/dashboard-preview.mjs', bundle:true, platform:'node', format:'esm', packages:'external', jsx:'automatic', loader:{'.css':'empty'} })
globalThis.localStorage = { getItem:()=>null }
globalThis.window = { atob:globalThis.atob, btoa:globalThis.btoa, innerWidth:1440, innerHeight:900, localStorage:globalThis.localStorage }
const {default:Dashboard}=await import('./.compiled/dashboard-preview.mjs')
const html=renderToString(React.createElement(MemoryRouter,null,React.createElement(Dashboard,{user:{full_name:'Dashboard Preview',role:'admin'}})))
assert.equal((html.match(/class="kpi-card /g)||[]).length,6)
for(const title of ['Service Performance by Office','Completed Ticket Share by Office','Staff Performance','Recent Alerts','Priority vs Regular Tickets']) assert.ok(html.includes(title),title)
assert.ok(html.includes('dashboard-refresh'))
console.log('Dashboard render passed: six KPIs, all requested cards, office table and chart.')

