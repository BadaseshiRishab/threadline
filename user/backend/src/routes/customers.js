import { Router } from 'express'
import mongoose from 'mongoose'
import { randomInt } from 'node:crypto'
import { Customer } from '../models/index.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'
import Reservation from '../models/Reservation.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { indianMobileMessage, normalizeIndianMobile } from '../utils/indianMobile.js'
import { requireAuth } from '../middleware/auth.js'
import { returnPickupFor } from '../../../../shared/returnPickups.js'
import { maskedPhone, resendWait, sendDeliveryOtp, sendReturnCustomerCode } from '../../../../shared/orderMessages.js'
import { newDeliveryOtp } from '../../../../shared/deliveryOtp.js'
import { markRazorpayPaid, paymentWindowMinutes, releaseUnpaidOrder, settlePhonePeOrder, successfulRazorpayPayment, toPaise, upiId, upiLink, upiPayeeName, validRazorpaySignature } from '../services/payments.js'
import { createPhonePePayment, phonepeConfigured } from '../services/phonepe.js'

const router = Router()
router.use(requireAuth)
const addressesFor = (user) => Array.isArray(user.addresses) ? user.addresses : []
const genders = ['Male', 'Female', 'Other']
const profileFor = (user) => {
  const details = user.customerProfile || {}
  return {
    name: String(details.name || ''),
    email: user.email,
    phone: user.phone,
    gender: genders.includes(details.gender) ? details.gender : '',
    dateOfBirth: String(details.dateOfBirth || ''),
    alternateMobile: String(details.alternateMobile || ''),
    location: String(details.location || ''),
    memberSince: user.createdAt,
  }
}
// Returns an error message for an invalid YYYY-MM-DD birthday, or '' when it is acceptable.
const birthdayError = (value) => {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return 'Enter a valid date of birth.'
  const age = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000)
  if (age < 13 || age > 120) return 'You must be at least 13 years old.'
  return ''
}
const validAddress = (address) => address && ['name', 'phone', 'line', 'city', 'state', 'pincode'].every((field) => String(address[field] || '').trim()) && Boolean(normalizeIndianMobile(address.phone)) && /^560\d{3}$/.test(String(address.pincode).trim())
const priceFor = (product) => {
  const base = Number(product.sellingPrice ?? product.cost)
  const salePercent = Number(product.salePercent || 0)
  return Number((base * (1 - salePercent / 100)).toFixed(2))
}

router.get('/profile', (request, response) => response.json({ profile: profileFor(request.user) }))
router.put('/profile', asyncHandler(async (request, response) => {
  const name = String(request.body.name || '').trim()
  const phoneInput = String(request.body.phone || '').trim()
  const phone = phoneInput ? normalizeIndianMobile(phoneInput) : ''
  const alternateInput = String(request.body.alternateMobile || '').trim()
  const alternateMobile = alternateInput ? normalizeIndianMobile(alternateInput) : ''
  const gender = String(request.body.gender || '')
  const dateOfBirth = String(request.body.dateOfBirth || '').trim()
  const location = String(request.body.location || '').trim().slice(0, 80)
  if (!name || name.length > 80) return response.status(400).json({ message: 'Enter your name (up to 80 characters).' })
  if (phone === null) return response.status(400).json({ message: indianMobileMessage })
  if (alternateMobile === null) return response.status(400).json({ message: `Alternate mobile: ${indianMobileMessage}` })
  if (alternateMobile && alternateMobile === (phone || request.user.phone)) return response.status(400).json({ message: 'Alternate mobile must be different from your mobile number.' })
  if (gender && !genders.includes(gender)) return response.status(400).json({ message: 'Choose a valid gender option.' })
  if (birthdayError(dateOfBirth)) return response.status(400).json({ message: birthdayError(dateOfBirth) })
  if (phone && phone !== request.user.phone && await Customer.exists({ phone })) return response.status(409).json({ message: 'That phone number is already registered.' })
  request.user.customerProfile = { ...(request.user.customerProfile || {}), name, gender, dateOfBirth, alternateMobile, location }
  if (phone) request.user.phone = phone
  await request.user.save()
  return response.json({ profile: profileFor(request.user) })
}))

router.get('/addresses', (request, response) => response.json({ addresses: addressesFor(request.user) }))
router.post('/addresses', asyncHandler(async (request, response) => {
  const address = { id: String(request.body.id || `address-${Date.now()}`), name: String(request.body.name || '').trim(), phone: normalizeIndianMobile(request.body.phone) || '', line: String(request.body.line || '').trim(), locality: String(request.body.locality || '').trim(), city: String(request.body.city || '').trim(), state: String(request.body.state || '').trim(), pincode: String(request.body.pincode || '').trim(), type: String(request.body.type || 'Home').trim() }
  if (address.pincode && !/^560\d{3}$/.test(address.pincode)) return response.status(400).json({ message: 'Delivery is currently available only in Bangalore.' })
  if (!validAddress(address)) return response.status(400).json({ message: `Complete the address with a valid PIN code. ${indianMobileMessage}` })
  // Editing keeps the address in its place; a new one goes at the end.
  const saved = addressesFor(request.user)
  request.user.addresses = saved.some((entry) => entry.id === address.id) ? saved.map((entry) => entry.id === address.id ? address : entry) : [...saved, address]
  await request.user.save()
  return response.status(201).json({ address, addresses: request.user.addresses })
}))
router.delete('/addresses/:id', asyncHandler(async (request, response) => {
  request.user.addresses = addressesFor(request.user).filter((address) => address.id !== request.params.id)
  await request.user.save()
  return response.json({ addresses: request.user.addresses })
}))

router.get('/cart', (request, response) => response.json({ cart: Array.isArray(request.user.cart) ? request.user.cart : [] }))
router.put('/cart', asyncHandler(async (request, response) => {
  const cart = Array.isArray(request.body.cart) ? request.body.cart.filter((item) => item && item.productId && Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0).map((item) => ({ productId: String(item.productId), size: String(item.size || ''), quantity: Number(item.quantity) })) : []
  // Atomic update: a full document save() here races with the wishlist save when both change together.
  await Customer.updateOne({ _id: request.user._id }, { $set: { cart } })
  return response.json({ cart })
}))
router.get('/wishlist', (request, response) => response.json({ wishlist: Array.isArray(request.user.wishlist) ? request.user.wishlist : [] }))
router.put('/wishlist', asyncHandler(async (request, response) => {
  const wishlist = Array.isArray(request.body.wishlist) ? [...new Set(request.body.wishlist.map(String))] : []
  await Customer.updateOne({ _id: request.user._id }, { $set: { wishlist } })
  return response.json({ wishlist })
}))

router.get('/reservations', asyncHandler(async (request, response) => {
  const reservations = await Reservation.find({ customer: request.user._id, status: 'active', expiresAt: { $gt: new Date() } }).lean()
  return response.json({ reservations })
}))

router.post('/reservations', asyncHandler(async (request, response) => {
  const product = await Product.findOne({ _id: request.body.productId, status: 'approved' }).lean()
  const quantity = Number(request.body.quantity)
  const size = String(request.body.size || '')
  if (!product || !Number.isInteger(quantity) || quantity < 0 || !Object.hasOwn(product.stock || {}, size)) return response.status(400).json({ message: 'Choose a valid product, size and quantity.' })
  const own = { customer: request.user._id, product: product._id, size, status: 'active' }
  if (quantity === 0) {
    await Reservation.updateMany(own, { status: 'released' })
    return response.json({ reservation: null })
  }
  const others = await Reservation.aggregate([{ $match: { product: product._id, size, status: 'active', expiresAt: { $gt: new Date() }, customer: { $ne: request.user._id } } }, { $group: { _id: null, quantity: { $sum: '$quantity' } } }])
  if (quantity > Number(product.stock[size] || 0) - Number(others[0]?.quantity || 0)) return response.status(409).json({ message: 'That quantity is no longer available.' })
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  const reservation = await Reservation.findOneAndUpdate({ ...own, expiresAt: { $gt: new Date() } }, { quantity, expiresAt }, { new: true }) || await Reservation.create({ ...own, quantity, expiresAt })
  return response.status(201).json({ reservation })
}))

// The delivery OTP is only useful (and only shown) until the order is delivered or cancelled.
// Pickup codes are between the seller and the delivery partner, so the customer never receives them.
// The delivery OTP and return codes reach the customer only by SMS, so none of them is in the order view; smsTo
// shows where they were sent. Return pickups are reduced to each item's progress.
const customerOrder = ({ deliveryOtpAttempts, deliveryOtp, pickupHandovers, returnPickups, ...order }) => ({
  ...order,
  smsTo: maskedPhone(order.shippingAddress?.phone),
  items: order.items.map((item) => item.returnRequest ? { ...item, returnPickup: returnPickupFor({ returnPickups }, item._id, 'customer') } : item),
})
// Orders still waiting for an online payment are not real orders yet, so they stay out of the order history.
router.get('/orders', asyncHandler(async (request, response) => response.json({ orders: (await Order.find({ customer: request.user.id, status: { $ne: 'pending_payment' } }).populate([{ path: 'deliveryPartner', select: 'name phone vehicleType vehicleNumber' }, { path: 'returnPickups.deliveryPartner', select: 'name phone vehicleNumber' }]).sort({ createdAt: -1 }).lean()).map(customerOrder) })))
// Razorpay is no longer offered for new orders; its routes below still settle Razorpay orders placed before that.
const paymentMethods = ['cod', 'upi', 'phonepe']
router.get('/payment-options', (request, response) => response.json({ cod: true, upi: Boolean(upiId()), upiId: upiId(), upiPayeeName: upiPayeeName(), phonepe: phonepeConfigured(), paymentWindowMinutes }))
// Where PhonePe sends the customer back after paying: the storefront that placed the order (its Origin header), or
// PHONEPE_REDIRECT_BASE (e.g. http://13.61.177.108:8080) when set.
const storefrontBase = (request) => {
  const candidates = [process.env.PHONEPE_REDIRECT_BASE, request.get('origin')]
  for (const candidate of candidates) {
    try {
      const url = new URL(String(candidate || ''))
      if (['http:', 'https:'].includes(url.protocol)) return url.origin
    } catch { /* try the next one */ }
  }
  return 'http://localhost:5175'
}
router.post('/orders', asyncHandler(async (request, response) => {
  const requestedItems = Array.isArray(request.body.items) ? request.body.items : []
  const shippingAddress = request.body.shippingAddress
  const paymentMethod = String(request.body.paymentMethod || 'cod')
  if (!requestedItems.length || !validAddress(shippingAddress)) return response.status(400).json({ message: 'Add items and a complete delivery address.' })
  if (!paymentMethods.includes(paymentMethod)) return response.status(400).json({ message: 'Choose a valid payment method.' })
  if (paymentMethod === 'upi' && !upiId()) return response.status(503).json({ message: 'UPI payments are unavailable right now. Choose another payment method.' })
  if (paymentMethod === 'phonepe' && !phonepeConfigured()) return response.status(503).json({ message: 'PhonePe payments are unavailable right now. Choose another payment method.' })
  const products = await Product.find({ _id: { $in: requestedItems.map((item) => String(item.productId || item.id)) }, status: 'approved' }).lean()
  const productMap = new Map(products.map((product) => [String(product._id), product]))
  const items = []
  for (const requested of requestedItems) {
    const product = productMap.get(String(requested.productId || requested.id))
    const quantity = Number(requested.quantity)
    const sizes = Object.keys(product?.stock || {})
    const size = String(requested.size || (sizes.length === 1 ? sizes[0] : ''))
    if (!product || !Number.isInteger(quantity) || quantity < 1 || !Object.hasOwn(product.stock || {}, size)) return response.status(409).json({ message: 'Select a valid size for each product.' })
    const active = await Reservation.aggregate([{ $match: { product: product._id, size, customer: { $ne: request.user._id }, status: 'active', expiresAt: { $gt: new Date() } } }, { $group: { _id: null, quantity: { $sum: '$quantity' } } }])
    const stock = Number(product.stock[size] || 0) - Number(active[0]?.quantity || 0)
    const alreadyRequested = items.filter((item) => String(item.product) === String(product._id) && item.size === size).reduce((total, item) => total + item.quantity, 0)
    if (quantity + alreadyRequested > stock) return response.status(409).json({ message: `${product.name} (${size}) is unavailable or has insufficient stock.` })
    items.push({ product: product._id, seller: product.seller, name: product.name, category: product.category, subcategory: product.subcategory, imageUrl: product.imageUrl, size, quantity, unitPrice: priceFor(product) })
  }
  const reserved = []
  for (const item of items) {
    const field = `stock.${item.size}`
    const updated = await Product.updateOne({ _id: item.product, [field]: { $gte: item.quantity } }, { $inc: { [field]: -item.quantity } })
    if (!updated.modifiedCount) {
      await Promise.all(reserved.map((done) => Product.updateOne({ _id: done.product }, { $inc: { [`stock.${done.size}`]: done.quantity } })))
      return response.status(409).json({ message: 'A product is unavailable or has insufficient stock.' })
    }
    reserved.push(item)
  }
  const subtotal = Number(items.reduce((total, item) => total + item.unitPrice * item.quantity, 0).toFixed(2))
  const deliveryFee = subtotal >= 1499 ? 0 : 99
  const taxable = subtotal + deliveryFee
  const gstPercent = 18
  const gstAmount = Number((taxable * gstPercent / 100).toFixed(2))
  // An online order holds its stock in pending_payment until the payment is confirmed (or released).
  const online = paymentMethod !== 'cod'
  let order
  try {
    order = await Order.create({ customer: request.user.id, items, shippingAddress, subtotal, deliveryFee, gstPercent, gstAmount, total: Number((taxable + gstAmount).toFixed(2)), paymentMethod, status: online ? 'pending_payment' : 'placed', deliveryOtp: String(randomInt(1000, 10000)) })
  } catch (error) {
    await Promise.all(reserved.map((done) => Product.updateOne({ _id: done.product }, { $inc: { [`stock.${done.size}`]: done.quantity } })))
    throw error
  }
  let payment = null
  if (paymentMethod === 'upi') payment = { upiId: upiId(), payeeName: upiPayeeName(), link: upiLink(order), expiresAt: new Date(order.createdAt.getTime() + paymentWindowMinutes * 60 * 1000) }
  // PhonePe: the browser goes to PhonePe's page and comes back to /payment/phonepe?order=<id>, which asks the API below.
  if (paymentMethod === 'phonepe') {
    try {
      const phonePeOrder = await createPhonePePayment({
        merchantOrderId: String(order._id),
        amountPaise: toPaise(order.total),
        redirectUrl: `${storefrontBase(request)}/payment/phonepe?order=${order._id}`,
        expireAfterSeconds: paymentWindowMinutes * 60,
        description: `Threadline order ${String(order._id).slice(-8).toUpperCase()}`,
        customerId: order.customer,
      })
      if (!phonePeOrder.redirectUrl) throw new Error('PhonePe returned no payment page.')
      order.phonepeOrderId = phonePeOrder.orderId
      await order.save()
      payment = { redirectUrl: phonePeOrder.redirectUrl }
    } catch (error) {
      console.error(error)
      await releaseUnpaidOrder(order)
      return response.status(502).json({ message: 'Could not start the PhonePe payment. Please try again or choose another payment method.' })
    }
  }
  await Reservation.updateMany({ customer: request.user._id, product: { $in: items.map((item) => item.product) }, status: 'active' }, { status: 'converted' })
  return response.status(201).json({ order: customerOrder(order.toObject()), payment })
}))

const pendingOrderFor = async (request, paymentMethod) => mongoose.isValidObjectId(request.params.orderId) ? Order.findOne({ _id: request.params.orderId, customer: request.user._id, paymentMethod }).lean() : null

// Called by Razorpay Checkout's success handler. The signature proves the payment belongs to this order.
router.post('/orders/:orderId/payment/razorpay', asyncHandler(async (request, response) => {
  const order = await pendingOrderFor(request, 'razorpay')
  if (!order) return response.status(404).json({ message: 'Order not found.' })
  if (order.paymentStatus === 'paid') return response.json({ order: customerOrder(order) })
  const paymentId = String(request.body.razorpay_payment_id || '')
  if (order.status !== 'pending_payment') return response.status(409).json({ message: 'This order is no longer waiting for payment. If you were charged, contact support with your payment ID.' })
  if (String(request.body.razorpay_order_id || '') !== order.razorpayOrderId || !paymentId || !validRazorpaySignature(order.razorpayOrderId, paymentId, request.body.razorpay_signature)) return response.status(400).json({ message: 'We could not verify this payment. If you were charged, contact support with your payment ID.' })
  const paid = await markRazorpayPaid(order, paymentId)
  return response.json({ order: customerOrder(paid) })
}))

// The customer paid the store's UPI ID and gives us the 12-digit UTR from their UPI app, which admin then verifies.
router.post('/orders/:orderId/payment/upi', asyncHandler(async (request, response) => {
  const transactionId = String(request.body.transactionId || '').replace(/\s/g, '')
  if (!/^\d{12}$/.test(transactionId)) return response.status(400).json({ message: 'Enter the 12-digit UPI transaction ID (UTR) from your UPI app.' })
  const order = await pendingOrderFor(request, 'upi')
  if (!order) return response.status(404).json({ message: 'Order not found.' })
  if (order.status !== 'pending_payment') return response.status(409).json({ message: 'This order is no longer waiting for payment.' })
  if (await Order.exists({ upiTransactionId: transactionId })) return response.status(409).json({ message: 'That UPI transaction ID has already been used for another order.' })
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: 'pending_payment' },
    { $set: { status: 'placed', paymentStatus: 'awaiting_verification', upiTransactionId: transactionId } },
    { new: true },
  ).lean()
  if (!updated) return response.status(409).json({ message: 'This order is no longer waiting for payment.' })
  return response.json({ order: customerOrder(updated) })
}))

// The storefront's PhonePe return page asks this (repeatedly while pending). PhonePe's order status decides:
// { state: 'paid', order } | { state: 'pending' } | { state: 'failed' }. A failed payment releases the order's stock.
router.post('/orders/:orderId/payment/phonepe/status', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.orderId)) return response.status(404).json({ message: 'Order not found.' })
  const order = await Order.findOne({ _id: request.params.orderId, customer: request.user._id, paymentMethod: 'phonepe' }).lean()
  // A failed or expired payment's order has already been released (removed).
  if (!order) return response.json({ state: 'failed' })
  if (order.status !== 'pending_payment') return response.json(order.paymentStatus === 'paid' ? { state: 'paid', order: customerOrder(order) } : { state: 'failed' })
  try {
    const result = await settlePhonePeOrder(order)
    return response.json(result.order ? { state: result.state, order: customerOrder(result.order) } : { state: result.state })
  } catch (error) {
    // PhonePe could not be reached (or the amount did not match): keep the order waiting; the sweep settles it later.
    console.error(error)
    return response.json({ state: 'pending' })
  }
}))

// The customer closed the payment window. A Razorpay payment that went through anyway still completes the order.
router.post('/orders/:orderId/payment/cancel', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.orderId)) return response.status(404).json({ message: 'Order not found.' })
  const order = await Order.findOne({ _id: request.params.orderId, customer: request.user._id, status: 'pending_payment' }).lean()
  if (!order) return response.json({ released: false })
  // A PhonePe payment may still complete, so its order is only released once PhonePe says it failed.
  if (order.paymentMethod === 'phonepe' && order.phonepeOrderId) {
    const result = await settlePhonePeOrder(order).catch(() => ({ state: 'pending' }))
    return response.json(result.state === 'paid' ? { released: false, order: customerOrder(result.order) } : { released: result.state === 'failed' })
  }
  if (order.paymentMethod === 'razorpay' && order.razorpayOrderId) {
    const payment = await successfulRazorpayPayment(order.razorpayOrderId).catch(() => undefined)
    // If Razorpay cannot be reached, keep holding the stock; the background sweep settles the order later.
    if (payment === undefined) return response.json({ released: false })
    if (payment) return response.json({ released: false, order: customerOrder(await markRazorpayPaid(order, payment.id)) })
  }
  return response.json({ released: await releaseUnpaidOrder(order) })
}))

// Delivered items can be returned within this many days; the seller of the item then accepts or rejects.
const returnWindowDays = 7
const returnReasons = ['Size too small', 'Size too large', 'Quality not as expected', 'Received a damaged or defective item', 'Received a different item', 'Item does not match the description or photos', 'No longer needed']
router.post('/orders/:orderId/items/:itemId/return', asyncHandler(async (request, response) => {
  const reason = String(request.body.reason || '').trim()
  const message = String(request.body.message || '').trim()
  if (!returnReasons.includes(reason)) return response.status(400).json({ message: 'Choose a reason for the return.' })
  if (message.length < 10 || message.length > 500) return response.status(400).json({ message: 'Tell the seller about the problem in 10 to 500 characters.' })
  const { orderId, itemId } = request.params
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(itemId)) return response.status(404).json({ message: 'Order item not found.' })
  const order = await Order.findOne({ _id: orderId, customer: request.user._id }).lean()
  const item = order?.items.find((entry) => String(entry._id) === itemId)
  if (!item) return response.status(404).json({ message: 'Order item not found.' })
  if (order.status !== 'delivered') return response.status(409).json({ message: 'Items can be returned only after they are delivered.' })
  if (item.returnRequest?.status) return response.status(409).json({ message: 'A return has already been requested for this item.' })
  const deliveredAt = new Date(order.deliveredAt || order.updatedAt)
  if (Date.now() > deliveredAt.getTime() + returnWindowDays * 24 * 3600 * 1000) return response.status(409).json({ message: `The ${returnWindowDays}-day return window for this item has closed.` })
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, customer: request.user._id, status: 'delivered', items: { $elemMatch: { _id: item._id, 'returnRequest.status': { $exists: false } } } },
    { $set: { 'items.$.returnRequest': { status: 'requested', reason, message, requestedAt: new Date() } } },
    { new: true },
  ).lean()
  if (!updated) return response.status(409).json({ message: 'A return has already been requested for this item.' })
  return response.status(201).json({ order: customerOrder(updated) })
}))

// Codes are only ever sent by SMS (and email), so a customer who lost the message asks for it again here.
const resendReply = async (response, key, send, what) => {
  const wait = resendWait(key)
  if (wait) return response.status(429).json({ message: `Please wait ${wait} seconds before asking for the ${what} again.` })
  const { sent } = await send()
  if (!sent) return response.status(502).json({ message: `We could not send the ${what} right now. Please try again in a moment.` })
  return response.json({ message: `We have sent the ${what} again.` })
}

// The delivery OTP, once the parcel has been picked up (it is first sent when it is out for delivery).
router.post('/orders/:id/delivery-otp', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Order not found.' })
  let order = await Order.findOne({ _id: request.params.id, customer: request.user._id }).lean()
  if (!order) return response.status(404).json({ message: 'Order not found.' })
  if (!['shipped', 'out_for_delivery'].includes(order.status)) return response.status(409).json({ message: 'You get the delivery OTP by SMS once your order is on its way.' })
  if (!order.deliveryOtp) order = await Order.findOneAndUpdate({ _id: order._id, deliveryOtp: { $in: [null, ''] } }, { $set: { deliveryOtp: newDeliveryOtp(), deliveryOtpAttempts: 0 } }, { new: true }).lean() || await Order.findById(order._id).lean()
  return resendReply(response, `delivery:${order._id}`, () => sendDeliveryOtp(Customer, order, { renewed: true }), 'delivery OTP')
}))

// The return code for an item, while a partner is on the way to collect it.
router.post('/orders/:orderId/items/:itemId/return-code', asyncHandler(async (request, response) => {
  const { orderId, itemId } = request.params
  if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(itemId)) return response.status(404).json({ message: 'Order item not found.' })
  const order = await Order.findOne({ _id: orderId, customer: request.user._id }).populate('returnPickups.deliveryPartner', 'name phone').lean()
  const pickup = order?.returnPickups?.find((entry) => entry.items.some((id) => String(id) === itemId))
  if (!pickup) return response.status(404).json({ message: 'No return pickup is arranged for this item yet.' })
  if (pickup.status !== 'assigned') return response.status(409).json({ message: pickup.status === 'awaiting_partner' ? 'You get the return code by SMS once a delivery partner accepts the pickup.' : 'This return has already been collected.' })
  return resendReply(response, `return-customer:${pickup._id}`, () => sendReturnCustomerCode(Customer, order, pickup.customerOtp, pickup.deliveryPartner, { renewed: true }), 'return code')
}))

router.post('/products/:id/reviews', asyncHandler(async (request, response) => {
  const rating = Number(request.body.rating)
  const comment = String(request.body.comment || '').trim()
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 3) return response.status(400).json({ message: 'Submit a rating from 1 to 5 and a review.' })
  const product = await Product.findOne({ _id: request.params.id, status: 'approved' })
  if (!product) return response.status(404).json({ message: 'Product not found.' })
  const reviews = Array.isArray(product.reviews) ? product.reviews.filter((review) => String(review.customerId) !== String(request.user.id)) : []
  reviews.push({ customerId: request.user.id, customerName: request.user.customerProfile?.name || 'Customer', rating, comment, createdAt: new Date() })
  product.reviews = reviews
  product.reviewCount = reviews.length
  product.ratingAverage = Number((reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length).toFixed(2))
  await product.save()
  return response.status(201).json({ ratingAverage: product.ratingAverage, reviewCount: product.reviewCount, reviews: product.reviews })
}))

export default router
