// Delivery partner rules shared by the delivery API (applications) and the admin API (reviews and edits).

export const vehicleTypes = ['Bike', 'Scooter', 'Bicycle', 'Van']
// How many undelivered orders one partner may hold at a time, so nobody hoards the pool.
export const maxOpenJobs = 5

// Documents an applicant uploads, keyed by the name used in URLs. Both are required for motor vehicles.
export const partnerDocuments = {
  licence: { field: 'licenceDoc', label: 'driving licence' },
  rc: { field: 'rcDoc', label: 'vehicle RC (registration certificate)' },
}
export const documentFlags = (partner) => ({ licence: Boolean(partner.licenceDoc), rc: Boolean(partner.rcDoc) })

const compact =(value) => String(value ?? '').replace(/[\s-]/g, '').toUpperCase()

// Validates the partner fields present in body. With `complete`, every field is required (a new or resubmitted
// application); otherwise only the fields sent are checked (an admin edit). Returns { error } or { values, password }.
export function partnerFields(body, { complete = false, requirePassword = false } = {}) {
  const has = (field) => complete || body[field] !== undefined
  const values = {}
  if (has('name')) values.name = String(body.name ?? '').trim()
  if (has('email')) values.email = String(body.email ?? '').trim().toLowerCase()
  if (has('phone')) values.phone = String(body.phone ?? '').replace(/[\s-]/g, '').replace(/^(\+91|0)/, '')
  if (has('vehicleType')) values.vehicleType = String(body.vehicleType ?? '')
  if (has('vehicleNumber')) values.vehicleNumber = compact(body.vehicleNumber)
  if (has('licenceNumber')) values.licenceNumber = compact(body.licenceNumber)
  if (has('area')) values.area = String(body.area ?? '').trim()

  if (values.name !== undefined && (values.name.length < 2 || values.name.length > 80)) return { error: 'Enter your full name (up to 80 characters).' }
  if (values.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return { error: 'Enter a valid email address.' }
  if (values.phone !== undefined && !/^[6-9]\d{9}$/.test(values.phone)) return { error: 'Enter a valid 10-digit Indian mobile number.' }
  if (values.vehicleType !== undefined && !vehicleTypes.includes(values.vehicleType)) return { error: 'Choose a vehicle type.' }
  if (values.area !== undefined && (!values.area || values.area.length > 80)) return { error: 'Enter the Bangalore area you want to deliver in.' }
  // Bicycles need neither a registration number nor a licence.
  const motorised = values.vehicleType !== 'Bicycle'
  if (values.vehicleNumber !== undefined && (motorised || values.vehicleNumber) && !/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(values.vehicleNumber)) return { error: 'Enter a valid vehicle registration number, e.g. KA01AB1234.' }
  if (values.licenceNumber !== undefined && (motorised || values.licenceNumber) && !/^[A-Z]{2}\d{2}[0-9A-Z]{7,14}$/.test(values.licenceNumber)) return { error: 'Enter a valid driving licence number, e.g. KA0120190001234.' }

  const password = String(body.password ?? '')
  if ((requirePassword || password) && password.length < 8) return { error: 'The password must be at least 8 characters.' }
  return { values, password }
}
