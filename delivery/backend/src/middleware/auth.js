import jwt from 'jsonwebtoken'
import { createHmac } from 'node:crypto'
import { DeliveryPartner } from '../models/index.js'

// Cookies are not scoped by port, so every role on localhost needs its own cookie name.
const sessionCookie = 'threadline_session_delivery'
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' }

function secret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.')
  return createHmac('sha256', process.env.JWT_SECRET).update('threadline-session:delivery').digest()
}

export function setSessionCookie(response, partner) {
  const token = jwt.sign({ sub: partner.id, role: 'delivery' }, secret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
  response.cookie(sessionCookie, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 })
}

export function clearSessionCookie(response) {
  response.clearCookie(sessionCookie, cookieOptions)
}

// Deactivating a partner in admin signs them out on their next request.
export async function requireAuth(request, response, next) {
  try {
    const token = request.cookies[sessionCookie]
    if (!token) return response.status(401).json({ message: 'Please sign in to continue.' })
    const claims = jwt.verify(token, secret())
    const partner = await DeliveryPartner.findById(claims.sub)
    if (!partner || claims.role !== 'delivery') return response.status(401).json({ message: 'Your session is no longer valid.' })
    if (!partner.active) return response.status(403).json({ message: 'Your delivery partner account has been deactivated. Contact the Threadline team.' })
    request.user = partner
    return next()
  } catch {
    return response.status(401).json({ message: 'Please sign in to continue.' })
  }
}

// Orders are only for partners whose application admin has approved.
export function requireApproved(request, response, next) {
  if (request.user?.status !== 'approved') return response.status(403).json({ message: request.user?.status === 'rejected' ? 'Your application was not approved.' : 'Your application is still being reviewed.', applicationStatus: request.user?.status })
  return next()
}
