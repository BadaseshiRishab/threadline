// Exports the Threadline database from the docker-compose MongoDB to db-export/threadline-<date>.archive.gz, for
// moving it to another server (see DEPLOY.md). Run `npm run docker:copy-db -- --force` first if the data you want is
// in the MongoDB used by `npm run dev`. The file holds personal data: keep it out of git (it is in .gitignore).
import { execFileSync } from 'node:child_process'
import { mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const name = `threadline-${new Date().toISOString().slice(0, 10)}.archive.gz`
const output = path.join(root, 'db-export', name)
const run = (...args) => execFileSync('docker', ['compose', ...args], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] })

try {
  mkdirSync(path.dirname(output), { recursive: true })
  // mongodump writes inside the container, then the file is copied out (piping binary output through a shell can corrupt it).
  run('exec', '-T', 'mongo', 'mongodump', '--quiet', '--db', 'threadline', '--gzip', '--archive=/tmp/threadline.archive.gz')
  run('cp', 'mongo:/tmp/threadline.archive.gz', output)
  run('exec', '-T', 'mongo', 'rm', '-f', '/tmp/threadline.archive.gz')
  console.log(`Exported to ${path.relative(root, output)} (${(statSync(output).size / 1024).toFixed(0)} KB)`)
} catch (error) {
  console.error('Export failed. Is `docker compose up` running?', error.message)
  process.exitCode = 1
}
