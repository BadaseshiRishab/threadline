import mongoose from 'mongoose'

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.')
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: process.env.NODE_ENV !== 'production' })
  console.info('Connected to MongoDB')
}
