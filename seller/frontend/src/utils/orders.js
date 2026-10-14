const paymentMethodLabels = { cod: 'Cash on delivery', razorpay: 'Razorpay', upi: 'UPI', phonepe: 'PhonePe UPI' }
const paymentStatusLabels = { pending: 'to collect', awaiting_verification: 'verifying', paid: 'paid', failed: 'failed' }

export const paymentLabel = (order) => `${paymentMethodLabels[order.paymentMethod || 'cod'] || order.paymentMethod} · ${paymentStatusLabels[order.paymentStatus || 'pending'] || order.paymentStatus}`
// With a delivery partner assigned the seller only packs; the partner records pickup and delivery.
export const partnerHandling = (order) => Boolean(order.deliveryPartner) && !['placed', 'packed'].includes(order.status)
export const awaitingUpi = (order) => order.paymentMethod === 'upi' && order.paymentStatus !== 'paid'

export const orderNumber = (order) => order._id.slice(-8).toUpperCase()
export const sizeLabel = (item) => item.size && item.size !== 'One size' ? `Size ${item.size} · ` : ''

// One entry per order item the customer asked to return, newest request first.
export const returnRequestsOf = (orders) => orders
  .flatMap((order) => order.items.filter((item) => item.returnRequest).map((item) => ({ order, item, request: item.returnRequest })))
  .sort((a, b) => b.request.requestedAt.localeCompare(a.request.requestedAt))

// Removes one key from an object kept in state, e.g. a draft that has been sent.
export const without = (record, key) => { const next = { ...record }; delete next[key]; return next }
