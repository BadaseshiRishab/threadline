import { api } from './client'

// Account
export const fetchVerificationConfig = () => api('/auth/verification/config')
export const fetchCurrentUser = () => api('/auth/me').then(({ user }) => user)
export const register = (details) => api('/auth/register', { method: 'POST', body: details })
export const login = (email, password) => api('/auth/login', { method: 'POST', body: { email, password } }).then(({ user }) => user)
export const logout = () => api('/auth/logout', { method: 'POST' })
// Only the mobile number is verified with a code; the email address is just entered.
export const sendPhoneCode = (phone) => api('/auth/verification/send', { method: 'POST', body: { channel: 'phone', address: phone } })
export const confirmPhoneCode = (phone, code) => api('/auth/verification/confirm', { method: 'POST', body: { channel: 'phone', address: phone, code } })

// Seller application
export const fetchApplication = () => api('/seller/application').then(({ application }) => application)
export const saveApplication = (profile) => api('/seller/application', { method: 'PUT', body: profile })
export const submitApplication = () => api('/seller/application/submit', { method: 'POST', body: {} })
export const uploadSignature = (file) => {
  const form = new FormData()
  form.append('signature', file)
  return api('/seller/application/signature', { method: 'POST', body: form })
}

// Products and restocking
export const fetchProducts = () => api('/seller/products').then(({ products }) => products)
export const createProduct = (product) => api('/seller/products', { method: 'POST', body: product }).then(({ product: created }) => created)
export const fetchRestockRequests = () => api('/seller/restock-requests').then(({ requests }) => requests)
export const fulfilRestock = (requestId, stock) => api(`/seller/restock-requests/${requestId}/fulfill`, { method: 'POST', body: { stock } })

// Orders and returns
export const fetchOrders = () => api('/seller/orders').then(({ orders }) => orders)
export const updateOrderStatus = (orderId, status, otp) => api(`/seller/orders/${orderId}/status`, { method: 'PATCH', body: { status, otp } }).then(({ order }) => order)
export const decideReturn = (orderId, itemId, decision, message) => api(`/seller/orders/${orderId}/items/${itemId}/return`, { method: 'POST', body: { decision, message } })
// Pickup and return codes are only ever sent by SMS; these ask the API to text one again.
export const resendPickupCode = (orderId) => api(`/seller/orders/${orderId}/pickup-code`, { method: 'POST' })
export const resendReturnCode = (orderId, itemId) => api(`/seller/orders/${orderId}/items/${itemId}/return-code`, { method: 'POST' })
