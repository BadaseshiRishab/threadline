// Online payments for customer orders: Razorpay Checkout, PhonePe (see phonepe.js), and direct UPI transfers to the
// store's UPI ID. Razorpay is called over its REST API (https://razorpay.com/docs/api/), so no SDK is needed.
import { createHmac, timingSafeEqual } from 'node:crypto'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { phonePeOrderStatus } from './phonepe.js'

const razorpayApi = 'https://api.razorpay.com/v1'
const keyId = () => String(process.env.RAZORPAY_KEY_ID || '').trim()
const keySecret = () => String(process.env.RAZORPAY_KEY_SECRET || '').trim()

export const razorpayConfigured = () => Boolean(keyId() && keySecret())
export const upiId = () => String(process.env.UPI_ID || '').trim()
export const upiPayeeName = () => String(process.env.UPI_PAYEE_NAME || 'Threadline').trim()

// How long an unpaid online order may hold stock before it is released.
export const paymentWindowMinutes = 30

const razorpay = async (path, { method = 'GET', body } = {}) => {
  const response = await fetch(`${razorpayApi}${path}`, {
    method,
    headers: { Authorization: `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString('base64')}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Razorpay ${method} ${path} failed: ${result.error?.description || response.status}`)
  return result
}

// Razorpay works in paise.
export const toPaise = (rupees) => Math.round(Number(rupees) * 100)

export const createRazorpayOrder = (order) => razorpay('/orders', {
  method: 'POST',
  body: { amount: toPaise(order.total), currency: 'INR', receipt: String(order._id), notes: { orderId: String(order._id), customerId: String(order.customer) } },
})

// Checkout returns a signature of "order_id|payment_id"; only Razorpay and this server know the secret.
export const validRazorpaySignature = (razorpayOrderId, razorpayPaymentId, signature) => {
  const expected = createHmac('sha256', keySecret()).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex')
  const given = Buffer.from(String(signature || ''), 'utf8')
  return given.length === expected.length && timingSafeEqual(given, Buffer.from(expected, 'utf8'))
}

// Accounts set to manual capture leave payments "authorized"; capture them so the money is actually settled.
export const captureIfAuthorized = async (paymentId, amountPaise) => {
  const payment = await razorpay(`/payments/${encodeURIComponent(paymentId)}`)
  if (payment.status === 'authorized') return razorpay(`/payments/${encodeURIComponent(paymentId)}/capture`, { method: 'POST', body: { amount: amountPaise, currency: 'INR' } })
  return payment
}

// The successful payment on a Razorpay order, if any. Used before releasing an order the customer may have paid for
// without the browser getting back to us (closed tab, lost connection).
export const successfulRazorpayPayment = async (razorpayOrderId) => {
  const { items = [] } = await razorpay(`/orders/${encodeURIComponent(razorpayOrderId)}/payments`)
  return items.find((payment) => ['captured', 'authorized'].includes(payment.status)) || null
}

// upi:// deep link understood by every UPI app; the same text is encoded in the QR code shown at checkout.
export const upiLink = (order) => `upi://pay?${new URLSearchParams({ pa: upiId(), pn: upiPayeeName(), am: Number(order.total).toFixed(2), cu: 'INR', tn: `Threadline order ${String(order._id).slice(-8).toUpperCase()}` })}`

// Moves a Razorpay order out of pending_payment once its payment is confirmed. Safe to call more than once.
export const markRazorpayPaid = async (order, paymentId) => {
  const paid = await Order.findOneAndUpdate(
    { _id: order._id, status: 'pending_payment' },
    { $set: { status: 'placed', paymentStatus: 'paid', paidAt: new Date(), razorpayPaymentId: paymentId } },
    { new: true },
  ).lean()
  if (paid) await captureIfAuthorized(paymentId, toPaise(paid.total)).catch((error) => console.error('Razorpay capture failed', error))
  return paid || Order.findById(order._id).lean()
}

// Gives back the stock an unpaid online order was holding and removes the order, so the customer can try again.
// Deleting only while the order is still pending_payment means stock is never returned twice.
export const releaseUnpaidOrder = async (order) => {
  const removed = await Order.findOneAndDelete({ _id: order._id, status: 'pending_payment' }).lean()
  if (!removed) return false
  await Promise.all(removed.items.map((item) => Product.updateOne({ _id: item.product }, { $inc: { [`stock.${item.size}`]: item.quantity } })))
  return true
}

// Asks PhonePe how a PhonePe order's payment went and updates the order to match. Only PhonePe's answer counts, never
// the browser: COMPLETED for the full amount marks the order paid; FAILED releases it; PENDING leaves it waiting, because
// the customer may still finish paying (it is released once PhonePe's payment window has passed without success).
// Returns { state: 'paid' | 'failed' | 'pending', order?, expireAt? }.
export const settlePhonePeOrder = async (order) => {
  const status = await phonePeOrderStatus(String(order._id))
  if (status.state === 'COMPLETED') {
    if (Number(status.amount) !== toPaise(order.total)) throw new Error(`PhonePe amount ${status.amount} does not match order ${order._id} total ${toPaise(order.total)}`)
    const transactionId = status.paymentDetails?.find((payment) => payment.state === 'COMPLETED')?.transactionId || ''
    const paid = await Order.findOneAndUpdate(
      { _id: order._id, status: 'pending_payment' },
      { $set: { status: 'placed', paymentStatus: 'paid', paidAt: new Date(), phonepeTransactionId: transactionId } },
      { new: true },
    ).lean()
    return { state: 'paid', order: paid || await Order.findById(order._id).lean() }
  }
  if (status.state === 'FAILED') {
    await releaseUnpaidOrder(order)
    return { state: 'failed' }
  }
  return { state: 'pending', expireAt: status.expireAt }
}

// Periodic sweep for online orders the customer never finished paying for. Razorpay and PhonePe orders are checked
// with the gateway first, because the payment may have succeeded even though the browser never reported back.
export const releaseExpiredPayments = async () => {
  const expired = await Order.find({ status: 'pending_payment', createdAt: { $lt: new Date(Date.now() - paymentWindowMinutes * 60 * 1000) } }).lean()
  for (const order of expired) {
    try {
      if (order.paymentMethod === 'razorpay' && order.razorpayOrderId) {
        const payment = await successfulRazorpayPayment(order.razorpayOrderId)
        if (payment) { await markRazorpayPaid(order, payment.id); continue }
      }
      if (order.paymentMethod === 'phonepe' && order.phonepeOrderId) {
        const { state, expireAt } = await settlePhonePeOrder(order)
        // Still pending inside PhonePe's own window: leave it for the next sweep.
        if (state !== 'pending' || (expireAt && expireAt > Date.now())) continue
      }
      await releaseUnpaidOrder(order)
    } catch (error) {
      console.error(`Could not settle unpaid order ${order._id}`, error)
    }
  }
}
