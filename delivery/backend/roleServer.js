import dotenv from 'dotenv'
// Shares MongoDB and JWT_SECRET with the other APIs; sessions are still separate because each role derives its own key.
dotenv.config({ path: process.env.DELIVERY_ENV_FILE || '../../seller/backend/.env' })
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'
import { mkdir } from 'node:fs/promises'
import { DeliveryPartner, Order, Verification } from './src/models/index.js'
import authRoutes from './src/routes/auth.js'
import deliveryRoutes from './src/routes/deliveries.js'
import returnRoutes from './src/routes/returns.js'
import { uploadDirectory } from './src/middleware/documents.js'
import { logMessagingSetup } from '../../shared/notify.js'

const app = express()
// Own variable names, so the shared .env's settings for the seller API do not leak into this one.
const port = Number(process.env.DELIVERY_SERVICE_PORT || 4004)
const origins = (process.env.DELIVERY_FRONTEND_ORIGIN || 'http://localhost:5176').split(',').map((origin) => origin.trim())
app.disable('x-powered-by')
// Behind a proxy (production, or the nginx in docker-compose), take the client's IP from X-Forwarded-For so rate limits apply per user.
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: origins, credentials: true }))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: process.env.NODE_ENV === 'production' ? 20 : 200, standardHeaders: 'draft-8', legacyHeaders: false })
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/deliveries/returns', returnRoutes)
app.use('/api/deliveries', deliveryRoutes)
app.get('/api/health', (_request, response) => response.json({ status: 'ok', role: 'delivery' }))
app.use((error, request, response, next) => {
  if (response.headersSent) return next(error)
  if (error?.expose && error.status >= 400 && error.status < 500) return response.status(error.status).json({ message: error.message })
  if (error?.name === 'ValidationError' || error?.name === 'CastError') return response.status(400).json({ message: 'The request contains invalid data.' })
  console.error(error)
  return response.status(500).json({ message: 'Something went wrong. Please try again.' })
})

if (String(process.env.JWT_SECRET || '').length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.')
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.')
await mongoose.connect(process.env.MONGODB_URI, { autoIndex: process.env.NODE_ENV !== 'production' })
console.info('Connected to MongoDB')
await Promise.all([DeliveryPartner.createIndexes(), Order.createIndexes(), mkdir(uploadDirectory(), { recursive: true }), Verification.syncIndexes().catch((error) => console.warn('Verification index sync:', error.message))])
// Partners created by admin before applications existed have no status; they were already working, so approve them.
await DeliveryPartner.updateMany({ status: { $exists: false } }, { $set: { status: 'approved', reviewedAt: new Date() } })
logMessagingSetup('delivery API')
app.listen(port, () => console.info(`Threadline delivery API listening on port ${port}`))
