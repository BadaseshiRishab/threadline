// Sends one real test SMS with the settings in seller/backend/.env, to check the SMS setup (e.g. the Android phone
// gateway) before relying on it for OTPs. Usage: npm run sms:test -- 98XXXXXXXX
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const envFile = path.join(root, 'seller/backend/.env')
try {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
} catch {
  console.error(`Could not read ${envFile}.`)
  process.exit(1)
}
// A test should really send, never just print to the console.
process.env.OTP_DEV_CONSOLE = 'false'

const phone = String(process.argv[2] || '').replace(/[\s-]/g, '').replace(/^(\+91|0)/, '')
if (!/^[6-9]\d{9}$/.test(phone)) {
  console.error('Give a 10-digit Indian mobile number: npm run sms:test -- 98XXXXXXXX')
  process.exit(1)
}

const { logMessagingSetup, sendSms } = await import('../shared/notify.js')
logMessagingSetup('sms:test')
const code = String(Math.floor(1000 + Math.random() * 9000))
try {
  await sendSms(phone, `Threadline test message. If you can read this, SMS works. Test code ${code}.`)
  console.log(`Sent to +91${phone} (test code ${code}). It should arrive within a minute.`)
} catch (error) {
  console.error(`Not sent: ${error.message}`)
  // Let Node exit on its own: process.exit() while a request is closing trips a libuv assertion on Windows.
  process.exitCode = 1
}
