// Starts every Threadline API and web app locally with `npm run dev` from the workspace root.
// Output from each app is prefixed with its name; Ctrl+C stops them all.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const apps = [
  { name: 'seller-api', dir: 'seller/backend', color: 33, url: 'http://localhost:4001' },
  { name: 'admin-api', dir: 'admin/backend', color: 35, url: 'http://localhost:4002' },
  { name: 'user-api', dir: 'user/backend', color: 36, url: 'http://localhost:4003' },
  { name: 'deliv-api', dir: 'delivery/backend', color: 32, url: 'http://localhost:4004' },
  { name: 'seller-web', dir: 'seller/frontend', color: 93, url: 'http://localhost:5173' },
  { name: 'admin-web', dir: 'admin/frontend', color: 95, url: 'http://localhost:5174' },
  { name: 'user-web', dir: 'user/frontend', color: 96, url: 'http://localhost:5175' },
  { name: 'deliv-web', dir: 'delivery/frontend', color: 92, url: 'http://localhost:5176' },
]

const missing = apps.filter((app) => !existsSync(path.join(root, app.dir, 'node_modules')))
if (missing.length) {
  console.error(`Install dependencies first (npm run setup). Missing node_modules in: ${missing.map((app) => app.dir).join(', ')}`)
  process.exit(1)
}

// When the .env points at the AWS database through the SSH tunnel (127.0.0.1:27019), say so if the tunnel is not open.
const mongoUri = (() => { try { return readFileSync(path.join(root, 'seller/backend/.env'), 'utf8').match(/^\s*MONGODB_URI\s*=\s*["']?([^"'\r\n]*)/m)?.[1] || '' } catch { return '' } })()
if (/\/\/(127\.0\.0\.1|localhost):27019\//.test(mongoUri)) {
  const open = await new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: 27019, timeout: 1500 }, () => { socket.end(); resolve(true) })
    socket.on('error', () => resolve(false)).on('timeout', () => { socket.destroy(); resolve(false) })
  })
  if (!open) console.warn('\x1b[33mThe database is the AWS server, reached through an SSH tunnel that is not open.\nIn another terminal run: npm run db:tunnel -- C:\\path\\to\\your-key.pem\x1b[0m\n')
}

const children = apps.map((app) => {
  const child = spawn('npm', ['run', 'dev'], { cwd: path.join(root, app.dir), shell: true, env: { ...process.env, FORCE_COLOR: '1' } })
  const label = `\x1b[${app.color}m${app.name.padEnd(10)}\x1b[0m │ `
  const pipe = (stream, target) => {
    let buffer = ''
    stream.on('data', (chunk) => {
      buffer += chunk
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop()
      for (const line of lines) target.write(label + line + '\n')
    })
  }
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code) => console.log(`${label}exited with code ${code}`))
  return child
})

console.log('\nThreadline is starting:')
for (const app of apps) console.log(`  ${app.name.padEnd(10)} ${app.url}`)
console.log('Press Ctrl+C to stop everything.\n')

let stopping = false
const stopAll = () => {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode !== null) continue
    // npm runs through a shell on Windows, so kill the whole process tree.
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' })
    else child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(0), 1500)
}
process.on('SIGINT', stopAll)
process.on('SIGTERM', stopAll)
