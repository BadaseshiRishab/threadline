import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const marker = 'enc:v1:'

function getKey() {
  const key = Buffer.from(process.env.DATA_ENCRYPTION_KEY || '', 'base64')
  if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.')
  return key
}

export function encryptAccountNumber(value) {
  if (!value || String(value).startsWith(marker)) return value
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  return `${marker}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`
}

export function decryptAccountNumber(value) {
  if (!value || !String(value).startsWith(marker)) return value
  const [, , ivText, tagText, ciphertextText] = String(value).split(':')
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivText, 'base64'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64')), decipher.final()]).toString('utf8')
}

export function protectApplication(application) {
  return {
    ...application,
    ...(application.accountNumber ? { accountNumber: encryptAccountNumber(application.accountNumber) } : {}),
  }
}

export function revealApplication(application) {
  return {
    ...application,
    ...(application.accountNumber ? { accountNumber: decryptAccountNumber(application.accountNumber) } : {}),
  }
}

export function validateEncryptionKey() {
  getKey()
}