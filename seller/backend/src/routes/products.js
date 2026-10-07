import { Router } from 'express'
import Product from '../models/Product.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

const router = Router()

router.get('/', asyncHandler(async (request, response) => {
  const query = String(request.query.q || '').trim()
  const category = String(request.query.category || '').trim()
  const filter = { status: 'approved' }
  if (category) filter.category = category
  if (query) filter.$or = [
    { name: { $regex: query, $options: 'i' } },
    { tagline: { $regex: query, $options: 'i' } },
    { category: { $regex: query, $options: 'i' } },
    { subcategory: { $regex: query, $options: 'i' } },
  ]
  const products = await Product.find(filter).populate('seller', 'application.businessName').sort({ createdAt: -1 }).limit(48).lean()
  return response.json({ products })
}))

router.get('/:id', asyncHandler(async (request, response) => {
  const product = await Product.findOne({ _id: request.params.id, status: 'approved' }).populate('seller', 'application.businessName').lean()
  if (!product) return response.status(404).json({ message: 'Product not found.' })
  return response.json({ product })
}))

export default router