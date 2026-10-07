import { Router } from 'express'
import Product from '../models/Product.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

const router = Router()

router.get('/:id', asyncHandler(async (request, response) => {
  const product = await Product.findOne({ _id: request.params.id, status: 'approved' }).populate('seller', 'application.businessName').lean()
  if (!product) return response.status(404).json({ message: 'Product not found.' })
  return response.json({ product })
}))

export default router