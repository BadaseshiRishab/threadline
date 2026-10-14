import { api } from './client'

const API_BASE = process.env.API_BASE_URL || '/api'

// Account
export const fetchCurrentPartner = () => api('/auth/me').then(({ partner }) => partner)
// Which one-time-code options the API offers: { signupOtp, loginOtpPhone, loginOtpEmail }.
export const fetchOtpConfig = () => api('/auth/otp-config')
export const login = (identifier, password) => api('/auth/login', { method: 'POST', body: { identifier, password } })
export const sendLoginCode = (identifier) => api('/auth/login-otp', { method: 'POST', body: { identifier } })
export const verifyLoginCode = (identifier, code) => api('/auth/login-otp/verify', { method: 'POST', body: { identifier, code } })
// The mobile number is verified by SMS when applying.
export const sendSignupCode = (phone) => api('/auth/signup-otp', { method: 'POST', body: { phone } })
export const logout = () => api('/auth/logout', { method: 'POST' })
export const changePassword = (currentPassword, newPassword) => api('/auth/password', { method: 'POST', body: { currentPassword, newPassword } })

// Applying to deliver. form is FormData with the application fields and the licence and RC documents.
export const apply = (form) => api('/auth/register', { method: 'POST', body: form })
export const resubmitApplication = (form) => api('/auth/application', { method: 'PUT', body: form })
// Opens in a new tab, so it is a link rather than a request.
export const documentUrl = (kind) => `${API_BASE}/auth/documents/${kind}`

// Deliveries: { available, active, completed, returns, maxOpenJobs }
export const fetchDeliveries = () => api('/deliveries')
export const acceptOrder = (orderId) => api(`/deliveries/${orderId}/accept`, { method: 'POST' })
export const releaseOrder = (orderId) => api(`/deliveries/${orderId}/release`, { method: 'POST' })
export const confirmPickup = (orderId, sellerId, otp) => api(`/deliveries/${orderId}/pickup`, { method: 'POST', body: { sellerId, otp } })
export const updateStatus = (orderId, body) => api(`/deliveries/${orderId}/status`, { method: 'PATCH', body })

// Return pickups: collect accepted returns from the customer and bring them back to the seller.
export const acceptReturn = (jobId) => api(`/deliveries/returns/${jobId}/accept`, { method: 'POST' })
export const releaseReturn = (jobId) => api(`/deliveries/returns/${jobId}/release`, { method: 'POST' })
// step is 'collect' (from the customer) or 'drop' (at the seller).
export const advanceReturn = (jobId, step, otp) => api(`/deliveries/returns/${jobId}/${step}`, { method: 'POST', body: { otp } })
