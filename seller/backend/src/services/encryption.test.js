import test from 'node:test'
import assert from 'node:assert/strict'
import { decryptAccountNumber, encryptAccountNumber, protectApplication, revealApplication } from './encryption.js'

process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 42).toString('base64')

test('account numbers are encrypted and can be decrypted', () => {
  const encrypted = encryptAccountNumber('123456789012')
  assert.notEqual(encrypted, '123456789012')
  assert.equal(decryptAccountNumber(encrypted), '123456789012')
})

test('seller application protection does not double-encrypt account numbers', () => {
  const protectedApplication = protectApplication({ accountNumber: '123456789012', bankName: 'Example Bank' })
  assert.equal(protectApplication(protectedApplication).accountNumber, protectedApplication.accountNumber)
  assert.deepEqual(revealApplication(protectedApplication), { accountNumber: '123456789012', bankName: 'Example Bank' })
})

test('invalid encryption keys are rejected', () => {
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString('base64')
  assert.throws(() => encryptAccountNumber('1234'), /32-byte key/)
  process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 42).toString('base64')
})