// Indian mobile numbers are 10 digits starting with 6, 7, 8 or 9 (TRAI numbering plan).
// Accepts common written forms (+91 98765 43210, 091-9876543210, 09876543210) and returns
// the bare 10-digit number, or null when the input is not a plausible Indian mobile number.
export function normalizeIndianMobile(input) {
  let digits = String(input ?? '').replace(/[\s\-().]/g, '')
  if (!/^\+?\d+$/.test(digits)) return null
  digits = digits.replace(/^\+/, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 13 && digits.startsWith('091')) digits = digits.slice(3)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (!/^[6-9]\d{9}$/.test(digits)) return null
  if (isPlaceholderNumber(digits)) return null
  return digits
}

// Rejects filler numbers people type to get past a form: 9999999999, 9000000000,
// 9876543210, 6789012345, 9898989898, 9123412341 and similar.
function isPlaceholderNumber(digits) {
  const rest = digits.slice(1)
  if (/^(\d)\1+$/.test(rest)) return true
  const steps = [...digits].slice(1).map((digit, index) => (Number(digit) - Number(digits[index]) + 10) % 10)
  if (steps.every((step) => step === 1) || steps.every((step) => step === 9)) return true
  for (const size of [2, 3, 4]) {
    const unit = digits.slice(0, size)
    if (unit.repeat(Math.ceil(10 / size)).slice(0, 10) === digits) return true
  }
  return new Set(digits).size <= 2
}

export const indianMobileMessage = 'Enter a valid Indian mobile number (10 digits starting with 6, 7, 8 or 9).'
