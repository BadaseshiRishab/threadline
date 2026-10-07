// Sets the admin login to ADMIN_EMAIL / ADMIN_PASSWORD from the environment. The API only creates the admin when the
// database has none, so after importing a database (whose admin keeps its old password) run this once:
//   docker compose exec admin-api node scripts/setAdminPassword.js      (on the server)
//   npm --prefix admin/backend run admin:password                       (locally, using admin/backend/.env)
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { Admin } from '../src/models/index.js'

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
const password = String(process.env.ADMIN_PASSWORD || '')

try {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to a valid email address.')
  if (password.length < 12) throw new Error('Set ADMIN_PASSWORD to at least 12 characters.')
  if (password === 'admin123') throw new Error('ADMIN_PASSWORD is the public example value. Choose your own.')
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set.')
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
  const passwordHash = await bcrypt.hash(password, 12)
  const admins = await Admin.find().select('email').lean()
  // With a single admin account (the usual case) it takes the new email too; otherwise only the matching account changes.
  const target = admins.length === 1 ? admins[0] : admins.find((admin) => admin.email === email)
  if (target) await Admin.updateOne({ _id: target._id }, { $set: { email, passwordHash } })
  else await Admin.create({ email, passwordHash })
  console.log(`Admin login set for ${email}${target ? '' : ' (new account)'}. Sign in again on the admin site.`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
