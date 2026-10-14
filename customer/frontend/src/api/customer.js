import { deleteJson, getJson, postJson, putJson } from './client'

// Fees, delivery area and account rules from .env; see defaultShopSettings in utils/constants.
export const fetchShopSettings = () => getJson('/shop-settings')

// Profile
export const fetchProfile = () => getJson('/customer/profile').then(({ profile }) => profile)
export const saveProfile = (profile) => putJson('/customer/profile', profile)

// Addresses are saved on the customer's account.
export const fetchAddresses = () => getJson('/customer/addresses').then(({ addresses }) => addresses)
export const saveAddress = (address) => postJson('/customer/addresses', address)
export const removeAddress = (id) => deleteJson(`/customer/addresses/${encodeURIComponent(id)}`)

// Bag, wishlist and the stock reservations behind bag items (bagHoldMinutes in the shop settings). Missing data loads as empty.
export const fetchSavedCart = () => getJson('/customer/cart').catch(() => ({ cart: [] }))
export const fetchSavedWishlist = () => getJson('/customer/wishlist').catch(() => ({ wishlist: [] }))
export const fetchReservations = () => getJson('/customer/reservations').catch(() => ({ reservations: [] }))
export const saveCart = (cart) => putJson('/customer/cart', { cart })
export const saveWishlist = (wishlist) => putJson('/customer/wishlist', { wishlist })
// Holds quantity of a product size for bagHoldMinutes; quantity 0 releases it.
export const reserve = (productId, size, quantity) => postJson('/customer/reservations', { productId, size, quantity })

export const submitReview = (productId, review) => postJson(`/customer/products/${productId}/reviews`, review)

// Orders, payments and returns
export const fetchOrders = () => getJson('/customer/orders').then(({ orders }) => orders)
export const fetchPaymentOptions = () => getJson('/customer/payment-options')
export const placeOrder = (order) => postJson('/customer/orders', order)
export const submitUpiPayment = (orderId, transactionId) => postJson(`/customer/orders/${orderId}/payment/upi`, { transactionId })
// Releases the stock an unpaid online order was holding.
export const cancelPayment = (orderId) => postJson(`/customer/orders/${orderId}/payment/cancel`)
export const checkPhonePePayment = (orderId) => postJson(`/customer/orders/${orderId}/payment/phonepe/status`)
export const requestReturn = (orderId, itemId, request) => postJson(`/customer/orders/${orderId}/items/${itemId}/return`, request)
// Delivery OTPs and return codes are only ever sent by SMS; these ask the API to text one again.
export const resendDeliveryOtp = (orderId) => postJson(`/customer/orders/${orderId}/delivery-otp`)
export const resendReturnCode = (orderId, itemId) => postJson(`/customer/orders/${orderId}/items/${itemId}/return-code`)
