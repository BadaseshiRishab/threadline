// Mirrors customer/backend/src/utils/indianMobile.js — keep the two in sync.
export const indianMobileMessage = 'Enter a valid Indian mobile number (10 digits starting with 6, 7, 8 or 9).'

export function normalizeIndianMobile(input) {
  let digits = input.replace(/[\s\-().]/g, '')
  if (!/^\+?\d+$/.test(digits)) return null
  digits = digits.replace(/^\+/, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 13 && digits.startsWith('091')) digits = digits.slice(3)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (!/^[6-9]\d{9}$/.test(digits)) return null
  const rest = digits.slice(1)
  if (/^(\d)\1+$/.test(rest)) return null
  const steps = [...digits].slice(1).map((digit, index) => (Number(digit) - Number(digits[index]) + 10) % 10)
  if (steps.every((step) => step === 1) || steps.every((step) => step === 9)) return null
  if ([2, 3, 4].some((size) => digits.slice(0, size).repeat(Math.ceil(10 / size)).slice(0, 10) === digits)) return null
  if (new Set(digits).size <= 2) return null
  return digits
}

// Only complain once the person has typed a full number, not while they are still typing.
export function mobileError(value) {
  return value.replace(/\D/g, '').length >= 10 && !normalizeIndianMobile(value) ? indianMobileMessage : ''
}
