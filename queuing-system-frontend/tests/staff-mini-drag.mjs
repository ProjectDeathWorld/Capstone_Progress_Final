import assert from 'node:assert/strict'
import { attachMiniWindowDrag } from '../src/utils/staffMiniDrag.js'
const moves=[]
const host=Object.assign(new EventTarget(),{screenX:100,screenY:200,outerWidth:480,outerHeight:760,moveTo(x,y){moves.push([x,y])},resizeTo(){assert.fail('drag must never resize')}})
const handle=Object.assign(new EventTarget(),{classList:{add(){},remove(){}},setPointerCapture(){},hasPointerCapture(){return false}})
const send=(type,props={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,{pointerId:1,button:0,screenX:120,screenY:220,...props});handle.dispatchEvent(event)}
const cleanup=attachMiniWindowDrag(host,handle)
send('pointerdown');send('pointermove',{screenX:170,screenY:250})
assert.deepEqual(moves,[[150,230]])
assert.equal(host.outerWidth,480);assert.equal(host.outerHeight,760)
send('pointercancel');send('pointermove');assert.equal(moves.length,1)
send('pointerdown');host.dispatchEvent(new Event('blur'));send('pointermove');assert.equal(moves.length,1)
cleanup();send('pointerdown');send('pointermove');assert.equal(moves.length,1)
console.log('PASS real Mini window movement, fixed dimensions, cancellation and listener cleanup')
