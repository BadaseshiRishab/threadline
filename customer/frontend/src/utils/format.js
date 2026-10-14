export function formatPrice(value) {
  return `₹${value.toLocaleString('en-IN')}`
}

export function formatCount(value) {
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(value)
}

export const shortDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

// order.paymentMethod is 'cod', 'upi', 'phonepe' or 'razorpay'. Razorpay remains only so orders paid with it before
// it was removed from checkout still show as paid online.
export const paymentSummary = (order) => {
  if (order.paymentMethod === 'razorpay') return 'Paid online'
  if (order.paymentMethod === 'phonepe') return 'Paid with PhonePe UPI'
  if (order.paymentMethod === 'upi') return order.paymentStatus === 'paid' ? 'Paid by UPI' : order.paymentStatus === 'failed' ? 'UPI payment could not be verified' : 'UPI payment being verified'
  return order.paymentStatus === 'paid' ? 'Paid on delivery' : 'Cash on delivery'
}
