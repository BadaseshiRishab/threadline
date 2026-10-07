import jwt from 'jsonwebtoken'
import { createHmac } from 'node:crypto'
import { Customer } from '../models/index.js'

const sessionCookie = 'threadline_session_customer'

function secret() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.')
  return createHmac('sha256', process.env.JWT_SECRET).update('threadline-session:customer').digest()
}

export function setSessionCookie(response, user) {
  const token = jwt.sign({ sub: user.id, role: 'customer' }, secret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
  response.cookie(sessionCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 })
}

export function clearSessionCookie(response) {
  response.clearCookie(sessionCookie, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
}

export async function requireAuth(request, response, next) {
  try {
    const token = request.cookies[sessionCookie]
    if (!token) return response.status(401).json({ message: 'Please sign in to continue.' })
    const claims = jwt.verify(token, secret())
    const user = await Customer.findById(claims.sub)
    if (!user || claims.role !== 'customer') return response.status(401).json({ message: 'Your session is no longer valid.' })
    request.user = user
    return next()
  } catch {
    return response.status(401).json({ message: 'Please sign in to continue.' })
  }
}
