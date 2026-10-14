// PhonePe Payment Gateway (Standard Checkout v2), called over its REST API so no SDK is needed:
// https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-integration-website
// The customer pays on PhonePe's hosted page (UPI apps on a phone, a QR code on a computer) and is sent back to the
// store; the order status API, not the browser, decides whether the payment succeeded.
//
// Settings: PHONEPE_CLIENT_ID, PHONEPE_CLIENT_SECRET and PHONEPE_CLIENT_VERSION from the PhonePe Business dashboard
// (Developer Settings), and PHONEPE_ENV=production for live payments (anything else uses the UAT sandbox).

const setting = (name) => String(process.env[name] || '').trim()
const production = () => setting('PHONEPE_ENV').toLowerCase() === 'production'
// PHONEPE_AUTH_URL / PHONEPE_PG_URL override the hosts, for tests.
const authHost = () => setting('PHONEPE_AUTH_URL') || (production() ? 'https://api.phonepe.com/apis/identity-manager' : 'https://api-preprod.phonepe.com/apis/pg-sandbox')
const pgHost = () => setting('PHONEPE_PG_URL') || (production() ? 'https://api.phonepe.com/apis/pg' : 'https://api-preprod.phonepe.com/apis/pg-sandbox')

export const phonepeConfigured = () => Boolean(setting('PHONEPE_CLIENT_ID') && setting('PHONEPE_CLIENT_SECRET') && setting('PHONEPE_CLIENT_VERSION'))

// The access token lasts a while; reuse it until a minute before it expires.
let cachedToken = null
async function accessToken() {
  if (cachedToken && cachedToken.expiresAt - 60 > Date.now() / 1000) return cachedToken.value
  const response = await fetch(`${authHost()}/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: setting('PHONEPE_CLIENT_ID'), client_version: setting('PHONEPE_CLIENT_VERSION'), client_secret: setting('PHONEPE_CLIENT_SECRET'), grant_type: 'client_credentials' }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result.access_token) throw new Error(`PhonePe token request failed: ${result.message || result.code || response.status}`)
  cachedToken = { value: result.access_token, expiresAt: Number(result.expires_at) || Date.now() / 1000 + 600 }
  return cachedToken.value
}

async function phonepe(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${pgHost()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${await accessToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  const result = await response.json().catch(() => ({}))
  if (response.status === 401) cachedToken = null
  if (!response.ok) throw new Error(`PhonePe ${method} ${path} failed: ${result.message || result.code || response.status}`)
  return result
}

// Starts a payment for `amountPaise` and returns PhonePe's { orderId, state, expireAt, redirectUrl }. The page is
// limited to UPI (app intent, collect request and QR), like Myntra's PhonePe checkout.
export const createPhonePePayment = ({ merchantOrderId, amountPaise, redirectUrl, expireAfterSeconds, description, customerId }) => phonepe('/checkout/v2/pay', {
  method: 'POST',
  body: {
    merchantOrderId,
    amount: amountPaise,
    expireAfter: Math.min(3600, Math.max(300, expireAfterSeconds)),
    metaInfo: { udf1: String(customerId || '') },
    paymentFlow: {
      type: 'PG_CHECKOUT',
      message: description,
      merchantUrls: { redirectUrl },
      paymentModeConfig: { version: 'V2', enabledPaymentModes: [{ type: 'UPI', flows: ['INTENT', 'COLLECT', 'QR'] }] },
    },
  },
})

// PhonePe's view of a payment: { state: 'COMPLETED' | 'FAILED' | 'PENDING', amount, expireAt, paymentDetails: [...] }.
export const phonePeOrderStatus = (merchantOrderId) => phonepe(`/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status?details=false`)
