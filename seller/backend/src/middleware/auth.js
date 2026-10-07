import jwt from 'jsonwebtoken'
import { createHmac } from 'node:crypto'
import { Admin, Seller } from '../models/index.js'

// Sellers and admins live in separate collections; each service signs in only its own kind of account.
export const accountModel = (role) => role === 'admin' ? Admin : Seller

export const cookieName = 'threadline_session'
export const sessionCookieName = (role) => role === 'seller' || role === 'admin' ? `${cookieName}_${role}` : cookieName

function roleSessionSecret(role) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.')
  return createHmac('sha256', process.env.JWT_SECRET).update(`threadline-session:${role}`).digest()
}

export function setSessionCookie(response, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, roleSessionSecret(user.role), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
  response.cookie(sessionCookieName(user.role), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

export async function requireAuth(request, response, next) {
  try {
    const role = request.app.get('authRole')
    if (!role) return response.status(500).json({ message: 'Authentication role is not configured.' })
    const token = request.cookies[sessionCookieName(role)]
    if (!token) return response.status(401).json({ message: 'Please sign in to continue.' })

    const claims = jwt.verify(token, roleSessionSecret(role))
    const user = await accountModel(role).findById(claims.sub)
    if (!user || user.role !== claims.role || user.role !== role) return response.status(401).json({ message: 'Your session is no longer valid.' })
    request.user = user
    return next()
  } catch {
    return response.status(401).json({ message: 'Please sign in to continue.' })
  }
}

export function requireRole(role) {
  return (request, response, next) => {
    if (request.user?.role !== role) return response.status(403).json({ message: 'You do not have permission to do that.' })
    return next()
  }
}