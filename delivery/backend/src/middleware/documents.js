// Licence and RC uploads for partner applications. Files are held in memory until the application passes every
// check, then written to private_uploads under a random name, so a rejected request leaves nothing on disk.
import multer from 'multer'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { unlink, writeFile } from 'node:fs/promises'
import { partnerDocuments } from '../../../../shared/deliveryPartners.js'

// Read lazily: roleServer loads .env after its imports are evaluated.
export const uploadDirectory = () => path.resolve(process.env.PRIVATE_UPLOADS_DIR || '../../private_uploads')

const badRequest = (message) => Object.assign(new Error(message), { status: 400, expose: true })
const sizeMessage = 'Each document must be a JPEG, PNG or PDF under 5 MB.'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2, fields: 30 },
  fileFilter: (request, file, done) => ['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype) ? done(null, true) : done(badRequest(sizeMessage)),
}).fields(Object.values(partnerDocuments).map(({ field }) => ({ name: field, maxCount: 1 })))

// Only multipart requests are parsed; JSON requests pass straight through.
export const documentUpload = (request, response, next) => upload(request, response, (error) => {
  if (error instanceof multer.MulterError) return next(badRequest(error.code === 'LIMIT_FILE_SIZE' ? sizeMessage : 'Upload one licence and one RC document only.'))
  return next(error)
})

// The browser-reported type is not trusted; the extension comes from the file's first bytes.
const extensionOf = (buffer) => {
  if (buffer.subarray(0, 4).toString('latin1') === '%PDF') return '.pdf'
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg'
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png'
  return null
}

// Checks the uploaded documents against the vehicle type. `existing` is the partner being resubmitted, whose earlier
// uploads count unless replaced. Returns { error } or { files: { licenceDoc: { buffer, extension }, ... } }.
export function checkDocuments(request, vehicleType, existing = null) {
  const files = {}
  for (const { field, label } of Object.values(partnerDocuments)) {
    const file = request.files?.[field]?.[0]
    if (file) {
      const extension = extensionOf(file.buffer)
      if (!extension) return { error: `Your ${label} must be a JPEG, PNG or PDF file.` }
      files[field] = { buffer: file.buffer, extension }
    } else if (vehicleType !== 'Bicycle' && !existing?.[field]) {
      return { error: `Upload a photo or PDF of your ${label}.` }
    }
  }
  return { files }
}

// Writes the checked files and returns their stored names, e.g. { licenceDoc: '<uuid>.jpg' }.
export async function saveDocuments(files) {
  const saved = {}
  try {
    for (const [field, { buffer, extension }] of Object.entries(files)) {
      const filename = `${randomUUID()}${extension}`
      await writeFile(path.join(uploadDirectory(), filename), buffer, { flag: 'wx' })
      saved[field] = filename
    }
  } catch (error) {
    await removeDocuments(Object.values(saved))
    throw error
  }
  return saved
}

export const removeDocuments = (filenames) => Promise.all(filenames.filter(Boolean).map((filename) => unlink(path.join(uploadDirectory(), path.basename(filename))).catch(() => undefined)))
