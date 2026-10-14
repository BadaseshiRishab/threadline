// Shop settings, read from .env: see "Shop settings" in seller/backend/.env (seller, customer and delivery APIs) and
// "Admin settings" in admin/backend/.env (admin API). Each API's server.js loads its .env before this file is
// imported, so the values are read once at start-up; restart the API after changing one. A blank or invalid value
// uses the default shown here.

const number = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = true } = {}) => {
  const raw = String(process.env[name] ?? '').trim()
  const value = Number(raw)
  if (!raw || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) return fallback
  return value
}
const text = (name, fallback, pattern) => {
  const value = String(process.env[name] ?? '').trim()
  return value && (!pattern || pattern.test(value)) ? value : fallback
}

export const settings = {
  // Customer accounts
  customerEmailDomain: text('CUSTOMER_EMAIL_DOMAIN', 'gmail.com', /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i).toLowerCase(),
  customerPasswordMinLength: number('CUSTOMER_PASSWORD_MIN_LENGTH', 8, { min: 6, max: 72 }),
  customerSessionDays: number('CUSTOMER_SESSION_DAYS', 7, { min: 1, max: 365 }),
  // Wrong passwords: the first stage locks the account, then the second; after that it starts again at the first.
  loginLockStages: [
    { limit: number('LOGIN_LOCK_FIRST_ATTEMPTS', 3, { min: 1, max: 100 }), lockMinutes: number('LOGIN_LOCK_FIRST_MINUTES', 1, { min: 1, max: 1440 }) },
    { limit: number('LOGIN_LOCK_SECOND_ATTEMPTS', 2, { min: 1, max: 100 }), lockMinutes: number('LOGIN_LOCK_SECOND_MINUTES', 5, { min: 1, max: 1440 }) },
  ],
  // Delivery area
  deliveryPinPrefix: text('DELIVERY_PIN_PREFIX', '560', /^\d{1,6}$/),
  deliveryAreaName: text('DELIVERY_AREA_NAME', 'Bangalore'),
  deliveryCity: text('DELIVERY_CITY', 'Bengaluru'),
  deliveryState: text('DELIVERY_STATE', 'Karnataka'),
  // Checkout, in rupees
  freeDeliveryFrom: number('FREE_DELIVERY_FROM', 1499, { integer: false }),
  deliveryFee: number('DELIVERY_FEE', 99, { integer: false }),
  gstPercent: number('GST_PERCENT', 18, { max: 100, integer: false }),
  bagHoldMinutes: number('BAG_HOLD_MINUTES', 30, { min: 1, max: 1440 }),
  returnWindowDays: number('RETURN_WINDOW_DAYS', 7, { max: 365 }),
  // Sign-up/login codes
  otpExpiryMinutes: number('OTP_EXPIRY_MINUTES', 10, { min: 1, max: 60 }),
  otpMaxAttempts: number('OTP_MAX_ATTEMPTS', 5, { min: 1, max: 20 }),
  // Delivery partners
  maxOpenJobsPerPartner: number('MAX_OPEN_JOBS_PER_PARTNER', 5, { min: 1, max: 100 }),
  // Admin (admin/backend/.env)
  defaultMarginPercent: number('DEFAULT_MARGIN_PERCENT', 5, { max: 100, integer: false }),
}

// True when the 6-digit PIN code is inside the delivery area (starts with DELIVERY_PIN_PREFIX).
export const inDeliveryArea = (pincode) => {
  const value = String(pincode ?? '').trim()
  return /^\d{6}$/.test(value) && value.startsWith(settings.deliveryPinPrefix)
}
export const deliveryFeeFor = (subtotal) => subtotal >= settings.freeDeliveryFrom ? 0 : settings.deliveryFee

// The settings the storefront shows or checks in the browser (served by the customer API at /api/shop-settings).
export const storefrontSettings = () => {
  const { customerEmailDomain, customerPasswordMinLength, deliveryPinPrefix, deliveryAreaName, deliveryCity, deliveryState, freeDeliveryFrom, deliveryFee, gstPercent, bagHoldMinutes, returnWindowDays } = settings
  return { customerEmailDomain, customerPasswordMinLength, deliveryPinPrefix, deliveryAreaName, deliveryCity, deliveryState, freeDeliveryFrom, deliveryFee, gstPercent, bagHoldMinutes, returnWindowDays }
}
