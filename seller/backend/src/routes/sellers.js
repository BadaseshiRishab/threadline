import { Router } from 'express'
import mongoose from 'mongoose'
import { access, mkdir } from 'node:fs/promises'
import multer from 'multer'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { protectApplication, revealApplication } from '../services/encryption.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'
import { checkDeliveryOtp, deliveredUpdate } from '../../../../shared/deliveryOtp.js'
import { maskedPhone, resendWait, sendDeliveryOtp, sendPickupCodes, sendReturnSellerCode } from '../../../../shared/orderMessages.js'
import { returnPickupFor, scheduleReturnPickup } from '../../../../shared/returnPickups.js'
import { Customer, Seller } from '../models/index.js'
import RestockRequest from '../models/RestockRequest.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
const uploadDirectory = process.env.PRIVATE_UPLOADS_DIR || path.resolve('../../private_uploads')
await mkdir(uploadDirectory, { recursive: true })
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (request, file, done) => done(null, `${randomUUID()}${file.mimetype === 'image/png' ? '.png' : '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (request, file, done) => done(null, ['image/jpeg', 'image/png'].includes(file.mimetype)),
})

router.use(requireAuth, requireRole('seller'))

router.get('/application', (request, response) => response.json({ status: request.user.sellerStatus, application: revealApplication(request.user.application ?? {}) }))

router.put('/application', asyncHandler(async (request, response) => {
  if (request.user.sellerStatus === 'approved') return response.status(409).json({ message: 'Your seller profile is already approved.' })
  request.user.application = { ...(request.user.application ?? {}), ...protectApplication(request.body) }
  await request.user.save()
  return response.json({ status: request.user.sellerStatus, application: revealApplication(request.user.application.toObject?.() ?? request.user.application) })
}))

router.post('/application/signature', upload.single('signature'), asyncHandler(async (request, response) => {
  if (!request.file) return response.status(400).json({ message: 'Choose a PNG or JPEG signature image under 5 MB.' })
  request.user.application = { ...(request.user.application ?? {}), signature: request.file.filename }
  await request.user.save()
  return response.json({ signature: request.file.filename })
}))

router.get('/application/signature/:filename', asyncHandler(async (request, response) => {
  const filename = path.basename(request.params.filename)
  if (filename !== request.user.application?.signature) return response.status(404).json({ message: 'Signature not found.' })
  return response.sendFile(filename, { root: uploadDirectory, headers: { 'Cache-Control': 'private, no-store' } })
}))

router.post('/application/submit', asyncHandler(async (request, response) => {
  if (request.user.sellerStatus === 'approved') return response.status(409).json({ message: 'Your seller profile is already approved.' })
  const application = revealApplication(request.user.application ?? {})
  const required = ['gstin', 'businessName', 'primaryName', 'primaryEmail', 'primaryPhone', 'sellerAddress', 'sellerCity', 'sellerState', 'sellerPincode', 'signature', 'bankName', 'accountType', 'ifsc', 'accountNumber', 'accountHolder']
  const missing = required.filter((field) => !String(application[field] ?? '').trim())
  if (missing.length) return response.status(400).json({ message: 'Complete all required seller application fields before submitting.', fields: missing })
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(application.gstin)) return response.status(400).json({ message: 'Enter a valid GSTIN.' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.primaryEmail) || !/^[6-9]\d{9}$/.test(application.primaryPhone)) {
    return response.status(400).json({ message: 'Enter a valid primary contact email and 10-digit phone number.' })
  }
  if (!['Current', 'Savings'].includes(application.accountType)) return response.status(400).json({ message: 'Choose a valid bank account type.' })
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(application.ifsc)) return response.status(400).json({ message: 'Enter a valid 11-character IFSC code.' })
  if (!/^\d{8,18}$/.test(application.accountNumber)) return response.status(400).json({ message: 'Enter a valid bank account number.' })
  if (application.sameOwner !== true && ['ownerName', 'ownerEmail', 'ownerPhone'].some((field) => !String(application[field] ?? '').trim())) {
    return response.status(400).json({ message: 'Complete all business owner contact fields.' })
  }
  if (application.sameOwner !== true && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.ownerEmail) || !/^[6-9]\d{9}$/.test(application.ownerPhone))) {
    return response.status(400).json({ message: 'Enter a valid business owner email and 10-digit phone number.' })
  }
  if (application.sameWarehouse !== true && ['warehouseAddress', 'warehouseCity', 'warehouseState', 'warehousePincode'].some((field) => !String(application[field] ?? '').trim())) {
    return response.status(400).json({ message: 'Complete all warehouse address fields.' })
  }
  if (application.sellingMode === 'marketplace') {
    if (!String(application.marketplaceName ?? '').trim() || !Number.isFinite(Number(application.marketplaceRating)) || Number(application.marketplaceRating) < 0 || Number(application.marketplaceRating) > 5) {
      return response.status(400).json({ message: 'Enter a marketplace name and a seller rating from 0 to 5.' })
    }
  } else if (application.sellingMode === 'independent') {
    try {
      if (!['https:', 'http:'].includes(new URL(application.websiteUrl).protocol)) throw new Error()
    } catch {
      return response.status(400).json({ message: 'Enter a valid independent store website URL.' })
    }
  } else {
    return response.status(400).json({ message: 'Choose how your business sells online.' })
  }
  if (!/^\d{6}$/.test(application.sellerPincode) || (application.sameWarehouse !== true && !/^\d{6}$/.test(application.warehousePincode))) {
    return response.status(400).json({ message: 'Enter a valid 6-digit PIN code for each address.' })
  }
  try {
    await access(path.join(uploadDirectory, path.basename(application.signature)))
  } catch {
    return response.status(400).json({ message: 'Upload a valid signature image before submitting your application.' })
  }
  request.user.sellerStatus = 'pending'
  await request.user.save()
  return response.json({ status: request.user.sellerStatus })
}))

router.get('/products', asyncHandler(async (request, response) => {
  const products = await Product.find({ seller: request.user.id, sourceProvider: { $ne: 'seller-legacy' } }).sort({ createdAt: -1 }).lean()
  return response.json({ products })
}))

router.get('/restock-requests', asyncHandler(async (request, response) => {
  const requests = await RestockRequest.find({ seller: request.user.id, status: { $in: ['open', 'fulfilled'] } }).populate('product', 'name imageUrl stock category').sort({ createdAt: -1 }).limit(50).lean()
  return response.json({ requests: requests.filter((entry) => entry.product) })
}))

router.post('/restock-requests/:id/fulfill', asyncHandler(async (request, response) => {
  const restockRequest = await RestockRequest.findOne({ _id: request.params.id, seller: request.user.id, status: 'open' })
  if (!restockRequest) return response.status(404).json({ message: 'Open restock request not found.' })
  const product = await Product.findOne({ _id: restockRequest.product, seller: request.user.id }).lean()
  if (!product) return response.status(404).json({ message: 'Product not found.' })
  const added = Object.fromEntries(Object.entries(request.body.stock && typeof request.body.stock === 'object' ? request.body.stock : {}).map(([size, count]) => [size, Number(count)]).filter(([, count]) => count !== 0))
  if (!Object.keys(added).length) return response.status(400).json({ message: 'Enter the quantity to add for at least one size.' })
  const knownSizes = [...new Set([...Object.keys(product.stock || {}), 'XS', 'S', 'M', 'L', 'XL', 'XXL', '36', '37', '38', '39', '40', '41', '42', 'One size'])]
  if (Object.keys(added).some((size) => !knownSizes.includes(size)) || Object.values(added).some((count) => !Number.isInteger(count) || count < 1)) {
    return response.status(400).json({ message: 'Use whole-number quantities for valid sizes.' })
  }
  const increments = Object.fromEntries(Object.entries(added).map(([size, count]) => [`stock.${size}`, count]))
  const updatedProduct = await Product.findOneAndUpdate({ _id: product._id, seller: request.user.id }, { $inc: increments }, { new: true }).lean()
  restockRequest.status = 'fulfilled'
  restockRequest.addedStock = added
  restockRequest.fulfilledAt = new Date()
  await restockRequest.save()
  return response.json({ request: restockRequest, product: updatedProduct })
}))

const pickupFor = (order, sellerId) => {
  const handover = order.deliveryPartner && order.pickupHandovers?.find((entry) => String(entry.seller) === String(sellerId))
  if (!handover) return null
  // The code itself only goes out by SMS; codeSent tells the seller to look for it (or ask for it again).
  return handover.pickedUpAt ? { pickedUpAt: handover.pickedUpAt } : { codeSent: true }
}

// Sellers only see their own items in an order, including any customer return request on them.
// The delivery OTP is deliberately left out: the seller has to get it from the customer.
const sellerOrder = (order, sellerId) => ({
  _id: order._id,
  customerId: String(order.customer),
  status: order.status,
  paymentMethod: order.paymentMethod || 'cod',
  paymentStatus: order.paymentStatus || 'pending',
  createdAt: order.createdAt,
  deliveredAt: order.deliveredAt,
  // Populated by the orders route: who collects the parcel, so the seller knows whom to hand it to.
  deliveryPartner: order.deliveryPartner?.name ? { name: order.deliveryPartner.name, phone: order.deliveryPartner.phone, vehicleNumber: order.deliveryPartner.vehicleNumber } : null,
  // This seller's handover to the partner: the code is shown until the partner enters it, then only the time.
  pickup: pickupFor(order, sellerId),
  // An accepted return also carries its trip back: the partner bringing it and, once collected, the code to give them.
  items: order.items.filter((item) => String(item.seller) === String(sellerId)).map(({ _id, product, name, imageUrl, size, quantity, unitPrice, returnRequest }) => ({ _id, product, name, imageUrl, size, quantity, unitPrice, returnRequest, returnPickup: returnPickupFor(order, _id, 'seller') })),
})
const orderPopulate = [{ path: 'deliveryPartner', select: 'name phone vehicleNumber' }, { path: 'returnPickups.deliveryPartner', select: 'name phone vehicleNumber' }]

router.get('/orders', asyncHandler(async (request, response) => {
  // Orders still waiting for the customer's online payment are not sellers' business yet.
  const orders = await Order.find({ 'items.seller': request.user.id, status: { $ne: 'pending_payment' } }).populate(orderPopulate).sort({ createdAt: -1 }).lean()
  return response.json({ orders: orders.map((order) => sellerOrder(order, request.user.id)) })
}))

router.patch('/orders/:id/status', asyncHandler(async (request, response) => {
  const allowed = ['packed', 'shipped', 'out_for_delivery', 'delivered']
  const status = String(request.body.status || '')
  if (!allowed.includes(status)) return response.status(400).json({ message: 'Choose packed, shipped, out for delivery, or delivered.' })
  const current = await Order.findOne({ _id: request.params.id, 'items.seller': request.user.id, status: { $ne: 'pending_payment' } }).lean()
  if (!current) return response.status(404).json({ message: 'Seller order not found.' })
  if (current.status === 'cancelled') return response.status(409).json({ message: 'This order was cancelled.' })
  if (current.paymentMethod === 'upi' && current.paymentStatus !== 'paid') return response.status(409).json({ message: 'Wait until admin has verified the customer’s UPI payment before fulfilling this order.' })
  if (current.items.some((item) => item.returnRequest?.status)) return response.status(409).json({ message: 'This order has a return request, so its delivery status can no longer change.' })
  // With a delivery partner assigned, the seller only packs the order; the partner takes it from pickup to the door.
  if (current.deliveryPartner && (status !== 'packed' || !['placed', 'packed'].includes(current.status))) return response.status(409).json({ message: 'A delivery partner is handling this order. You can only mark it packed before pickup.' })
  if (status === 'delivered' && current.status !== 'delivered') {
    const otpError = await checkDeliveryOtp(Order, current, request.body.otp, (otp) => void sendDeliveryOtp(Customer, current, { otp, renewed: true }))
    if (otpError) return response.status(otpError.status).json({ message: otpError.message })
  }
  // deliveredAt starts the customer's return window, so it is only set when the order first becomes delivered.
  const update = status === 'delivered' ? (current.status === 'delivered' ? {} : deliveredUpdate(current)) : { status, $unset: { deliveredAt: 1 } }
  const order = await Order.findOneAndUpdate({ _id: current._id }, update, { new: true, runValidators: true }).populate('deliveryPartner', 'name phone vehicleNumber').lean()
  if (status === 'out_for_delivery' && current.status !== 'out_for_delivery') void sendDeliveryOtp(Customer, order, { deliveredBy: request.user.application?.businessName || 'the seller' })
  return response.json({ order: sellerOrder(order, request.user.id) })
}))

// Pickup and return codes are only ever sent by SMS (and email); a seller who lost the message asks again here.
const sellerPhone = (seller) => seller.application?.primaryPhone || seller.phone
const resendReply = async (response, key, send, what, seller) => {
  const wait = resendWait(key)
  if (wait) return response.status(429).json({ message: `Please wait ${wait} seconds before asking for the ${what} again.` })
  const { sent } = await send()
  if (!sent) return response.status(502).json({ message: `We could not send the ${what} right now. Please try again in a moment.` })
  return response.json({ message: `We have sent the ${what} again to ${maskedPhone(sellerPhone(seller))}.` })
}

router.post('/orders/:id/pickup-code', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Order not found.' })
  const order = await Order.findOne({ _id: request.params.id, 'items.seller': request.user.id }).populate('deliveryPartner', 'name phone').lean()
  const handover = order?.deliveryPartner && order.pickupHandovers?.find((entry) => String(entry.seller) === String(request.user.id))
  if (!handover) return response.status(409).json({ message: 'No delivery partner is collecting this order yet.' })
  if (handover.pickedUpAt) return response.status(409).json({ message: 'The partner has already collected your items.' })
  return resendReply(response, `pickup:${order._id}:${request.user.id}`, () => sendPickupCodes(Seller, order, [handover], order.deliveryPartner, { renewed: true }), 'pickup code', request.user)
}))

router.post('/orders/:orderId/items/:itemId/return-code', asyncHandler(async (request, response) => {
  const { orderId, itemId } = request.params
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(itemId)) return response.status(404).json({ message: 'Order item not found.' })
  const order = await Order.findOne({ _id: orderId, 'items.seller': request.user.id }).populate('returnPickups.deliveryPartner', 'name phone').lean()
  const pickup = order?.returnPickups?.find((entry) => String(entry.seller) === String(request.user.id) && entry.items.some((id) => String(id) === itemId))
  if (!pickup || pickup.status !== 'picked_up') return response.status(409).json({ message: pickup?.status === 'returned' ? 'This return has already been handed back to you.' : 'You get the return code by SMS once the partner has collected the item.' })
  return resendReply(response, `return-seller:${pickup._id}`, () => sendReturnSellerCode(Seller, order, request.user.id, pickup.sellerOtp, pickup.deliveryPartner, { renewed: true }), 'return code', request.user)
}))

router.post('/orders/:orderId/items/:itemId/return', asyncHandler(async (request, response) => {
  const decision = String(request.body.decision || '')
  const message = String(request.body.message || '').trim()
  if (!['approved', 'rejected'].includes(decision)) return response.status(400).json({ message: 'Choose to accept or reject the return.' })
  if (decision === 'rejected' && message.length < 10) return response.status(400).json({ message: 'Tell the customer why the return was rejected (at least 10 characters).' })
  if (message.length > 500) return response.status(400).json({ message: 'Keep your message to the customer under 500 characters.' })
  const { orderId, itemId } = request.params
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(itemId)) return response.status(404).json({ message: 'Return request not found.' })
  // Matching on the "requested" status makes the decision one-time, so stock is never added back twice.
  const order = await Order.findOneAndUpdate(
    { _id: orderId, items: { $elemMatch: { _id: itemId, seller: request.user.id, 'returnRequest.status': 'requested' } } },
    { $set: { 'items.$.returnRequest.status': decision, 'items.$.returnRequest.sellerMessage': message, 'items.$.returnRequest.resolvedAt': new Date() } },
    { new: true },
  ).lean()
  if (!order) return response.status(404).json({ message: 'This return request was not found or has already been answered.' })
  // An accepted return goes to the delivery partners' pool; the item is restocked when the partner brings it back.
  if (decision === 'approved') await scheduleReturnPickup(Order, order._id, request.user.id, itemId)
  const updated = await Order.findById(order._id).populate(orderPopulate).lean()
  return response.json({ order: sellerOrder(updated, request.user.id), restockedQuantity: 0 })
}))

router.post('/products', asyncHandler(async (request, response) => {
  if (request.user.sellerStatus !== 'approved') return response.status(403).json({ message: 'Your seller account must be approved before adding products.' })
  const { name, tagline, category, subcategory, cost, description, imageUrl, stock } = request.body
  if (!name || !tagline || !category || !subcategory || !Number.isFinite(Number(cost)) || Number(cost) <= 0 || !description || !imageUrl || !stock || typeof stock !== 'object') {
    return response.status(400).json({ message: 'Complete all required product fields.' })
  }
  const categoryOptions = {
    Women: ['Dresses', 'Tops', 'Kurtas', 'Jeans'],
    Men: ['Shirts', 'T-shirts', 'Jeans', 'Kurtas'],
    Footwear: ['Sneakers', 'Sandals', 'Heels', 'Flats'],
    Accessories: ['Bags', 'Belts', 'Jewellery', 'Scarves'],
  }
  if (!Object.hasOwn(categoryOptions, category) || !categoryOptions[category].includes(subcategory)) return response.status(400).json({ message: 'Choose a valid category and subcategory.' })
  let parsedImage
  try { parsedImage = new URL(imageUrl) } catch { return response.status(400).json({ message: 'Enter a valid product image URL.' }) }
  if (!['https:', 'http:'].includes(parsedImage.protocol)) return response.status(400).json({ message: 'Product image URLs must use HTTP or HTTPS.' })
  const cleanStock = Object.fromEntries(Object.entries(stock).map(([size, count]) => [String(size).slice(0, 20), Number(count)]))
  const sizes = category === 'Footwear' ? ['36', '37', '38', '39', '40', '41', '42'] : category === 'Accessories' ? ['One size'] : ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  if (!Object.keys(cleanStock).length || Object.keys(cleanStock).some((size) => !sizes.includes(size))) return response.status(400).json({ message: 'Provide stock using valid sizes for this category.' })
  if (Object.values(cleanStock).some((count) => !Number.isInteger(count) || count < 0)) return response.status(400).json({ message: 'Stock values must be non-negative whole numbers.' })

  const product = await Product.create({ seller: request.user.id, name, tagline, category, subcategory, cost: Number(cost), description, imageUrl: parsedImage.href, stock: cleanStock })
  return response.status(201).json({ product })
}))

export default router