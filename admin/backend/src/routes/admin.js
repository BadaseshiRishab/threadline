import { Router } from 'express'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import path from 'node:path'
import { Customer, DeliveryPartner, Seller } from '../models/index.js'
import Product, { listedSourceProviders } from '../models/Product.js'
import Order from '../models/Order.js'
import RestockRequest from '../models/RestockRequest.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { revealApplication } from '../services/encryption.js'
import { documentFlags, partnerDocuments, partnerFields } from '../../../../shared/deliveryPartners.js'
import { newPickupHandovers } from '../../../../shared/deliveryOtp.js'
import { sendPickupCodes } from '../../../../shared/orderMessages.js'
import { returnPickupFor } from '../../../../shared/returnPickups.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

function presentSeller(seller) {
  const value = seller.toObject?.() ?? seller
  const application = revealApplication(value.application ?? {})
  const accountNumber = String(application.accountNumber ?? '')
  delete application.accountNumber
  return {
    ...value,
    application: {
      ...application,
      accountNumberLast4: accountNumber ? accountNumber.slice(-4) : '',
    },
  }
}

router.get('/overview', asyncHandler(async (request, response) => {
  const [sellerRequests, approvedSellers, productRequests, productInventory] = await Promise.all([
    Seller.countDocuments({ sellerStatus: 'pending' }),
    Seller.countDocuments({ sellerStatus: 'approved' }),
    Product.countDocuments({ status: 'pending' }),
    Product.countDocuments({ status: 'approved', sourceProvider: { $in: listedSourceProviders } }),
  ])
  return response.json({ sellerRequests, approvedSellers, productRequests, productInventory })
}))

// Ranks approved sellers by sales and customer reviews.
//   Sales:   units and revenue from real orders (not cancelled or unpaid), minus items whose return was accepted.
//   Reviews: every review on the seller's live products. The rating is a Bayesian average, pulled towards the store-wide
//            average until a seller has several reviews, so one 5-star review cannot outrank hundreds of good ones.
//   Score:   60% sales (revenue relative to the best seller) + 40% rating, out of 100.
const ratingPrior = 5 // how many "average" reviews a seller's rating starts with
async function topSellers() {
  const sellers = await Seller.find({ sellerStatus: 'approved' }).lean()
  const ids = sellers.map((seller) => seller._id)
  const [sales, reviews] = await Promise.all([
    Order.aggregate([
      { $match: { status: { $in: ['placed', 'packed', 'shipped', 'out_for_delivery', 'delivered'] }, 'items.seller': { $in: ids } } },
      { $unwind: '$items' },
      { $match: { 'items.seller': { $in: ids }, 'items.returnRequest.status': { $ne: 'approved' } } },
      { $group: { _id: '$items.seller', unitsSold: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } }, orders: { $addToSet: '$_id' } } },
    ]),
    Product.aggregate([
      { $match: { seller: { $in: ids }, status: 'approved', sourceProvider: { $in: listedSourceProviders } } },
      // Use the individual reviews when present; imported products may only carry an average and a count.
      { $addFields: { rated: { $filter: { input: { $cond: [{ $isArray: '$reviews' }, '$reviews', []] }, as: 'review', cond: { $isNumber: '$$review.rating' } } } } },
      { $addFields: {
        reviewTotal: { $cond: [{ $gt: [{ $size: '$rated' }, 0] }, { $size: '$rated' }, { $ifNull: ['$reviewCount', 0] }] },
        ratingSum: { $cond: [{ $gt: [{ $size: '$rated' }, 0] }, { $sum: '$rated.rating' }, { $multiply: [{ $ifNull: ['$ratingAverage', 0] }, { $ifNull: ['$reviewCount', 0] }] }] },
      } },
      { $group: { _id: '$seller', liveProducts: { $sum: 1 }, reviewCount: { $sum: '$reviewTotal' }, ratingSum: { $sum: '$ratingSum' } } },
    ]),
  ])
  const salesBy = new Map(sales.map((row) => [String(row._id), row]))
  const reviewsBy = new Map(reviews.map((row) => [String(row._id), row]))
  const allReviews = reviews.reduce((total, row) => total + row.reviewCount, 0)
  const storeAverage = allReviews ? reviews.reduce((total, row) => total + row.ratingSum, 0) / allReviews : 0
  const bestRevenue = Math.max(0, ...sales.map((row) => row.revenue))
  const ranked = sellers.map((seller) => {
    const sold = salesBy.get(String(seller._id))
    const rated = reviewsBy.get(String(seller._id))
    const reviewCount = rated?.reviewCount || 0
    const averageRating = reviewCount ? rated.ratingSum / reviewCount : 0
    const weightedRating = allReviews ? (ratingPrior * storeAverage + (rated?.ratingSum || 0)) / (ratingPrior + reviewCount) : 0
    const revenue = Number((sold?.revenue || 0).toFixed(2))
    const salesScore = bestRevenue ? revenue / bestRevenue : 0
    return {
      ...presentSeller(seller),
      approvedProductCount: rated?.liveProducts || 0,
      metrics: {
        unitsSold: sold?.unitsSold || 0,
        orderCount: sold?.orders.length || 0,
        revenue,
        reviewCount,
        averageRating: Number(averageRating.toFixed(2)),
        weightedRating: Number(weightedRating.toFixed(2)),
        score: Math.round(100 * (0.6 * salesScore + 0.4 * (weightedRating / 5))),
      },
    }
  })
  return ranked.sort((a, b) => b.metrics.score - a.metrics.score || b.metrics.revenue - a.metrics.revenue || b.metrics.reviewCount - a.metrics.reviewCount)
}

router.get('/sellers', asyncHandler(async (request, response) => {
  const allowed = ['pending', 'approved', 'rejected']
  const status = allowed.includes(request.query.status) ? request.query.status : undefined
  const filter = status ? { sellerStatus: status } : {}
  if (request.query.top === 'true') return response.json({ sellers: await topSellers() })
  const sellers = await Seller.find(filter).sort({ createdAt: -1 }).lean()
  return response.json({ sellers: sellers.map(presentSeller) })
}))

router.get('/sellers/:id', asyncHandler(async (request, response) => {
  const seller = await Seller.findById(request.params.id).lean()
  if (!seller) return response.status(404).json({ message: 'Seller not found.' })
  return response.json({ seller: presentSeller(seller) })
}))

router.get('/sellers/:id/signature', asyncHandler(async (request, response) => {
  const seller = await Seller.findById(request.params.id).select('application.signature').lean()
  if (!seller?.application?.signature) return response.status(404).json({ message: 'Signature not found.' })
  const filename = path.basename(seller.application.signature)
  return response.sendFile(filename, {
    root: process.env.PRIVATE_UPLOADS_DIR || path.resolve('../../private_uploads'),
    headers: { 'Cache-Control': 'private, no-store' },
  })
}))

router.patch('/sellers/:id/decision', asyncHandler(async (request, response) => {
  const status = request.body.status
  if (!['approved', 'rejected'].includes(status)) return response.status(400).json({ message: 'Decision must be approved or rejected.' })
  const seller = await Seller.findOneAndUpdate(
    { _id: request.params.id, sellerStatus: 'pending' },
    { sellerStatus: status },
    { new: true, runValidators: true },
  )
  if (!seller) return response.status(404).json({ message: 'Pending seller request not found.' })
  return response.json({ seller: presentSeller(seller) })
}))

router.get('/products', asyncHandler(async (request, response) => {
  const status = ['pending', 'approved', 'rejected'].includes(request.query.status) ? request.query.status : undefined
  const filter = status ? { status } : {}
  const products = await Product.find(filter).populate('seller', 'email phone application').sort({ createdAt: -1 }).lean()
  return response.json({ products })
}))

router.patch('/products/:id/decision', asyncHandler(async (request, response) => {
  const status = request.body.status
  if (!['approved', 'rejected'].includes(status)) return response.status(400).json({ message: 'Decision must be approved or rejected.' })
  const marginPercent = Number(request.body.marginPercent ?? 5)
  if (status === 'approved' && (!Number.isFinite(marginPercent) || marginPercent < 0 || marginPercent > 100)) {
    return response.status(400).json({ message: 'Margin must be a percentage between 0% and 100%.' })
  }
  const pendingProduct = await Product.findOne({ _id: request.params.id, status: 'pending' })
  if (!pendingProduct) return response.status(404).json({ message: 'Pending product submission not found.' })
  const approvedMargin = status === 'approved' ? Number((pendingProduct.cost * marginPercent / 100).toFixed(2)) : 0
  const sellingPrice = status === 'approved' ? Number((pendingProduct.cost + approvedMargin).toFixed(2)) : null
  const product = await Product.findOneAndUpdate(
    { _id: request.params.id, status: 'pending' },
    { status, reviewedAt: new Date(), reviewedBy: request.user.id, marginPercent: status === 'approved' ? marginPercent : 0, marginAmount: approvedMargin, sellingPrice },
    { new: true, runValidators: true },
  ).populate('seller', 'email application')
  if (!product) return response.status(404).json({ message: 'Pending product submission not found.' })
  return response.json({ product })
}))

router.get('/inventory', asyncHandler(async (request, response) => {
  const products = await Product.find({ status: 'approved', sourceProvider: { $in: listedSourceProviders } }).populate('seller', 'email application').sort({ updatedAt: -1 }).lean()
  return response.json({ products })
}))

router.get('/inventory/low-stock', asyncHandler(async (request, response) => {
  const products = await Product.find({ status: 'approved', sourceProvider: { $in: listedSourceProviders } }).populate('seller', 'email application').lean()
  const lowStock = products.filter((product) => Object.values(product.stock || {}).reduce((total, count) => total + Number(count || 0), 0) < 5)
  return response.json({ products: lowStock })
}))

router.get('/restock-requests', asyncHandler(async (request, response) => {
  const requests = await RestockRequest.find({}).populate('product', 'name imageUrl').populate('seller', 'email application').sort({ createdAt: -1 }).limit(100).lean()
  return response.json({ requests })
}))

// Admin says how many units of each size the seller should add, e.g. { stock: { M: 10, L: 5 } }.
router.post('/inventory/:id/restock-request', asyncHandler(async (request, response) => {
  const product = await Product.findOne({ _id: request.params.id, status: 'approved' }).lean()
  if (!product) return response.status(404).json({ message: 'Approved product not found.' })
  const sizes = Object.keys(product.stock || {})
  const asked = request.body.stock && typeof request.body.stock === 'object' ? request.body.stock : {}
  const requestedStock = Object.fromEntries(Object.entries(asked).map(([size, count]) => [size, Number(count)]).filter(([, count]) => count !== 0))
  if (!Object.keys(requestedStock).length) return response.status(400).json({ message: 'Enter how many units to restock for at least one size.' })
  if (Object.keys(requestedStock).some((size) => !sizes.includes(size)) || Object.values(requestedStock).some((count) => !Number.isInteger(count) || count < 1 || count > 10000)) {
    return response.status(400).json({ message: 'Use whole-number quantities from 1 to 10,000 for this product’s sizes.' })
  }
  if (await RestockRequest.exists({ product: product._id, status: 'open' })) return response.status(409).json({ message: 'A restock request is already open for this product.' })
  const restockRequest = await RestockRequest.create({ product: product._id, seller: product.seller, requestedBy: request.user.id, requestedStock })
  return response.status(201).json({ request: restockRequest })
}))

router.patch('/restock-requests/:id/cancel', asyncHandler(async (request, response) => {
  const restockRequest = await RestockRequest.findOneAndUpdate({ _id: request.params.id, status: 'open' }, { status: 'cancelled' }, { new: true })
  if (!restockRequest) return response.status(404).json({ message: 'Open restock request not found.' })
  return response.json({ request: restockRequest })
}))

router.patch('/inventory/:id/sale', asyncHandler(async (request, response) => {
  const salePercent = Number(request.body.salePercent || 0)
  if (!Number.isFinite(salePercent) || salePercent < 0 || salePercent > 100) return response.status(400).json({ message: 'Sale discount must be between 0% and 100%.' })
  const product = await Product.findOneAndUpdate({ _id: request.params.id, status: 'approved' }, { salePercent }, { new: true, runValidators: true })
  if (!product) return response.status(404).json({ message: 'Approved product not found.' })
  return response.json({ product })
}))

// Orders still waiting for the customer's online payment (status pending_payment) are left out everywhere below:
// they are released automatically if the payment never arrives.
const realOrders = { status: { $ne: 'pending_payment' } }

router.get('/orders', asyncHandler(async (request, response) => {
  const orders = await Order.find(realOrders).populate('items.seller', 'email application').populate('deliveryPartner', 'name phone vehicleType vehicleNumber active').populate('returnPickups.deliveryPartner', 'name phone vehicleNumber').sort({ createdAt: -1 }).lean()
  // The delivery OTP and return codes are only for the people who read them out, so admin never receives them.
  return response.json({ orders: orders.map(({ deliveryOtp, deliveryOtpAttempts, pickupHandovers, returnPickups, ...order }) => ({ ...order, pickupHandovers: pickupHandovers?.map(({ seller, pickedUpAt }) => ({ seller, pickedUpAt })), customerId: String(order.customer), items: order.items.map((item) => ({ ...item, returnPickup: item.returnRequest ? returnPickupFor({ returnPickups }, item._id, 'admin') : undefined, sellerName: item.seller?.application?.businessName || item.seller?.email || String(item.seller?._id || item.seller) })) })) })
}))

// Admin confirms a UPI payment after finding the customer's transaction ID (UTR) in the store's bank statement.
// Rejecting cancels the order and returns its stock; sellers cannot fulfil a UPI order until it is confirmed.
router.patch('/orders/:id/payment', asyncHandler(async (request, response) => {
  const decision = String(request.body.decision || '')
  if (!['paid', 'rejected'].includes(decision)) return response.status(400).json({ message: 'Choose to confirm or reject the payment.' })
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Order not found.' })
  const pending = { _id: request.params.id, paymentMethod: 'upi', paymentStatus: 'awaiting_verification' }
  const order = decision === 'paid'
    ? await Order.findOneAndUpdate(pending, { $set: { paymentStatus: 'paid', paidAt: new Date() } }, { new: true }).lean()
    : await Order.findOneAndUpdate({ ...pending, status: 'placed' }, { $set: { paymentStatus: 'failed', status: 'cancelled' } }, { new: true }).lean()
  if (!order) return response.status(409).json({ message: 'This order is not waiting for UPI payment verification.' })
  if (decision === 'rejected') await Promise.all(order.items.map((item) => Product.updateOne({ _id: item.product }, { $inc: { [`stock.${item.size}`]: item.quantity } })))
  const { deliveryOtp, deliveryOtpAttempts, pickupHandovers, returnPickups, ...visible } = order
  return response.json({ order: { ...visible, customerId: String(order.customer) } })
}))

// Delivery partners. People apply from the delivery app; admin approves or rejects each application, can edit or
// deactivate approved partners, and can still assign orders directly (partners normally accept them from the pool).
const finishedStatuses = ['delivered', 'cancelled']
const partnerView = (partner, counts = {}) => ({
  _id: partner._id,
  name: partner.name,
  email: partner.email,
  phone: partner.phone,
  vehicleType: partner.vehicleType,
  vehicleNumber: partner.vehicleNumber,
  licenceNumber: partner.licenceNumber || '',
  documents: documentFlags(partner),
  area: partner.area,
  status: partner.status || 'approved',
  reviewNote: partner.reviewNote || '',
  appliedAt: partner.appliedAt || partner.createdAt,
  reviewedAt: partner.reviewedAt,
  active: partner.active,
  createdAt: partner.createdAt,
  activeOrders: counts.active || 0,
  deliveredOrders: counts.delivered || 0,
})
const partnerOrderCounts = async () => {
  const rows = await Order.aggregate([
    { $match: { deliveryPartner: { $ne: null }, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$deliveryPartner', active: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 0, 1] } }, delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } } } },
  ])
  return new Map(rows.map((row) => [String(row._id), row]))
}
const partnerResponse = async (partner) => partnerView(partner, (await partnerOrderCounts()).get(String(partner._id)))

// Pending applications first (oldest first, so nobody waits too long), then approved, then rejected.
const statusOrder = { pending: 0, approved: 1, rejected: 2 }
router.get('/delivery-partners', asyncHandler(async (request, response) => {
  const [partners, counts] = await Promise.all([DeliveryPartner.find().lean(), partnerOrderCounts()])
  const views = partners.map((partner) => partnerView(partner, counts.get(String(partner._id))))
  views.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || (a.status === 'pending' ? new Date(a.appliedAt) - new Date(b.appliedAt) : Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)))
  return response.json({ partners: views })
}))

// Opens a partner's uploaded driving licence or RC (kind "licence" or "rc").
router.get('/delivery-partners/:id/documents/:kind', asyncHandler(async (request, response) => {
  const document = Object.hasOwn(partnerDocuments, request.params.kind) ? partnerDocuments[request.params.kind] : null
  if (!document || !mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Document not found.' })
  const partner = await DeliveryPartner.findById(request.params.id).select(document.field).lean()
  if (!partner?.[document.field]) return response.status(404).json({ message: 'Document not found.' })
  return response.sendFile(path.basename(partner[document.field]), {
    root: process.env.PRIVATE_UPLOADS_DIR || path.resolve('../../private_uploads'),
    headers: { 'Cache-Control': 'private, no-store' },
  })
}))

// Approves or rejects a pending application. A rejection needs a reason, which the applicant sees in the app.
router.patch('/delivery-partners/:id/review', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Application not found.' })
  const decision = String(request.body.decision || '')
  const note = String(request.body.note || '').trim()
  if (!['approved', 'rejected'].includes(decision)) return response.status(400).json({ message: 'Choose to approve or reject the application.' })
  if (decision === 'rejected' && (note.length < 5 || note.length > 300)) return response.status(400).json({ message: 'Tell the applicant why, in 5 to 300 characters.' })
  const partner = await DeliveryPartner.findOneAndUpdate(
    { _id: request.params.id, status: 'pending' },
    { $set: { status: decision, reviewNote: decision === 'rejected' ? note : '', reviewedAt: new Date(), active: true } },
    { new: true },
  ).lean()
  if (!partner) return response.status(409).json({ message: 'This application is not waiting for review.' })
  return response.json({ partner: await partnerResponse(partner) })
}))

// Edits an approved partner's details, resets their password (they have no self-service reset) or (de)activates them.
router.patch('/delivery-partners/:id', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Delivery partner not found.' })
  const current = await DeliveryPartner.findById(request.params.id).lean()
  if (!current) return response.status(404).json({ message: 'Delivery partner not found.' })
  if (current.status !== 'approved') return response.status(409).json({ message: 'Review the application before editing this partner.' })
  const { error, values, password } = partnerFields(request.body)
  if (error) return response.status(400).json({ message: error })
  const duplicates = [values.email && { email: values.email }, values.phone && { phone: values.phone }].filter(Boolean)
  if (duplicates.length && await DeliveryPartner.exists({ _id: { $ne: current._id }, $or: duplicates })) return response.status(409).json({ message: 'Another delivery partner already uses that email or mobile number.' })
  const active = request.body.active === undefined ? undefined : Boolean(request.body.active)
  if (active === false) {
    const open = await Order.countDocuments({ deliveryPartner: current._id, status: { $nin: [...finishedStatuses, 'pending_payment'] } })
    if (open) return response.status(409).json({ message: `Reassign this partner’s ${open} open order${open === 1 ? '' : 's'} before deactivating them.` })
  }
  const update = { ...values, ...(active === undefined ? {} : { active }), ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) }
  const partner = await DeliveryPartner.findByIdAndUpdate(current._id, update, { new: true, runValidators: true }).lean()
  return response.json({ partner: await partnerResponse(partner) })
}))

// Assigns (or, with partnerId null, unassigns and returns to the pool) the partner who will deliver the order.
// A partner can be swapped until delivery, but an order that has been picked up cannot go back to having none.
router.patch('/orders/:id/delivery-partner', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Order not found.' })
  const partnerId = request.body.partnerId ? String(request.body.partnerId) : null
  const order = await Order.findOne({ _id: request.params.id, ...realOrders }).lean()
  if (!order) return response.status(404).json({ message: 'Order not found.' })
  if (finishedStatuses.includes(order.status)) return response.status(409).json({ message: `This order is already ${order.status}.` })
  if (order.paymentMethod === 'upi' && order.paymentStatus !== 'paid') return response.status(409).json({ message: 'Confirm the customer’s UPI payment before assigning a delivery partner.' })
  // Partners only ever see packed orders, so one can be given an order only after its seller packs it.
  if (partnerId && order.status === 'placed') return response.status(409).json({ message: 'The seller has not packed this order yet. Assign a partner once it is packed.' })
  // Once a seller has handed items to the partner, those items are with that partner: they must finish the pickup.
  if (order.status === 'packed' && order.pickupHandovers?.some((handover) => handover.pickedUpAt)) return response.status(409).json({ message: 'The partner has already collected items from a seller, so they must complete this pickup.' })
  if (!partnerId && !['placed', 'packed'].includes(order.status)) return response.status(409).json({ message: 'This order has been picked up. Assign a different partner instead of removing the partner.' })
  const partner = partnerId && mongoose.isValidObjectId(partnerId) ? await DeliveryPartner.findOne({ _id: partnerId, status: 'approved', active: true }).lean() : null
  if (partnerId && !partner) return response.status(400).json({ message: 'Choose an approved, active delivery partner.' })
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    partner
      ? { $set: { deliveryPartner: partner._id, deliveryAssignedAt: new Date(), ...(order.status === 'packed' ? { pickupHandovers: newPickupHandovers(order) } : {}) } }
      : { $set: { deliveryPartner: null }, $unset: { deliveryAssignedAt: 1, pickupHandovers: 1 } },
    { new: true },
  ).populate('deliveryPartner', 'name phone vehicleType vehicleNumber active').lean()
  if (!updated) return response.status(409).json({ message: 'The order changed while you were assigning it. Refresh and try again.' })
  if (partner && order.status === 'packed') void sendPickupCodes(Seller, updated, updated.pickupHandovers, partner)
  return response.json({ order: { _id: updated._id, status: updated.status, deliveryPartner: updated.deliveryPartner, deliveryAssignedAt: updated.deliveryAssignedAt } })
}))

// Every customer account with their orders, so admin can review order history customer by customer.
router.get('/customers', asyncHandler(async (request, response) => {
  const [customers, orders] = await Promise.all([
    Customer.find().select('email phone customerProfile createdAt').lean(),
    Order.find(realOrders).populate('items.seller', 'email application').sort({ createdAt: -1 }).lean(),
  ])
  const ordersByCustomer = new Map()
  for (const order of orders) {
    const id = String(order.customer)
    if (!ordersByCustomer.has(id)) ordersByCustomer.set(id, [])
    ordersByCustomer.get(id).push({
      _id: order._id,
      status: order.status,
      paymentMethod: order.paymentMethod || 'cod',
      paymentStatus: order.paymentStatus || 'pending',
      total: order.total,
      createdAt: order.createdAt,
      deliveredAt: order.deliveredAt,
      shippingAddress: order.shippingAddress,
      items: order.items.map(({ _id, name, imageUrl, size, quantity, unitPrice, returnRequest, seller }) => ({ _id, name, imageUrl, size, quantity, unitPrice, returnRequest, sellerName: seller?.application?.businessName || seller?.email || String(seller?._id || seller || '') })),
    })
  }
  const present = customers.map((customer) => {
    const customerOrders = ordersByCustomer.get(String(customer._id)) || []
    const counted = customerOrders.filter((order) => order.status !== 'cancelled')
    const items = customerOrders.flatMap((order) => order.items)
    return {
      _id: customer._id,
      name: String(customer.customerProfile?.name || ''),
      email: customer.email,
      phone: customer.phone,
      joinedAt: customer.createdAt,
      orderCount: customerOrders.length,
      activeOrders: customerOrders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length,
      unitCount: counted.reduce((total, order) => total + order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), 0),
      totalSpent: Number(counted.reduce((total, order) => total + Number(order.total || 0), 0).toFixed(2)),
      returnCount: items.filter((item) => item.returnRequest).length,
      lastOrderAt: customerOrders[0]?.createdAt || null,
      orders: customerOrders,
    }
  })
  present.sort((a, b) => b.totalSpent - a.totalSpent || new Date(b.lastOrderAt || b.joinedAt || 0) - new Date(a.lastOrderAt || a.joinedAt || 0))
  return response.json({ customers: present })
}))

// Category sales grouped by day, month or year of the order date in Indian time.
// Sales are item value (unit price × quantity, before GST and delivery); cancelled orders and accepted returns are left out.
const salesPeriods = { day: { format: '%Y-%m-%d', days: 90 }, month: { format: '%Y-%m', days: 730 }, year: { format: '%Y', days: 0 } }
router.get('/sales', asyncHandler(async (request, response) => {
  const period = Object.hasOwn(salesPeriods, request.query.period) ? request.query.period : 'day'
  const { format, days } = salesPeriods[period]
  const match = { status: { $nin: ['cancelled', 'pending_payment'] } }
  if (days) match.createdAt = { $gte: new Date(Date.now() - days * 24 * 3600 * 1000) }
  const rows = await Order.aggregate([
    { $match: match },
    { $unwind: '$items' },
    { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'product', pipeline: [{ $project: { category: 1, subcategory: 1 } }] } },
    { $set: {
      period: { $dateToString: { format, date: '$createdAt', timezone: 'Asia/Kolkata' } },
      category: { $ifNull: ['$items.category', { $first: '$product.category' }, 'Uncategorised'] },
      subcategory: { $ifNull: ['$items.subcategory', { $first: '$product.subcategory' }, 'Other'] },
      returned: { $eq: ['$items.returnRequest.status', 'approved'] },
      value: { $multiply: [{ $ifNull: ['$items.unitPrice', 0] }, { $ifNull: ['$items.quantity', 0] }] },
    } },
    { $group: {
      _id: { period: '$period', category: '$category', subcategory: '$subcategory' },
      units: { $sum: { $cond: ['$returned', 0, '$items.quantity'] } },
      sales: { $sum: { $cond: ['$returned', 0, '$value'] } },
      returnedUnits: { $sum: { $cond: ['$returned', '$items.quantity', 0] } },
      returnedSales: { $sum: { $cond: ['$returned', '$value', 0] } },
      orders: { $addToSet: '$_id' },
    } },
    { $sort: { '_id.period': -1, sales: -1 } },
  ])
  const periodOrders = await Order.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format, date: '$createdAt', timezone: 'Asia/Kolkata' } }, orders: { $sum: 1 } } },
  ])
  return response.json({
    period,
    sinceDays: days,
    rows: rows.map(({ _id, units, sales, returnedUnits, returnedSales, orders }) => ({ ..._id, units, sales: Number(sales.toFixed(2)), returnedUnits, returnedSales: Number(returnedSales.toFixed(2)), orders: orders.length })),
    periods: Object.fromEntries(periodOrders.map((entry) => [entry._id, entry.orders])),
  })
}))

router.get('/fast-selling', asyncHandler(async (request, response) => {
  const products = await Order.aggregate([
    { $match: realOrders },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', name: { $first: '$items.name' }, unitsSold: { $sum: '$items.quantity' } } },
    { $sort: { unitsSold: -1 } },
    { $limit: 20 },
  ])
  const ids = products.map((product) => product._id)
  const inventory = await Product.find({ _id: { $in: ids } }).lean()
  const inventoryMap = new Map(inventory.map((product) => [String(product._id), product]))
  return response.json({ products: products.map((product) => ({ ...product, availableStock: inventoryMap.get(String(product._id))?.stock || {} })) })
}))

export default router