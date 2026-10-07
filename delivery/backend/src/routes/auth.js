import { Router } from 'express'
import bcrypt from 'bcryptjs'
import path from 'node:path'
import { DeliveryPartner, Verification } from '../models/index.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { clearSessionCookie, requireAuth, setSessionCookie } from '../middleware/auth.js'
import { checkDocuments, documentUpload, removeDocuments, saveDocuments, uploadDirectory } from '../middleware/documents.js'
import { documentFlags, partnerDocuments, partnerFields } from '../../../../shared/deliveryPartners.js'
import { channelEnabled, checkCode, sendCode, useCode } from '../../../../shared/otp.js'

const router = Router()
const safePartner = (partner) => ({
  id: partner.id,
  name: partner.name,
  email: partner.email,
  phone: partner.phone,
  vehicleType: partner.vehicleType,
  vehicleNumber: partner.vehicleNumber,
  licenceNumber: partner.licenceNumber,
  area: partner.area,
  documents: documentFlags(partner),
  status: partner.status,
  reviewNote: partner.status === 'rejected' ? partner.reviewNote : '',
  appliedAt: partner.appliedAt,
})
const duplicateMessage = 'An application with that email or mobile number already exists. Sign in instead.'
// Applicants verify their mobile number whenever SMS is configured (always in production). The email address is only
// checked for format and uniqueness.
const signupOtpRequired = () => process.env.NODE_ENV === 'production' || channelEnabled('phone')
const otpLabel = 'Threadline delivery partner'
const loginTarget = (identifier) => {
  const value = String(identifier || '').trim().toLowerCase()
  if (value.includes('@')) return { channel: 'email', address: value, query: { email: value } }
  const phone = value.replace(/[\s-]/g, '').replace(/^(\+91|0)/, '')
  return /^[6-9]\d{9}$/.test(phone) ? { channel: 'phone', address: phone, query: { phone } } : null
}
// Checks the mobile sign-up code when the number needs one (a new application, or a resubmission with a new number)
// and uses it up. Returns { status, message } on failure, or null.
async function checkSignupCodes(body, { phone }) {
  if (!phone || !signupOtpRequired()) return null
  const failure = await checkCode(Verification, { purpose: 'partner-signup', channel: 'phone', address: phone, code: body.otp })
  if (failure) return { status: failure.status, message: !body.otp ? 'Verify your mobile number with the code we send you.' : `Mobile code: ${failure.message}` }
  await Verification.deleteMany({ purpose: 'partner-signup', channel: 'phone', address: phone })
  return null
}

router.get('/otp-config', (request, response) => response.json({ signupOtp: signupOtpRequired(), loginOtpPhone: channelEnabled('phone'), loginOtpEmail: channelEnabled('email') }))

// Sends a sign-up code to the mobile number.
router.post('/signup-otp', asyncHandler(async (request, response) => {
  const phone = String(request.body.phone || '').replace(/[\s-]/g, '').replace(/^(\+91|0)/, '')
  if (!/^[6-9]\d{9}$/.test(phone)) return response.status(400).json({ message: 'Enter a valid 10-digit Indian mobile number.' })
  if (await DeliveryPartner.exists({ phone })) return response.status(409).json({ message: duplicateMessage })
  const failure = await sendCode(Verification, { purpose: 'partner-signup', channel: 'phone', address: phone, label: otpLabel })
  if (failure) return response.status(failure.status).json({ message: failure.message })
  return response.json({ message: `We sent a 6-digit code to ${phone}.` })
}))

router.post('/login-otp', asyncHandler(async (request, response) => {
  const target = loginTarget(request.body.identifier)
  if (!target) return response.status(400).json({ message: 'Enter your email or 10-digit mobile number.' })
  if (!channelEnabled(target.channel)) return response.status(503).json({ message: `Login with a code by ${target.channel === 'email' ? 'email' : 'SMS'} is not available right now. Use your password.` })
  const partner = await DeliveryPartner.findOne(target.query).lean()
  if (!partner) return response.status(404).json({ message: 'No partner account uses that email or mobile number. Apply first.' })
  if (!partner.active) return response.status(403).json({ message: 'Your delivery partner account has been deactivated. Contact the Threadline team.' })
  const failure = await sendCode(Verification, { purpose: 'partner-login', channel: target.channel, address: target.address, label: otpLabel })
  if (failure) return response.status(failure.status).json({ message: failure.message })
  return response.json({ message: target.channel === 'email' ? `We emailed a 6-digit code to ${target.address}.` : `We sent a 6-digit code to ${target.address}.` })
}))

router.post('/login-otp/verify', asyncHandler(async (request, response) => {
  const target = loginTarget(request.body.identifier)
  if (!target) return response.status(400).json({ message: 'Enter your email or 10-digit mobile number.' })
  const partner = await DeliveryPartner.findOne(target.query)
  if (!partner) return response.status(404).json({ message: 'No partner account uses that email or mobile number.' })
  if (!partner.active) return response.status(403).json({ message: 'Your delivery partner account has been deactivated. Contact the Threadline team.' })
  const failure = await useCode(Verification, { purpose: 'partner-login', channel: target.channel, address: target.address, code: request.body.code })
  if (failure) return response.status(failure.status).json({ message: failure.message })
  setSessionCookie(response, partner)
  return response.json({ partner: safePartner(partner) })
}))

// Anyone can apply. The account can sign in straight away, but only sees its application status until admin approves it.
// Sent as multipart/form-data with the licence and RC files as licenceDoc and rcDoc.
router.post('/register', documentUpload, asyncHandler(async (request, response) => {
  const { error, values, password } = partnerFields(request.body ?? {}, { complete: true, requirePassword: true })
  if (error) return response.status(400).json({ message: error })
  const documents = checkDocuments(request, values.vehicleType)
  if (documents.error) return response.status(400).json({ message: documents.error })
  if (await DeliveryPartner.exists({ $or: [{ email: values.email }, { phone: values.phone }] })) return response.status(409).json({ message: duplicateMessage })
  const failure = await checkSignupCodes(request.body, { phone: values.phone })
  if (failure) return response.status(failure.status).json({ message: failure.message })
  const saved = await saveDocuments(documents.files)
  let partner
  try {
    partner = await DeliveryPartner.create({ ...values, ...saved, passwordHash: await bcrypt.hash(password, 12), status: 'pending', appliedAt: new Date() })
  } catch (createError) {
    await removeDocuments(Object.values(saved))
    if (createError?.code === 11000) return response.status(409).json({ message: duplicateMessage })
    throw createError
  }
  setSessionCookie(response, partner)
  return response.status(201).json({ partner: safePartner(partner) })
}))

// Partners sign in with the email or mobile number they applied with.
router.post('/login', asyncHandler(async (request, response) => {
  const identifier = String(request.body.identifier || '').trim().toLowerCase()
  const phone = identifier.replace(/[\s-]/g, '').replace(/^(\+91|0)/, '')
  const query = identifier.includes('@') ? { email: identifier } : { phone }
  const partner = identifier ? await DeliveryPartner.findOne(query).select('+passwordHash') : null
  if (!partner || !(await bcrypt.compare(String(request.body.password || ''), partner.passwordHash))) return response.status(401).json({ message: 'Email/mobile number or password is incorrect.' })
  if (!partner.active) return response.status(403).json({ message: 'Your delivery partner account has been deactivated. Contact the Threadline team.' })
  setSessionCookie(response, partner)
  return response.json({ partner: safePartner(partner) })
}))

router.get('/me', requireAuth, (request, response) => response.json({ partner: safePartner(request.user) }))

// Lets a partner check the licence or RC they uploaded.
router.get('/documents/:kind', requireAuth, (request, response) => {
  const filename = request.user[partnerDocuments[request.params.kind]?.field]
  if (!Object.hasOwn(partnerDocuments, request.params.kind) || !filename) return response.status(404).json({ message: 'Document not found.' })
  return response.sendFile(path.basename(filename), { root: uploadDirectory(), headers: { 'Cache-Control': 'private, no-store' } })
})

// A rejected applicant can correct their details and apply again; this puts the application back in admin's queue.
// Resubmitted the same way as /register; documents not sent again keep the earlier upload.
router.put('/application', requireAuth, documentUpload, asyncHandler(async (request, response) => {
  if (request.user.status !== 'rejected') return response.status(409).json({ message: request.user.status === 'approved' ? 'Your application is already approved.' : 'Your application is already being reviewed.' })
  const { error, values } = partnerFields(request.body ?? {}, { complete: true })
  if (error) return response.status(400).json({ message: error })
  const documents = checkDocuments(request, values.vehicleType, request.user)
  if (documents.error) return response.status(400).json({ message: documents.error })
  if (await DeliveryPartner.exists({ _id: { $ne: request.user._id }, $or: [{ email: values.email }, { phone: values.phone }] })) return response.status(409).json({ message: 'Another account already uses that email or mobile number.' })
  // A new mobile number has to be verified just like at sign-up.
  const failure = await checkSignupCodes(request.body, { phone: values.phone !== request.user.phone && values.phone })
  if (failure) return response.status(failure.status).json({ message: failure.message })
  const saved = await saveDocuments(documents.files)
  const replaced = Object.keys(saved).map((field) => request.user[field])
  Object.assign(request.user, values, saved, { status: 'pending', reviewNote: '', reviewedAt: null, appliedAt: new Date() })
  try {
    await request.user.save()
  } catch (saveError) {
    await removeDocuments(Object.values(saved))
    throw saveError
  }
  await removeDocuments(replaced)
  return response.json({ partner: safePartner(request.user) })
}))

router.post('/password', requireAuth, asyncHandler(async (request, response) => {
  const currentPassword = String(request.body.currentPassword || '')
  const newPassword = String(request.body.newPassword || '')
  if (newPassword.length < 8) return response.status(400).json({ message: 'Your new password must be at least 8 characters.' })
  const partner = await DeliveryPartner.findById(request.user._id).select('+passwordHash')
  if (!(await bcrypt.compare(currentPassword, partner.passwordHash))) return response.status(400).json({ message: 'Your current password is incorrect.' })
  partner.passwordHash = await bcrypt.hash(newPassword, 12)
  await partner.save()
  return response.json({ message: 'Password changed.' })
}))

router.post('/logout', (request, response) => {
  clearSessionCookie(response)
  return response.status(204).end()
})

export default router
