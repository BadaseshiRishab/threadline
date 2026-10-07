// The delivery OTP and pickup code checks shared by the seller API (sellers delivering their own orders) and the delivery API
// (delivery partners). The customer reads the 4-digit OTP from the SMS we send them at the door; it proves the
// order reached them. Like models.js, this file takes the Order model instead of importing mongoose.
import { randomInt } from 'node:crypto'

export const maxOtpAttempts = 5
export const newDeliveryOtp = () => String(randomInt(1000, 10000))

// Returns { status, message } when the OTP is wrong (counting the attempt), or null when it is correct.
// onNewOtp(otp) is called whenever a replacement OTP is issued, so it can be sent to the customer.
export async function checkDeliveryOtp(Order, order, input, onNewOtp = () => {}) {
  const otp = String(input || '').trim()
  if (!/^\d{4}$/.test(otp)) return { status: 400, message: 'Enter the 4-digit delivery OTP from the customer.' }
  if (!order.deliveryOtp) {
    const fresh = newDeliveryOtp()
    await Order.updateOne({ _id: order._id }, { $set: { deliveryOtp: fresh, deliveryOtpAttempts: 0 } })
    onNewOtp(fresh)
    return { status: 409, message: 'This order did not have a delivery OTP yet. One has now been sent to the customer by SMS.' }
  }
  if (otp === order.deliveryOtp) return null
  const attempts = Number(order.deliveryOtpAttempts || 0) + 1
  if (attempts >= maxOtpAttempts) {
    const fresh = newDeliveryOtp()
    await Order.updateOne({ _id: order._id }, { $set: { deliveryOtp: fresh, deliveryOtpAttempts: 0 } })
    onNewOtp(fresh)
    return { status: 400, message: `Incorrect OTP entered ${maxOtpAttempts} times, so a new OTP has been sent to the customer by SMS.` }
  }
  await Order.updateOne({ _id: order._id }, { $set: { deliveryOtpAttempts: attempts } })
  return { status: 400, message: `Incorrect delivery OTP. ${maxOtpAttempts - attempts} attempt${maxOtpAttempts - attempts === 1 ? '' : 's'} left.` }
}

// Delivery also settles cash on delivery: the cash is collected at the door.
export const deliveredUpdate = (order) => ({
  status: 'delivered',
  deliveredAt: new Date(),
  deliveryOtpAttempts: 0,
  ...(['razorpay', 'upi', 'phonepe'].includes(order.paymentMethod) ? {} : { paymentStatus: 'paid', paidAt: new Date() }),
})

// Pickup codes: one per seller in the order, so a partner collecting from two sellers needs both codes.
export const newPickupHandovers = (order) => [...new Set(order.items.map((item) => String(item.seller?._id || item.seller)))]
  .map((seller) => ({ seller, otp: newDeliveryOtp(), attempts: 0, pickedUpAt: null }))

// Checks the pickup code a partner entered for one seller's handover. Returns { status, message } when it is wrong
// (counting the attempt, and issuing a new code after too many), or null when it is correct. onNewCode(handover)
// is called with the replacement, so it can be sent to the seller.
export async function checkPickupOtp(Order, order, sellerId, input, onNewCode = () => {}) {
  const otp = String(input || '').trim()
  if (!/^\d{4}$/.test(otp)) return { status: 400, message: 'Enter the 4-digit pickup code from the seller.' }
  const handover = (order.pickupHandovers || []).find((entry) => String(entry.seller) === String(sellerId))
  if (!handover) return { status: 404, message: 'This seller is not part of the order.' }
  if (handover.pickedUpAt) return { status: 409, message: 'You already collected this seller’s items.' }
  if (otp === handover.otp) return null
  const where = { _id: order._id, 'pickupHandovers.seller': handover.seller }
  const attempts = Number(handover.attempts || 0) + 1
  if (attempts >= maxOtpAttempts) {
    const fresh = newDeliveryOtp()
    await Order.updateOne(where, { $set: { 'pickupHandovers.$.otp': fresh, 'pickupHandovers.$.attempts': 0 } })
    onNewCode({ seller: handover.seller, otp: fresh, pickedUpAt: null })
    return { status: 400, message: `Incorrect code entered ${maxOtpAttempts} times, so a new pickup code has been sent to the seller by SMS.` }
  }
  await Order.updateOne(where, { $set: { 'pickupHandovers.$.attempts': attempts } })
  return { status: 400, message: `Incorrect pickup code. ${maxOtpAttempts - attempts} attempt${maxOtpAttempts - attempts === 1 ? '' : 's'} left.` }
}
