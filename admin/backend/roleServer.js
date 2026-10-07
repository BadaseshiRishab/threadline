import 'dotenv/config'
import { logMessagingSetup } from '../../shared/notify.js'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import path from 'node:path'
import { mkdir } from 'node:fs/promises'
import { Admin, DeliveryPartner } from './src/models/index.js'
import Verification from './src/models/Verification.js'
import Product from './src/models/Product.js'
import Order from './src/models/Order.js'
import { connectDatabase } from './src/config/database.js'
import { validateEncryptionKey } from './src/services/encryption.js'
import authRoutes from './src/routes/auth.js'
import adminRoutes from './src/routes/admin.js'
import productRoutes from './src/routes/products.js'

const role = 'admin'
const app = express()
app.set('authRole', role)
const port = Number(process.env.SERVICE_PORT || 4002)
const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5174').split(',').map((origin) => origin.trim())
const uploadDirectory = path.resolve(process.env.PRIVATE_UPLOADS_DIR || '../../private_uploads')

app.disable('x-powered-by')
// Behind a proxy (production, or the nginx in docker-compose), take the client's IP from X-Forwarded-For so rate limits apply per user.
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: origins, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false })
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/products', productRoutes)
app.get('/api/health', (request, response) => response.json({ status: 'ok', role }))

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error)
  if (error?.code === 11000) return response.status(409).json({ message: 'A record with that information already exists.' })
  if (error?.name === 'ValidationError') return response.status(400).json({ message: error.message })
  if (error?.name === 'CastError') return response.status(400).json({ message: 'The requested record ID is invalid.' })
  console.error(error)
  return response.status(500).json({ message: 'Something went wrong. Please try again.' })
})

function validateEnvironment() {
  if (String(process.env.JWT_SECRET || '').length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.')
  validateEncryptionKey()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(process.env.ADMIN_EMAIL || ''))) throw new Error('ADMIN_EMAIL must be a valid email address.')
  const minimumPasswordLength = process.env.NODE_ENV === 'production' ? 16 : 8
  if (String(process.env.ADMIN_PASSWORD || '').length < minimumPasswordLength) throw new Error(`ADMIN_PASSWORD must be at least ${minimumPasswordLength} characters.`)
}

async function seedAdmin() {
  if (await Admin.exists({})) return
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12)
  try {
    await Admin.create({ email: process.env.ADMIN_EMAIL.trim().toLowerCase(), passwordHash })
  } catch (error) {
    if (error?.code !== 11000) throw error
  }
}

validateEnvironment()
await connectDatabase()
await Promise.all([Admin.createIndexes(), Verification.syncIndexes().catch((error) => console.warn('Verification index sync:', error.message)), Product.createIndexes(), Order.createIndexes(), DeliveryPartner.createIndexes(), mkdir(uploadDirectory, { recursive: true })])
await seedAdmin()
// Partners created by admin before applications existed have no status; they were already working, so approve them.
await DeliveryPartner.updateMany({ status: { $exists: false } }, { $set: { status: 'approved', reviewedAt: new Date() } })
logMessagingSetup('admin API')
app.listen(port, () => console.info(`Threadline admin API listening on port ${port}`))