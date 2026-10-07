import { Router } from 'express'
import mongoose from 'mongoose'
import { Customer, Order, Seller } from '../models/index.js'
import { sendDeliveryOtp, sendPickupCodes } from '../../../../shared/orderMessages.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requireApproved, requireAuth } from '../middleware/auth.js'
import { checkDeliveryOtp, checkPickupOtp, deliveredUpdate, newPickupHandovers } from '../../../../shared/deliveryOtp.js'
import { maxOpenJobs } from '../../../../shared/deliveryPartners.js'
import { openStatuses, pickupFor, sellerFields } from '../jobs.js'
import { openJobCount, returnJobs } from './returns.js'

const router = Router()
router.use(requireAuth, requireApproved)

// What a partner sees about an order. The delivery OTP and the pickup codes are deliberately left out: the customer
// and the sellers read them out in person. The partner only learns whether each seller's handover is done.
const deliveryView = (order) => {
  const address = order.shippingAddress || {}
  const handovers = new Map((order.pickupHandovers || []).map((handover) => [String(handover.seller), handover]))
  const pickups = new Map()
  for (const item of order.items) {
    const sellerId = String(item.seller?._id || item.seller)
    const pickup = pickups.get(sellerId) || { ...pickupFor(item.seller), pickedUpAt: handovers.get(sellerId)?.pickedUpAt || null, items: [] }
    pickup.items.push({ _id: item._id, name: item.name, size: item.size, quantity: item.quantity, imageUrl: item.imageUrl })
    pickups.set(pickup.sellerId, pickup)
  }
  const cashOnDelivery = !['razorpay', 'upi'].includes(order.paymentMethod)
  const cashDue = cashOnDelivery && order.paymentStatus !== 'paid'
  return {
    _id: order._id,
    status: order.status,
    createdAt: order.createdAt,
    assignedAt: order.deliveryAssignedAt,
    deliveredAt: order.deliveredAt,
    total: order.total,
    paymentMethod: order.paymentMethod || 'cod',
    // Cash the partner must collect at the door; online and UPI orders are already paid.
    cashToCollect: cashDue ? order.total : 0,
    // Cash the partner took at the door. Delivering marks a cash order paid, so cashToCollect is 0 by then.
    cashCollected: cashOnDelivery && order.status === 'delivered' ? order.total : 0,
    customer: { name: address.name || '', phone: address.phone || '' },
    address: { line: address.line || '', city: address.city || '', state: address.state || '', pincode: address.pincode || '', type: address.type || '' },
    pickups: [...pickups.values()],
    itemCount: order.items.reduce((total, item) => total + Number(item.quantity || 0), 0),
  }
}

// The open pool: orders nobody is delivering yet that the seller has packed, so they can be picked up right away. UPI orders join once admin confirms the payment;
// orders still waiting for online payment never match because of the status filter.
const pool = { deliveryPartner: null, status: 'packed', $or: [{ paymentMethod: { $ne: 'upi' } }, { paymentStatus: 'paid' }] }

// Before accepting, a partner sees only enough to decide: the pickup sellers and the drop area. The customer's
// name, phone and exact address are revealed once the order is theirs.
const availableView = (order) => {
  const full = deliveryView(order)
  return {
    _id: full._id,
    status: full.status,
    createdAt: full.createdAt,
    total: full.total,
    paymentMethod: full.paymentMethod,
    cashToCollect: full.cashToCollect,
    itemCount: full.itemCount,
    dropArea: { city: full.address.city, pincode: full.address.pincode },
    pickups: full.pickups.map(({ sellerId, name, city, pincode, items }) => ({ sellerId, name, city, pincode, itemCount: items.reduce((total, item) => total + Number(item.quantity || 0), 0) })),
  }
}

const mine = (request) => ({ deliveryPartner: request.user._id })
const partnerContact = (request) => ({ name: request.user.name, phone: request.user.phone })
// Matches orders where no seller has handed anything over yet.
const nothingCollected = { pickupHandovers: { $not: { $elemMatch: { pickedUpAt: { $ne: null } } } } }

// The partner's own open jobs, the last 30 days of completed deliveries, and the pool of orders they could accept.
// The pool is oldest first, so orders that have waited longest get picked up first. Return pickups come alongside.
router.get('/', asyncHandler(async (request, response) => {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const [active, completed, available, returns] = await Promise.all([
    Order.find({ ...mine(request), status: { $in: openStatuses } }).populate('items.seller', sellerFields).sort({ deliveryAssignedAt: 1 }).lean(),
    Order.find({ ...mine(request), status: 'delivered', deliveredAt: { $gte: since } }).populate('items.seller', sellerFields).sort({ deliveredAt: -1 }).limit(100).lean(),
    Order.find(pool).populate('items.seller', sellerFields).sort({ createdAt: 1 }).limit(50).lean(),
    returnJobs(request.user._id, since),
  ])
  return response.json({ active: active.map(deliveryView), completed: completed.map(deliveryView), available: available.map(availableView), returns, maxOpenJobs })
}))

// Takes an order from the pool. Matching on the pool filter makes this first-come-first-served: if another partner
// (or admin) got there first, nothing is updated and the partner is told the order is gone.
router.post('/:id/accept', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Order not found.' })
  const open = await openJobCount(request.user._id)
  if (open >= maxOpenJobs) return response.status(409).json({ message: `You already have ${open} open jobs. Finish one before accepting another.` })
  const candidate = await Order.findOne({ _id: request.params.id, ...pool }).select('items.seller').lean()
  if (!candidate) return response.status(409).json({ message: 'Sorry, this order is no longer available. Another partner may have accepted it.' })
  // Accepting issues the pickup codes the sellers will read out to this partner.
  const order = await Order.findOneAndUpdate(
    { _id: request.params.id, ...pool },
    { $set: { deliveryPartner: request.user._id, deliveryAssignedAt: new Date(), pickupHandovers: newPickupHandovers(candidate) } },
    { new: true },
  ).populate('items.seller', sellerFields).lean()
  if (!order) return response.status(409).json({ message: 'Sorry, this order is no longer available. Another partner may have accepted it.' })
  void sendPickupCodes(Seller, order, order.pickupHandovers, partnerContact(request))
  return response.json({ order: deliveryView(order) })
}))

// Hands an accepted order back to the pool, only before any seller has handed items over. Its pickup codes are
// discarded; the next partner to accept gets new ones.
router.post('/:id/release', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Order not found.' })
  const order = await Order.findOneAndUpdate(
    { _id: request.params.id, ...mine(request), status: { $in: ['placed', 'packed'] }, ...nothingCollected },
    { $set: { deliveryPartner: null }, $unset: { deliveryAssignedAt: 1, pickupHandovers: 1 } },
    { new: true },
  ).lean()
  if (!order) return response.status(409).json({ message: 'Only orders you have not collected anything for can be released.' })
  return response.json({ released: true })
}))

// The partner enters the pickup code a seller reads out when handing over their items. Once every seller in the
// order has handed over, the order becomes picked up ("shipped").
router.post('/:id/pickup', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Delivery not found.' })
  const sellerId = String(request.body.sellerId || '')
  const current = await Order.findOne({ _id: request.params.id, ...mine(request) }).lean()
  if (!current) return response.status(404).json({ message: 'This order is not assigned to you.' })
  if (current.status !== 'packed') return response.status(409).json({ message: current.status === 'placed' ? 'The seller has not packed this order yet.' : 'This order has already been picked up.' })
  // Orders taken before pickup codes existed get them now; the seller sees theirs after refreshing.
  if (!current.pickupHandovers?.length) {
    const handovers = newPickupHandovers(current)
    const created = await Order.updateOne({ _id: current._id, pickupHandovers: { $exists: false } }, { $set: { pickupHandovers: handovers } })
    if (created.modifiedCount) void sendPickupCodes(Seller, current, handovers, partnerContact(request))
    return response.status(409).json({ message: 'A pickup code has just been sent to the seller. Ask them to read it to you.' })
  }
  if (!mongoose.isValidObjectId(sellerId)) return response.status(400).json({ message: 'Choose which seller you are collecting from.' })
  const otpError = await checkPickupOtp(Order, current, sellerId, request.body.otp, (handover) => void sendPickupCodes(Seller, current, [handover], partnerContact(request), { renewed: true }))
  if (otpError) return response.status(otpError.status).json({ message: otpError.message })
  const collected = await Order.findOneAndUpdate(
    { _id: current._id, ...mine(request), status: 'packed', pickupHandovers: { $elemMatch: { seller: sellerId, pickedUpAt: null } } },
    { $set: { 'pickupHandovers.$.pickedUpAt': new Date() } },
    { new: true },
  ).lean()
  if (!collected) return response.status(409).json({ message: 'This handover changed in the meantime. Refresh and try again.' })
  // Matching "nothing left to collect" makes the move to picked up happen exactly once.
  await Order.updateOne({ _id: current._id, status: 'packed', pickupHandovers: { $not: { $elemMatch: { pickedUpAt: null } } } }, { $set: { status: 'shipped' } })
  const order = await Order.findById(current._id).populate('items.seller', sellerFields).lean()
  return response.json({ order: deliveryView(order) })
}))

// After pickup: head out, then hand the parcel over with the customer's OTP.
const nextStep = { shipped: 'out_for_delivery', out_for_delivery: 'delivered' }
router.patch('/:id/status', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Delivery not found.' })
  const status = String(request.body.status || '')
  const current = await Order.findOne({ _id: request.params.id, ...mine(request) }).lean()
  if (!current) return response.status(404).json({ message: 'This order is not assigned to you.' })
  if (current.status === 'packed' && status === 'shipped') return response.status(409).json({ message: 'Enter each seller’s pickup code to confirm you collected the order.' })
  // Delivering straight from "picked up" is allowed, for drops that never needed a separate trip.
  const allowed = nextStep[current.status] === status || (current.status === 'shipped' && status === 'delivered')
  if (!allowed) return response.status(409).json({ message: current.status === 'delivered' ? 'This order is already delivered.' : current.status === 'cancelled' ? 'This order was cancelled.' : 'That step is not available for this order right now.' })
  if (status === 'delivered') {
    const otpError = await checkDeliveryOtp(Order, current, request.body.otp, (otp) => void sendDeliveryOtp(Customer, current, { otp, renewed: true }))
    if (otpError) return response.status(otpError.status).json({ message: otpError.message })
  }
  // Matching on the status read above makes each step happen once, even if the button is pressed twice.
  const order = await Order.findOneAndUpdate(
    { _id: current._id, ...mine(request), status: current.status },
    status === 'delivered' ? deliveredUpdate(current) : { $set: { status } },
    { new: true, runValidators: true },
  ).populate('items.seller', sellerFields).lean()
  if (!order) return response.status(409).json({ message: 'This order changed in the meantime. Refresh and try again.' })
  if (status === 'out_for_delivery') void sendDeliveryOtp(Customer, order, { deliveredBy: `${request.user.name} (${request.user.phone})` })
  return response.json({ order: deliveryView(order) })
}))

export default router
