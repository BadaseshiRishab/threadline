import mongoose from 'mongoose'
import { Admin, Product, Seller, Verification } from '../models/index.js'

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Copy backend/.env.example to backend/.env and configure it.')
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: process.env.NODE_ENV !== 'production',
  })
  await Promise.all([Seller.createIndexes(), Admin.createIndexes(), Verification.syncIndexes().catch((error) => console.warn('Verification index sync:', error.message)), Product.createIndexes()])
  console.info('Connected to MongoDB')
}