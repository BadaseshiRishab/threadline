import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { Seller } from '../models/index.js'
import Verification from '../models/Verification.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { accountModel, sessionCookieName, requireAuth, setSessionCookie } from '../middleware/auth.js'
import { channelEnabled, checkCode, sendCode } from '../../../../shared/otp.js'

const router = Router()
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^[6-9]\d{9}$/

// Sellers verify their mobile number with an SMS code whenever SMS is configured (always in production). The email
// address is only checked for format and uniqueness. Codes are sent and checked by the shared OTP helper.
const purpose = 'seller-signup'
function phoneOtpEnabled() {
  return process.env.NODE_ENV === 'production' || channelEnabled('phone')
}

function safeUser(user) {
  return { id: user.id, email: user.email, phone: user.phone ?? '', role: user.role, sellerStatus: user.sellerStatus }
}

router.get('/verification/config', (request, response) => response.json({
  phoneOtpEnabled: phoneOtpEnabled(),
}))

// Only the mobile number is verified with a code.
router.post('/verification/send', asyncHandler(async (request, response) => {
  const address = String(request.body.address || '').replace(/\D/g, '')
  if (request.body.channel !== 'phone' || !phonePattern.test(address)) return response.status(400).json({ message: 'Enter a valid 10-digit Indian mobile number.' })
  if (!phoneOtpEnabled()) return response.status(503).json({ message: 'SMS verification is disabled in this development environment.' })
  if (await Seller.exists({ phone: address })) return response.status(409).json({ message: 'That phone is already registered.' })

  const failure = await sendCode(Verification, { purpose, channel: 'phone', address, label: 'Threadline seller' })
  if (failure) return response.status(failure.status).json({ message: failure.message })
  return response.json({ message: 'A verification code was sent to your phone.' })
}))

router.post('/verification/confirm', asyncHandler(async (request, response) => {
  const address = String(request.body.address || '').replace(/\D/g, '')
  const code = String(request.body.code || '').trim()
  if (request.body.channel !== 'phone' || !/^\d{6}$/.test(code)) return response.status(400).json({ message: 'Enter the 6-digit verification code.' })

  const failure = await checkCode(Verification, { purpose, channel: 'phone', address, code })
  if (failure) return response.status(failure.status).json({ message: failure.message })
  // Registration then looks for this verified record.
  await Verification.updateOne({ purpose, channel: 'phone', address }, { $set: { verifiedAt: new Date() } })
  return response.json({ message: 'Phone verified.' })
}))

router.post('/register', asyncHandler(async (request, response) => {
  if (request.app.get('authRole') === 'admin') return response.status(404).json({ message: 'Seller registration is unavailable on the admin service.' })
  const email = String(request.body.email || '').trim().toLowerCase()
  const phone = String(request.body.phone || '').replace(/\D/g, '')
  const password = String(request.body.password || '')
  if (!emailPattern.test(email) || !phonePattern.test(phone) || password.length < 10 || password.length > 128) {
    return response.status(400).json({ message: 'Enter a valid email, a 10-digit Indian mobile number, and a password of at least 10 characters.' })
  }
  if (password !== String(request.body.confirmPassword || '')) {
    return response.status(400).json({ message: 'Confirm password does not match your password.' })
  }
  const verifiedPhone = await Verification.findOne({ purpose, channel: 'phone', address: phone, verifiedAt: { $ne: null }, expiresAt: { $gt: new Date() } })
  if (phoneOtpEnabled() && !verifiedPhone) return response.status(403).json({ message: 'Verify your mobile number before registering.' })

  const passwordHash = await bcrypt.hash(password, 12)
  let user
  try {
    user = await Seller.create({ email, phone, passwordHash, phoneVerifiedAt: verifiedPhone?.verifiedAt ?? null })
  } catch (error) {
    if (error?.code === 11000) return response.status(409).json({ message: 'That email or phone number is already registered.' })
    throw error
  }
  await Verification.deleteMany({ purpose, channel: 'phone', address: phone })
  return response.status(201).json({ message: 'Seller account created. Sign in to continue.', user: safeUser(user) })
}))

router.post('/login', asyncHandler(async (request, response) => {
  const email = String(request.body.email || '').trim().toLowerCase()
  const password = String(request.body.password || '')
  const requiredRole = request.app.get('authRole')
  const user = await accountModel(requiredRole).findOne({ email }).select('+passwordHash')
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return response.status(401).json({ message: 'Email or password is incorrect.' })
  if (user.role === 'seller' && phoneOtpEnabled() && !user.phoneVerifiedAt) return response.status(403).json({ message: 'Verify your mobile number before signing in.' })
  setSessionCookie(response, user)
  return response.json({ user: safeUser(user) })
}))

router.get('/me', requireAuth, (request, response) => response.json({ user: safeUser(request.user) }))

router.post('/logout', (request, response) => {
  response.clearCookie(sessionCookieName(request.app.get('authRole')), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
  return response.status(204).end()
})

export default router