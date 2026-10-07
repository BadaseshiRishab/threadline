// Return pickups: once a seller accepts a customer's return, a partner takes the job from the pool, collects the
// items from the customer (who reads out a return code) and brings them back to the seller (who reads out theirs).
import { Router } from 'express'
import mongoose from 'mongoose'
import { Customer, Order, Product, Seller } from '../models/index.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requireApproved, requireAuth } from '../middleware/auth.js'
import { maxOpenJobs } from '../../../../shared/deliveryPartners.js'
import { sendReturnCustomerCode, sendReturnSellerCode } from '../../../../shared/orderMessages.js'
import { checkReturnCode, openReturnStatuses, restockReturnedItems } from '../../../../shared/returnPickups.js'
import { openStatuses, pickupFor, sellerFields } from '../jobs.js'

const router = Router()
router.use(requireAuth, requireApproved)

const isMine = (pickup, partnerId) => String(pickup.deliveryPartner) === String(partnerId)
const partnerContact = (request) => ({ name: request.user.name, phone: request.user.phone })
const withSellers = (query) => query.populate('items.seller', sellerFields).lean()
// The seller document populated on the order's items, for the drop-off address.
const sellerOf = (order, sellerId) => order.items.find((item) => String(item.seller?._id || item.seller) === String(sellerId))?.seller || sellerId

// A return job as the partner sees it. The return codes are deliberately left out: the customer and the seller
// read them out in person.
const returnView = (order, pickup) => {
  const address = order.shippingAddress || {}
  const ids = new Set(pickup.items.map(String))
  const items = order.items.filter((item) => ids.has(String(item._id))).map(({ _id, name, size, quantity, imageUrl }) => ({ _id, name, size, quantity, imageUrl }))
  return {
    _id: pickup._id,
    orderId: order._id,
    status: pickup.status,
    requestedAt: pickup.requestedAt,
    assignedAt: pickup.assignedAt,
    pickedUpAt: pickup.pickedUpAt,
    returnedAt: pickup.returnedAt,
    customer: { name: address.name || '', phone: address.phone || '' },
    address: { line: address.line || '', city: address.city || '', state: address.state || '', pincode: address.pincode || '', type: address.type || '' },
    seller: pickupFor(sellerOf(order, pickup.seller)),
    items,
    itemCount: items.reduce((total, item) => total + Number(item.quantity || 0), 0),
  }
}

// Before accepting, only the areas: the customer's name, phone and exact address are revealed once the job is theirs.
const availableReturnView = (order, pickup) => {
  const full = returnView(order, pickup)
  return { _id: full._id, orderId: full.orderId, status: full.status, requestedAt: full.requestedAt, itemCount: full.itemCount, pickupArea: { city: full.address.city, pincode: full.address.pincode }, seller: { name: full.seller.name, city: full.seller.city, pincode: full.seller.pincode } }
}

const mineWith = (partnerId, match) => ({ returnPickups: { $elemMatch: { deliveryPartner: partnerId, ...match } } })

// Deliveries and return pickups both count towards the limit on open jobs.
export async function openJobCount(partnerId) {
  const [deliveries, returnOrders] = await Promise.all([
    Order.countDocuments({ deliveryPartner: partnerId, status: { $in: openStatuses } }),
    Order.find(mineWith(partnerId, { status: { $in: openReturnStatuses } })).select('returnPickups.deliveryPartner returnPickups.status').lean(),
  ])
  return deliveries + returnOrders.reduce((total, order) => total + order.returnPickups.filter((pickup) => isMine(pickup, partnerId) && openReturnStatuses.includes(pickup.status)).length, 0)
}

// The pool of return pickups (oldest first), the partner's open ones, and those they completed since `since`.
export async function returnJobs(partnerId, since) {
  const [pool, active, completed] = await Promise.all([
    withSellers(Order.find({ 'returnPickups.status': 'awaiting_partner' }).limit(50)),
    withSellers(Order.find(mineWith(partnerId, { status: { $in: openReturnStatuses } }))),
    withSellers(Order.find(mineWith(partnerId, { status: 'returned', returnedAt: { $gte: since } })).limit(100)),
  ])
  const jobs = (orders, test, view) => orders.flatMap((order) => order.returnPickups.filter(test).map((pickup) => view(order, pickup)))
  const time = (value) => new Date(value || 0).getTime()
  return {
    available: jobs(pool, (pickup) => pickup.status === 'awaiting_partner', availableReturnView).sort((a, b) => time(a.requestedAt) - time(b.requestedAt)),
    active: jobs(active, (pickup) => isMine(pickup, partnerId) && openReturnStatuses.includes(pickup.status), returnView).sort((a, b) => time(a.assignedAt) - time(b.assignedAt)),
    completed: jobs(completed, (pickup) => isMine(pickup, partnerId) && pickup.status === 'returned' && time(pickup.returnedAt) >= since.getTime(), returnView).sort((a, b) => time(b.returnedAt) - time(a.returnedAt)),
  }
}

const findPickup = (order, id) => order?.returnPickups?.find((pickup) => String(pickup._id) === String(id))
const notFound = (response) => response.status(404).json({ message: 'Return pickup not found.' })

// Takes a return pickup from the pool, first come first served, and sends the customer their return code.
router.post('/:id/accept', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return notFound(response)
  const open = await openJobCount(request.user._id)
  if (open >= maxOpenJobs) return response.status(409).json({ message: `You already have ${open} open jobs. Finish one before accepting another.` })
  const order = await withSellers(Order.findOneAndUpdate(
    { returnPickups: { $elemMatch: { _id: request.params.id, status: 'awaiting_partner' } } },
    { $set: { 'returnPickups.$.status': 'assigned', 'returnPickups.$.deliveryPartner': request.user._id, 'returnPickups.$.assignedAt': new Date() } },
    { new: true },
  ))
  if (!order) return response.status(409).json({ message: 'Sorry, this return pickup is no longer available. Another partner may have accepted it.' })
  const pickup = findPickup(order, request.params.id)
  void sendReturnCustomerCode(Customer, order, pickup.customerOtp, partnerContact(request))
  return response.json({ job: returnView(order, pickup) })
}))

// Hands a return pickup back to the pool, only before the items are collected from the customer.
router.post('/:id/release', asyncHandler(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return notFound(response)
  const released = await Order.updateOne(
    mineWith(request.user._id, { _id: request.params.id, status: 'assigned' }),
    { $set: { 'returnPickups.$.status': 'awaiting_partner', 'returnPickups.$.deliveryPartner': null, 'returnPickups.$.customerOtpAttempts': 0 }, $unset: { 'returnPickups.$.assignedAt': 1 } },
  )
  if (!released.modifiedCount) return response.status(409).json({ message: 'Only return pickups you have not collected yet can be released.' })
  return response.json({ released: true })
}))

// Moves a pickup one step after its code checks out: "collect" at the customer, "drop" at the seller.
const steps = {
  collect: { from: 'assigned', to: 'picked_up', at: 'pickedUpAt', side: 'customer', wrongStatus: 'You have already collected this return.' },
  drop: { from: 'picked_up', to: 'returned', at: 'returnedAt', side: 'seller', wrongStatus: 'Collect the items from the customer before returning them to the seller.' },
}
for (const [name, step] of Object.entries(steps)) {
  router.post(`/:id/${name}`, asyncHandler(async (request, response) => {
    if (!mongoose.isValidObjectId(request.params.id)) return notFound(response)
    const current = await Order.findOne(mineWith(request.user._id, { _id: request.params.id })).lean()
    const pickup = findPickup(current, request.params.id)
    if (!pickup) return response.status(404).json({ message: 'This return pickup is not assigned to you.' })
    if (pickup.status !== step.from) return response.status(409).json({ message: pickup.status === 'returned' ? 'This return has already been handed back to the seller.' : step.wrongStatus })
    const resend = step.side === 'customer'
      ? (code) => void sendReturnCustomerCode(Customer, current, code, partnerContact(request), { renewed: true })
      : (code) => void sendReturnSellerCode(Seller, current, pickup.seller, code, partnerContact(request), { renewed: true })
    const codeError = await checkReturnCode(Order, current, pickup, step.side, request.body.otp, resend)
    if (codeError) return response.status(codeError.status).json({ message: codeError.message })
    // Matching on the status read above makes each step happen once, even if the button is pressed twice.
    const order = await withSellers(Order.findOneAndUpdate(
      mineWith(request.user._id, { _id: request.params.id, status: step.from }),
      { $set: { 'returnPickups.$.status': step.to, [`returnPickups.$.${step.at}`]: new Date() } },
      { new: true },
    ))
    if (!order) return response.status(409).json({ message: 'This return pickup changed in the meantime. Refresh and try again.' })
    const updated = findPickup(order, request.params.id)
    if (step.to === 'picked_up') void sendReturnSellerCode(Seller, order, updated.seller, updated.sellerOtp, partnerContact(request))
    else await restockReturnedItems(Product, Order, order, updated)
    return response.json({ job: returnView(order, updated) })
  }))
}

export default router
