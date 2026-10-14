import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { Customer, Verification } from '../models/index.js'
import { channelEnabled, checkCode, sendCode, useCode } from '../../../../shared/otp.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { settings } from '../../../../shared/settings.js'
import { indianMobileMessage, normalizeIndianMobile } from '../utils/indianMobile.js'
import { clearSessionCookie, requireAuth, setSessionCookie } from '../middleware/auth.js'

const router = Router()
// Customers sign up with an address at CUSTOMER_EMAIL_DOMAIN (gmail.com by default).
const emailDomain = settings.customerEmailDomain
const emailPattern = new RegExp(`^[^\\s@]+@${emailDomain.replace(/\./g, '\\.')}$`, 'i')
const emailLabel = emailDomain === 'gmail.com' ? 'Gmail address' : `@${emailDomain} email address`
const minPassword = settings.customerPasswordMinLength
const safeUser = (user) => ({ id: user.id, email: user.email, phone: user.phone, role: user.role, profile: user.customerProfile ?? {} })

// Mobile verification at sign-up is required whenever SMS is configured (and always in production). The email address
// is only checked for format and uniqueness.
const signupOtpRequired = () => process.env.NODE_ENV === 'production' || channelEnabled('phone')
const otpLabel = 'Threadline'
// Login codes go to whichever the customer typed: their email address by email, or their mobile number by SMS.
const loginTarget = (identifier) => {
  const value = String(identifier || '').trim()
  if (value.includes('@')) return { channel: 'email', address: value.toLowerCase(), query: { email: value.toLowerCase() } }
  const phone = normalizeIndianMobile(value)
  return phone ? { channel: 'phone', address: phone, query: { phone } } : null
}
const lockMessage = (user) => {
  const seconds = Math.ceil((user.loginLockedUntil - Date.now()) / 1000)
  return `Account is temporarily locked. Try again in ${seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} sec`}.`
}

// Tells the app which OTP features are available, so it only offers what will work.
router.get('/otp-config', (request, response) => response.json({ signupOtp: signupOtpRequired(), loginOtpPhone: channelEnabled('phone'), loginOtpEmail: channelEnabled('email') }))

// Sends a sign-up code to the mobile number.
router.post('/signup-otp', asyncHandler(async (request, response) => {
  const phone = normalizeIndianMobile(request.body.phone)
  if (!phone) return response.status(400).json({ message: indianMobileMessage })
  if (await Customer.exists({ phone })) return response.status(409).json({ message: 'That mobile number is already registered. Sign in or use another number.' })
  const failure = await sendCode(Verification, { purpose: 'customer-signup', channel: 'phone', address: phone, label: otpLabel })
  if (failure) return response.status(failure.status).json({ message: failure.message })
  return response.json({ message: `We sent a 6-digit code to ${phone}.` })
}))

router.post('/login-otp', asyncHandler(async (request, response) => {
  const target = loginTarget(request.body.identifier)
  if (!target) return response.status(400).json({ message: `Enter your ${emailLabel} or mobile number. ${indianMobileMessage}` })
  if (!channelEnabled(target.channel)) return response.status(503).json({ message: `Login with a code by ${target.channel === 'email' ? 'email' : 'SMS'} is not available right now. Use your password.` })
  const user = await Customer.findOne(target.query)
  if (!user) return response.status(404).json({ message: 'No account uses that email or mobile number. Sign up first.' })
  if (user.loginLockedUntil && user.loginLockedUntil > new Date()) return response.status(429).json({ message: lockMessage(user) })
  const failure = await sendCode(Verification, { purpose: 'customer-login', channel: target.channel, address: target.address, label: otpLabel })
  if (failure) return response.status(failure.status).json({ message: failure.message })
  return response.json({ message: target.channel === 'email' ? `We emailed a 6-digit code to ${target.address}.` : `We sent a 6-digit code to ${target.address}.` })
}))

router.post('/login-otp/verify', asyncHandler(async (request, response) => {
  const target = loginTarget(request.body.identifier)
  if (!target) return response.status(400).json({ message: `Enter your ${emailLabel} or mobile number.` })
  const user = await Customer.findOne(target.query)
  if (!user) return response.status(404).json({ message: 'No account uses that email or mobile number.' })
  if (user.loginLockedUntil && user.loginLockedUntil > new Date()) return response.status(429).json({ message: lockMessage(user) })
  const failure = await useCode(Verification, { purpose: 'customer-login', channel: target.channel, address: target.address, code: request.body.code })
  if (failure) return response.status(failure.status).json({ message: failure.message })
  if (user.failedLoginAttempts || user.loginLockLevel || user.loginLockedUntil) {
    user.failedLoginAttempts = 0
    user.loginLockLevel = 0
    user.loginLockedUntil = null
    await user.save()
  }
  setSessionCookie(response, user)
  return response.json({ user: safeUser(user) })
}))

router.post('/register', asyncHandler(async (request, response) => {
  const email = String(request.body.email || '').trim().toLowerCase()
  const password = String(request.body.password || '')
  const phone = normalizeIndianMobile(request.body.phone)
  if (!phone) return response.status(400).json({ message: indianMobileMessage })
  if (!emailPattern.test(email) || password.length < minPassword) return response.status(400).json({ message: `Use a${/^[aeiou]/i.test(emailLabel) ? 'n' : ''} ${emailLabel} and a password of at least ${minPassword} characters.` })
  if (await Customer.exists({ email })) return response.status(409).json({ message: `That email is already registered. Sign in or use another ${emailLabel}.` })
  if (await Customer.exists({ phone })) return response.status(409).json({ message: 'That mobile number is already registered. Sign in or use another number.' })
  if (signupOtpRequired()) {
    const failure = await checkCode(Verification, { purpose: 'customer-signup', channel: 'phone', address: phone, code: request.body.otp })
    if (failure) return response.status(failure.status).json({ message: failure.status === 400 && !request.body.otp ? 'Verify your mobile number with the code we send you.' : `Mobile code: ${failure.message}` })
  }
  await Verification.deleteMany({ purpose: 'customer-signup', channel: 'phone', address: phone })
  const user = await Customer.create({ email, phone, passwordHash: await bcrypt.hash(password, 12), customerProfile: { name: String(request.body.name || '').trim() } })
  setSessionCookie(response, user)
  return response.status(201).json({ user: safeUser(user) })
}))

router.post('/login', asyncHandler(async (request, response) => {
  // Customers sign in with either their email address or their registered mobile number.
  const identifier = String(request.body.identifier ?? request.body.email ?? '').trim()
  let query
  if (identifier.includes('@')) query = { email: identifier.toLowerCase() }
  else {
    const phone = normalizeIndianMobile(identifier)
    if (!phone) return response.status(400).json({ message: indianMobileMessage })
    query = { phone }
  }
  const user = await Customer.findOne(query).select('+passwordHash')
  if (user?.loginLockedUntil && user.loginLockedUntil > new Date()) {
    const seconds = Math.ceil((user.loginLockedUntil - Date.now()) / 1000)
    return response.status(429).json({ message: `Account is temporarily locked. Try again in ${seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} sec`}.`, retryAfterSeconds: seconds })
  }
  if (!user || !(await bcrypt.compare(String(request.body.password || ''), user.passwordHash))) {
    if (!user) return response.status(401).json({ message: 'Email/mobile number or password is incorrect.' })
    user.failedLoginAttempts += 1
    // LOGIN_LOCK_FIRST_ATTEMPTS wrong attempts lock for LOGIN_LOCK_FIRST_MINUTES; the LOGIN_LOCK_SECOND_ATTEMPTS further
    // wrong attempts after that lock for LOGIN_LOCK_SECOND_MINUTES (3 for 1 minute, then 2 for 5 minutes by default).
    const lock = settings.loginLockStages[user.loginLockLevel]
    const stage = lock && { limit: lock.limit, lockMs: lock.lockMinutes * 60 * 1000 }
    if (stage && user.failedLoginAttempts >= stage.limit) {
      user.loginLockedUntil = new Date(Date.now() + stage.lockMs)
      user.loginLockLevel = user.loginLockLevel === 0 ? 1 : 0
      user.failedLoginAttempts = 0
      await user.save()
      return response.status(429).json({ message: `Too many wrong attempts. Account locked for ${stage.lockMs / 60000} min.`, retryAfterSeconds: stage.lockMs / 1000 })
    }
    await user.save()
    const left = stage.limit - user.failedLoginAttempts
    return response.status(401).json({ message: `Email/mobile number or password is incorrect. ${left} attempt${left === 1 ? '' : 's'} left before the account is locked.` })
  }
  if (user.failedLoginAttempts || user.loginLockLevel || user.loginLockedUntil) {
    user.failedLoginAttempts = 0
    user.loginLockLevel = 0
    user.loginLockedUntil = null
    await user.save()
  }
  setSessionCookie(response, user)
  return response.json({ user: safeUser(user) })
}))

router.get('/me', requireAuth, (request, response) => response.json({ user: safeUser(request.user) }))
router.post('/logout', (request, response) => { clearSessionCookie(response); return response.status(204).end() })

export default router
