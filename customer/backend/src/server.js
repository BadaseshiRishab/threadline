import './config/env.js'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { Customer, Verification } from './models/index.js'
import Product from './models/Product.js'
import Order from './models/Order.js'
import Reservation from './models/Reservation.js'
import { connectDatabase } from './config/database.js'
import customerAuthRoutes from './routes/customerAuth.js'
import customerRoutes from './routes/customers.js'
import productRoutes from './routes/products.js'
import { releaseExpiredPayments } from './utils/payments.js'
import { logMessagingSetup } from '../../../shared/notify.js'
import { storefrontSettings } from '../../../shared/settings.js'

const app = express()
const port = Number(process.env.SERVICE_PORT || 4003)
const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5175').split(',').map((origin) => origin.trim())
app.disable('x-powered-by')
// Behind a proxy (production, or the nginx in docker-compose), take the client's IP from X-Forwarded-For so rate limits apply per user.
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: origins, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: process.env.NODE_ENV === 'production' ? 30 : 300, standardHeaders: 'draft-8', legacyHeaders: false })
app.use('/api/customer-auth', authLimiter, customerAuthRoutes)
app.use('/api/customer', customerRoutes)
app.use('/api/products', productRoutes)
// Fees, delivery area and account rules from .env, so the storefront shows the same values the API enforces.
app.get('/api/shop-settings', (_request, response) => response.json(storefrontSettings()))
app.get('/api/health', (_request, response) => response.json({ status: 'ok', role: 'customer' }))
app.use((error, request, response, next) => {
  if (response.headersSent) return next(error)
  if (error?.code === 11000) return response.status(409).json({ message: 'A record with that information already exists.' })
  if (error?.name === 'ValidationError' || error?.name === 'CastError') return response.status(400).json({ message: 'The request contains invalid data.' })
  console.error(error)
  return response.status(500).json({ message: 'Something went wrong. Please try again.' })
})

if (String(process.env.JWT_SECRET || '').length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.')
await connectDatabase()
await Promise.all([Customer.createIndexes(), Product.createIndexes(), Order.createIndexes(), Reservation.createIndexes(), Verification.syncIndexes().catch((error) => console.warn('Verification index sync:', error.message))])
// Releases stock held by online orders that were never paid for.
setInterval(() => void releaseExpiredPayments().catch((error) => console.error(error)), 5 * 60 * 1000).unref()
void releaseExpiredPayments().catch((error) => console.error(error))
logMessagingSetup('customer API')
app.listen(port, () => console.info(`Threadline customer API listening on port ${port}`))
