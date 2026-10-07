// Opens an SSH tunnel so this computer can use the MongoDB running in Docker on the AWS server, without exposing
// MongoDB to the internet: 127.0.0.1:27019 here leads to 127.0.0.1:27018 on the server (see docker-compose.yml).
// Keep it running while you use `npm run dev`; stop it with Ctrl+C.
//   npm run db:tunnel -- C:\path\to\threadline.pem
// AWS_HOST (the server's IP) and AWS_SSH_KEY (the .pem path) are read from seller/backend/.env if not given.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const fromEnvFile = {}
try {
  for (const line of readFileSync(path.join(root, 'seller/backend/.env'), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(AWS_HOST|AWS_SSH_KEY|AWS_SSH_USER)\s*=\s*(.*?)\s*$/)
    if (match) fromEnvFile[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
} catch { /* no .env: rely on arguments and environment */ }
const setting = (name, fallback = '') => process.env[name] || fromEnvFile[name] || fallback

const key = process.argv[2] || setting('AWS_SSH_KEY')
const host = setting('AWS_HOST')
const user = setting('AWS_SSH_USER', 'ubuntu')
const localPort = 27019
const serverPort = Number(setting('MONGO_HOST_PORT', '27018'))

if (!host) {
  console.error('Set AWS_HOST=<server IP> in seller/backend/.env.')
  process.exit(1)
}
if (!key || !existsSync(key)) {
  console.error(key ? `Key file not found: ${key}` : 'Give the path to your .pem key: npm run db:tunnel -- C:\\path\\to\\threadline.pem (or set AWS_SSH_KEY in seller/backend/.env).')
  process.exit(1)
}

console.log(`Tunnel: 127.0.0.1:${localPort} -> ${host} (MongoDB on the server's 127.0.0.1:${serverPort}). Ctrl+C to stop.`)
const ssh = spawn('ssh', [
  '-i', key, '-N',
  '-L', `${localPort}:127.0.0.1:${serverPort}`,
  '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3',
  `${user}@${host}`,
], { stdio: 'inherit' })
ssh.on('exit', (code) => {
  if (code) console.error(`ssh exited with code ${code}. Check the key, that ${host} allows SSH from your IP, and that Docker is running on the server.`)
  process.exitCode = code ?? 0
})
