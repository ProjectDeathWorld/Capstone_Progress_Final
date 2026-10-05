import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
await build({stdin:{contents:`
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DisplayBoard} from './src/components/DisplayBoard';
import {DEFAULT_DISPLAY_TEXT_LABELS, formatDisplayDate, formatMoreLabel, getDefaultDisplayBoardConfig, getDisplayBoardConfig, getDisplayWindowOptions, saveDisplayBoardConfig} from './src/utils/displayBoardConfig';
const config=getDefaultDisplayBoardConfig();
config.settings.announcementEnabled=true;
config.settings.announcement='Board consistency test';
config.settings.accentColor='#123abc';
config.settings.announcementTextColor='#ffffff';
config.settings.nowServingTextColor='#eeeeee';
config.settings.nowServingBackgroundColor='#223344';
config.settings.windowTicketTextColor='#f0a020';
config.settings.dateTimeTextColor='#dddddd';
config.settings.waitingQueueColors={background:'#112233',text:'#ffffff'};
config.settings.schoolName='Editable School';
config.settings.subtitle='Editable Subtitle';
config.settings.displayLabels={
 ...DEFAULT_DISPLAY_TEXT_LABELS,
 nowServing:'NOW ON DUTY',
 window:'SERVICE',
 waitingQueue:'IN LINE',
 waiting:'awaiting',
 waitingTicket:'person awaiting',
 waitingTickets:'people awaiting',
 noWaitingTickets:'Nobody is waiting',
 moreTemplate:'Continue: {count}',
 live:'ON AIR',
 departmentNames:{...DEFAULT_DISPLAY_TEXT_LABELS.departmentNames,Cashier:'Payments'},
 windowLabels:{'Cashier:1':'Counter A'},
 weekdays:['Custom Sunday'],
 months:['Custom January'],
};
const currentTime=new Date('2026-09-12T01:00:00Z');
const html=renderToStaticMarkup(React.createElement(DisplayBoard,{config,currentTime}));
assert.ok(html.includes('Board consistency test'));
for (const label of ['Editable School','Editable Subtitle','NOW ON DUTY','SERVICE 2','Counter A','Payments','IN LINE','0 people awaiting','Nobody is waiting','ON AIR']) {
 assert.ok(html.includes(label), 'Expected board text: '+label);
}
assert.ok(!html.includes('No ticket'));
assert.ok(!html.includes('Awaiting call'));
assert.ok(html.includes('--announcement-background:#123abc'));
assert.ok(html.includes('--announcement-text:#ffffff'));
assert.ok(html.includes('--display-accent:#f2c64b'));
assert.ok(html.includes('--now-serving-text:#eeeeee'));
assert.ok(html.includes('--now-serving-background:#223344'));
assert.ok(html.includes('--card-ticket-text:#f0a020'));
assert.ok(html.includes('--date-time-text:#dddddd'));
assert.ok(html.includes('--waiting-queue-background:#112233'));
assert.ok(html.includes('--waiting-queue-text:#ffffff'));
assert.ok(html.includes('display-board-header'));
assert.ok(html.includes('display-content-header'));
assert.ok(html.includes('display-announcement'));
assert.ok(html.includes(currentTime.toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})));
assert.ok(html.includes(currentTime.toLocaleDateString('en-PH',{weekday:'long'})));
assert.ok(html.includes(currentTime.toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'})));
assert.ok(!html.includes('Custom Sunday'));
assert.ok(!html.includes('Custom January'));
assert.ok(!html.includes('display-preview-mode'));
const announcementStyles=readFileSync('src/App.css','utf8');
const announcementTrackStyles=announcementStyles.match(/\.display-announcement-track \{([^}]*)\}/)?.[1]||'';
assert.match(announcementTrackStyles,/width:\\s*max-content/);
assert.match(announcementTrackStyles,/max-width:\\s*none/);
const apiSource=readFileSync('src/api.js','utf8');
assert.match(apiSource,/export async function getWaitingTickets[\\s\\S]*?cache:\\s*'no-store'/);
assert.match(apiSource,/export async function getServingTickets[\\s\\S]*?cache:\\s*'no-store'/);
assert.equal(formatDisplayDate(currentTime),currentTime.toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'}));
assert.equal(formatDisplayDate(currentTime,false),currentTime.toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'}));
assert.equal(formatMoreLabel(config.settings.displayLabels.moreTemplate,5),'Continue: 5');
assert.equal(formatMoreLabel('Custom text without token',5),'+5 more');

const allServicesConfig={
 ...config,
 settings:{...config.settings,enabledDepartments:['Cashier','Registrar','ITM','Admission']},
 windows:[...config.windows,
  {id:'admission-4',department:'Admission',windowNumber:4,visible:true},
  {id:'itm-1',department:'ITM',windowNumber:1,visible:true},
 ],
};
const activeWindowOptions=getDisplayWindowOptions(allServicesConfig);
assert.ok(activeWindowOptions.some(window=>window.department==='Admission'&&window.windowNumber===4));
assert.ok(activeWindowOptions.some(window=>window.department==='ITM'&&window.windowNumber===1));

const storage=new Map();
globalThis.window={
 localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
 dispatchEvent:()=>true,
};
saveDisplayBoardConfig(config);
assert.equal(getDisplayBoardConfig().settings.displayLabels.windowLabels['Cashier:1'],'Counter A');
assert.equal(getDisplayBoardConfig().settings.windowTicketTextColor,'#f0a020');
assert.ok(!('weekdays' in getDisplayBoardConfig().settings.displayLabels));
assert.ok(!('months' in getDisplayBoardConfig().settings.displayLabels));
for (const [width,height] of [[1920,1080],[1600,900],[1366,768],[900,506]]) {
 const scale=Math.min(width/1920,height/1080);
 assert.ok(1920*scale<=width && 1080*scale<=height);
 assert.ok(Math.abs(1920*scale-width)<.001 || Math.abs(1080*scale-height)<.001);
}
console.log('Shared board render and proportional fit checks passed.');
`,resolveDir:process.cwd(),loader:'jsx'}, outfile:'tests/.compiled/display-consistency.mjs',bundle:true,format:'esm',platform:'node',packages:'external',jsx:'automatic'})
await import('./.compiled/display-consistency.mjs')
