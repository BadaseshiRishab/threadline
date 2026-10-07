// One-time verification codes for sign-up and login, sent by SMS or email (see notify.js). Codes are 6 digits,
// expire after 10 minutes and allow 5 wrong attempts. Each code belongs to a purpose, e.g. "customer-login", so a
// sign-up code cannot be used to log in. Takes the Verification model instead of importing mongoose, like models.js.
//
// The code is created here, stored only as an HMAC (OTP_SECRET) and sent as a normal SMS or email.
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { emailConfigured, sendEmail, sendSms, smsConfigured } from './notify.js'

const lifetimeMs = 10 * 60 * 1000
const resendAfterMs = 30 * 1000
const maxAttempts = 5

export const channelEnabled = (channel) => channel === 'email' ? emailConfigured() : smsConfigured()

const hashCode = (purpose, channel, address, code) => {
  if (!process.env.OTP_SECRET) throw new Error('OTP_SECRET is not configured.')
  return createHmac('sha256', process.env.OTP_SECRET).update(`${purpose}:${channel}:${address}:${code}`).digest('hex')
}
const sameHash = (left, right) => left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right))

// Sends a fresh code. Returns { status, message } on failure (cooldown, sending error) or null when sent.
export async function sendCode(Verification, { purpose, channel, address, label = 'Threadline' }) {
  const existing = await Verification.findOne({ purpose, channel, address }).lean()
  if (existing && Date.now() - new Date(existing.updatedAt).getTime() < resendAfterMs) {
    const wait = Math.ceil((resendAfterMs - (Date.now() - new Date(existing.updatedAt).getTime())) / 1000)
    return { status: 429, message: `Please wait ${wait} seconds before requesting another code.` }
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const text = `${code} is your ${label} verification code. It expires in 10 minutes. Do not share it with anyone.`
  try {
    if (channel === 'email') await sendEmail(address, `Your ${label} verification code`, text)
    else await sendSms(address, text)
  } catch (error) {
    console.error(`Could not send ${purpose} code:`, error.message)
    return { status: 502, message: `We could not send the code by ${channel === 'email' ? 'email' : 'SMS'}. Please try again in a moment.` }
  }
  await Verification.findOneAndUpdate(
    { purpose, channel, address },
    { codeHash: hashCode(purpose, channel, address, code), expiresAt: new Date(Date.now() + lifetimeMs), verifiedAt: null, attempts: 0 },
    { upsert: true, setDefaultsOnInsert: true },
  )
  return null
}

// Checks a code without using it up. Returns { status, message } when it is wrong or expired, or null when correct.
export async function checkCode(Verification, { purpose, channel, address, code }) {
  if (!/^\d{4,10}$/.test(String(code || ''))) return { status: 400, message: 'Enter the 6-digit code.' }
  const challenge = await Verification.findOne({ purpose, channel, address })
  if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= maxAttempts) return { status: 400, message: 'That code has expired. Request a new one.' }
  const correct = sameHash(challenge.codeHash, hashCode(purpose, channel, address, String(code)))
  if (!correct) {
    challenge.attempts += 1
    await challenge.save()
    const left = maxAttempts - challenge.attempts
    return { status: 400, message: left ? `That code is incorrect. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Request a new code.' }
  }
  return null
}

// Checks a code and uses it up, so it cannot be used twice.
export async function useCode(Verification, request) {
  const failure = await checkCode(Verification, request)
  if (!failure) await Verification.deleteOne({ purpose: request.purpose, channel: request.channel, address: request.address })
  return failure
}
