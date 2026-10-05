import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const backendDir = path.resolve(frontendDir, '..', 'queuing-system-backend')
const viteBin = path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js')

const children = []
let stopping = false

function start(command, args, cwd, label) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
  })

  child.on('error', (error) => {
    console.error(`[${label}] Could not start: ${error.message}`)
    stop(1)
  })

  child.on('exit', (code) => {
    if (!stopping && code !== 0) {
      console.error(`[${label}] Exited with code ${code}.`)
      stop(code ?? 1)
    }
  })

  children.push(child)
}

function stop(exitCode = 0) {
  if (stopping) return
  stopping = true

  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }

  setTimeout(() => process.exit(exitCode), 250)
}

console.log('Starting Laravel API at http://127.0.0.1:8000 ...')
console.log('Starting frontend at http://localhost:3000 ...')
console.log('XAMPP MySQL must be running for database access.\n')

start('php', ['artisan', 'serve', '--host=127.0.0.1', '--port=8000'], backendDir, 'Laravel')
start(process.execPath, [viteBin], frontendDir, 'Vite')

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
