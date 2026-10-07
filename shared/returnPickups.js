// Return pickups: after a seller accepts a return, a delivery partner collects the items from the customer and
// brings them back to the seller. Shared by the seller API (creating them), the delivery API (running them) and the
// customer API (showing their progress). Like models.js, this file takes models instead of importing mongoose.
import { maxOtpAttempts, newDeliveryOtp } from './deliveryOtp.js'

export const openReturnStatuses = ['assigned', 'picked_up']

// Called when a seller accepts a return. The item joins that seller's pickup for the order if no partner has taken
// it yet, so one trip collects everything; otherwise it starts a new pickup.
export async function scheduleReturnPickup(Order, orderId, sellerId, itemId) {
  const joined = await Order.updateOne(
    { _id: orderId, returnPickups: { $elemMatch: { seller: sellerId, status: 'awaiting_partner' } } },
    { $addToSet: { 'returnPickups.$.items': itemId } },
  )
  if (joined.matchedCount) return
  await Order.updateOne({ _id: orderId }, { $push: { returnPickups: { seller: sellerId, items: [itemId], status: 'awaiting_partner', customerOtp: newDeliveryOtp(), sellerOtp: newDeliveryOtp(), requestedAt: new Date() } } })
}

// The pickup an order item belongs to, as the customer, the seller or admin sees it. Nobody sees a code here: codes go
// out only by SMS. codeSent says the customer (until collection) or the seller (after it) has been texted theirs
// and may ask for it again.
export function returnPickupFor(order, itemId, side) {
  const pickup = (order.returnPickups || []).find((entry) => entry.items.some((id) => String(id) === String(itemId)))
  if (!pickup) return null
  const partner = pickup.deliveryPartner?.name ? { name: pickup.deliveryPartner.name, phone: pickup.deliveryPartner.phone, vehicleNumber: pickup.deliveryPartner.vehicleNumber || '' } : null
  const codeSent = side === 'customer' ? pickup.status === 'assigned' : side === 'seller' && pickup.status === 'picked_up'
  return {
    status: pickup.status,
    codeSent,
    partner,
    assignedAt: pickup.assignedAt,
    pickedUpAt: pickup.pickedUpAt,
    returnedAt: pickup.returnedAt,
  }
}

// Checks the return code a partner entered: side "customer" at collection, "seller" at drop-off. Returns
// { status, message } when it is wrong (counting the attempt, and issuing a new code after too many), or null when
// it is correct. onNewCode(code) is called with the replacement, so it can be sent to that person.
export async function checkReturnCode(Order, order, pickup, side, input, onNewCode = () => {}) {
  const who = side === 'customer' ? 'customer' : 'seller'
  const otp = String(input || '').trim()
  if (!/^\d{4}$/.test(otp)) return { status: 400, message: `Enter the 4-digit return code from the ${who}.` }
  const codeField = `${side}Otp`
  const attemptsField = `${side}OtpAttempts`
  if (otp === pickup[codeField]) return null
  const where = { _id: order._id, 'returnPickups._id': pickup._id }
  const attempts = Number(pickup[attemptsField] || 0) + 1
  if (attempts >= maxOtpAttempts) {
    const fresh = newDeliveryOtp()
    await Order.updateOne(where, { $set: { [`returnPickups.$.${codeField}`]: fresh, [`returnPickups.$.${attemptsField}`]: 0 } })
    onNewCode(fresh)
    return { status: 400, message: `Incorrect code entered ${maxOtpAttempts} times, so a new return code has been sent to the ${who} by SMS.` }
  }
  await Order.updateOne(where, { $set: { [`returnPickups.$.${attemptsField}`]: attempts } })
  return { status: 400, message: `Incorrect return code. ${maxOtpAttempts - attempts} attempt${maxOtpAttempts - attempts === 1 ? '' : 's'} left.` }
}

// Puts the returned items back into the seller's stock once they have them. Called exactly once per pickup, by the
// update that marks it returned. Items whose product or size no longer exists are skipped.
export async function restockReturnedItems(Product, Order, order, pickup) {
  for (const itemId of pickup.items) {
    const item = order.items.find((entry) => String(entry._id) === String(itemId))
    if (!item || item.returnRequest?.restockedQuantity) continue
    const product = await Product.findOne({ _id: item.product, seller: pickup.seller }).select('stock').lean()
    const sizes = Object.keys(product?.stock || {})
    const size = item.size || (sizes.length === 1 ? sizes[0] : '')
    if (!product || !Object.hasOwn(product.stock || {}, size)) continue
    const restocked = await Product.updateOne({ _id: product._id, seller: pickup.seller }, { $inc: { [`stock.${size}`]: item.quantity } })
    if (restocked.modifiedCount) await Order.updateOne({ _id: order._id, 'items._id': item._id }, { $set: { 'items.$.returnRequest.restockedQuantity': item.quantity } })
  }
}
