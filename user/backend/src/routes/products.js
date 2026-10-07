import { Router } from 'express'
import Product, { listedSourceProviders } from '../models/Product.js'
import Reservation from '../models/Reservation.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()
const reservedBySize = async (productIds) => {
  const rows = await Reservation.aggregate([{ $match: { product: { $in: productIds }, status: 'active', expiresAt: { $gt: new Date() } } }, { $group: { _id: { product: '$product', size: '$size' }, quantity: { $sum: '$quantity' } } }])
  return new Map(rows.map((row) => [`${row._id.product}:${row._id.size}`, row.quantity]))
}
const presentProduct = (product, reserved = new Map()) => {
  const value = { ...product }
  const basePrice = Number(product.sellingPrice ?? product.cost)
  value.salePrice = Number((basePrice * (1 - Number(product.salePercent || 0) / 100)).toFixed(2))
  value.stock = Object.fromEntries(Object.entries(product.stock || {}).map(([size, count]) => [size, Math.max(0, Number(count || 0) - Number(reserved.get(`${product._id}:${size}`) || 0))]))
  value.stockTotal = Object.values(value.stock).reduce((total, count) => total + count, 0)
  value.outOfStock = value.stockTotal < 1
  return value
}
router.get('/', asyncHandler(async (request, response) => {
  const query = String(request.query.q || '').trim()
  const category = String(request.query.category || '').trim()
  const filter = { status: 'approved', sourceProvider: { $in: listedSourceProviders } }
  if (category) filter.category = category
  if (query) filter.$or = [{ name: { $regex: query, $options: 'i' } }, { tagline: { $regex: query, $options: 'i' } }, { category: { $regex: query, $options: 'i' } }, { subcategory: { $regex: query, $options: 'i' } }]
  const products = await Product.find(filter).sort({ createdAt: -1 }).limit(1000).lean()
  const reserved = await reservedBySize(products.map((product) => product._id))
  return response.json({ products: products.map((product) => presentProduct(product, reserved)) })
}))

router.get('/:id', asyncHandler(async (request, response) => {
  const product = await Product.findOne({ _id: request.params.id, status: 'approved', sourceProvider: { $in: listedSourceProviders } }).lean()
  if (!product) return response.status(404).json({ message: 'Product not found.' })
  return response.json({ product: presentProduct(product, await reservedBySize([product._id])) })
}))

export default router
