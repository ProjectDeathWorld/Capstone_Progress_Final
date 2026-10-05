import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../src/hooks/useAdminPolling.js', import.meta.url), 'utf8')
  .replace(/^import [^\n]*\n/, '').replaceAll('export ', '')
function setup(refresh) {
  let cleanup, tick, cleared = false, interval
  const document = new EventTarget(); document.hidden = false
  const window = new EventTarget()
  const context = vm.createContext({ document, window, AbortController,
    useRef: current => ({ current }), useEffect: effect => { cleanup = effect() },
    setInterval: (callback, ms) => { tick = callback; interval = ms; return 1 },
    clearInterval: () => { cleared = true } })
  vm.runInContext(source, context)
  context.useAdminPolling(refresh, 'monitoring')
  return { document, window, tick: () => tick(), cleanup: () => cleanup(), get cleared() { return cleared }, get interval() { return interval } }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
test('immediate fetch, six silent cycles in a minute, cleanup aborts and stops updates', async () => {
  let calls = 0, signal
  const env = setup(async current => { calls++; signal = current })
  assert.equal(calls, 1); assert.equal(env.interval, 10000)
  await flush()
  for (let i = 0; i < 6; i++) { env.tick(); await flush() }
  assert.equal(calls, 7)
  env.cleanup(); assert.equal(signal.aborted, true); assert.equal(env.cleared, true)
  env.tick(); assert.equal(calls, 7)
})
test('slow requests do not overlap and action invalidations coalesce', async () => {
  let calls = 0, resolve
  const env = setup(() => { calls++; return new Promise(done => { resolve = done }) })
  for (let i = 0; i < 6; i++) env.tick()
  assert.equal(calls, 1)
  env.window.dispatchEvent(new Event('queue-data-changed'))
  env.window.dispatchEvent(new Event('queue-data-changed'))
  resolve(); await flush(); assert.equal(calls, 2)
  env.cleanup(); resolve(); await flush(); assert.equal(calls, 2)
})
test('failures recover and hidden tabs refresh immediately on return', async () => {
  let calls = 0
  const env = setup(async () => { calls++; if (calls === 1) throw Error('timeout') })
  await flush(); env.tick(); await flush(); assert.equal(calls, 2)
  env.document.hidden = true; env.tick(); assert.equal(calls, 2)
  env.document.hidden = false; env.document.dispatchEvent(new Event('visibilitychange'))
  await flush(); assert.equal(calls, 3); env.cleanup()
})
