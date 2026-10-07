// One-time migration: splits the shared `users` collection into `sellers`, `customers` and `admins`.
//   npm run migrate:accounts            (from the repo root)
// Safe to re-run. Every account keeps its _id, so existing links (products.seller, orders.customer, …)
// stay valid. Before changing anything it writes a JSON backup of every collection, and afterwards it keeps
// the old collection as `users_legacy_backup` instead of deleting it.
import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import mongoose from 'mongoose'
import { defineModels } from '../../../shared/models.js'

const { Seller, Customer, Admin, Product, Order, Reservation, RestockRequest, Verification } = defineModels(mongoose)
const pick = (doc, fields) => Object.fromEntries(fields.filter((field) => doc[field] !== undefined).map((field) => [field, doc[field]]))
const accountFields = {
  seller: { model: Seller, fields: ['_id', 'email', 'phone', 'passwordHash', 'emailVerifiedAt', 'phoneVerifiedAt', 'sellerStatus', 'application', 'createdAt', 'updatedAt'] },
  customer: { model: Customer, fields: ['_id', 'email', 'phone', 'passwordHash', 'customerProfile', 'addresses', 'cart', 'wishlist', 'failedLoginAttempts', 'loginLockLevel', 'loginLockedUntil', 'createdAt', 'updatedAt'] },
  admin: { model: Admin, fields: ['_id', 'email', 'passwordHash', 'createdAt', 'updatedAt'] },
}

async function backup(db) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const directory = path.resolve(process.env.DB_BACKUP_DIR || '../../../ravi-db-backup', stamp)
  await mkdir(directory, { recursive: true })
  for (const { name } of await db.listCollections().toArray()) {
    const docs = await db.collection(name).find().toArray()
    await writeFile(path.join(directory, `${name}.json`), mongoose.mongo.BSON.EJSON.stringify(docs, null, 2, { relaxed: false }))
  }
  return directory
}

async function moveAccounts(db) {
  const users = await db.collection('users').find().toArray()
  const unknown = users.filter((user) => !accountFields[user.role])
  if (unknown.length) throw new Error(`Accounts with an unknown role: ${unknown.map((user) => `${user.email} (${user.role})`).join(', ')}`)
  const moved = { seller: 0, customer: 0, admin: 0 }
  for (const user of users) {
    const { model, fields } = accountFields[user.role]
    await model.collection.replaceOne({ _id: user._id }, pick(user, fields), { upsert: true })
    moved[user.role] += 1
  }
  return { total: users.length, moved }
}

// Every document must pass its new schema, and every link between collections must point at a real record.
async function verify() {
  const problems = []
  for (const model of [Seller, Customer, Admin, Product, Order, Reservation, RestockRequest, Verification]) {
    for (const doc of await model.find().select(model === Product ? {} : '+passwordHash').lean()) {
      const error = new model(doc).validateSync()
      if (error) problems.push(`${model.modelName} ${doc._id}: ${Object.values(error.errors).map((entry) => entry.message).join('; ')}`)
    }
  }
  const ids = async (model) => new Set((await model.find().select('_id').lean()).map((doc) => String(doc._id)))
  const [sellers, customers, admins, products] = await Promise.all([ids(Seller), ids(Customer), ids(Admin), ids(Product)])
  const missing = (label, values, set) => { const bad = values.filter((value) => value && !set.has(String(value))); if (bad.length) problems.push(`${label}: ${bad.length} link(s) to records that do not exist`) }
  const productDocs = await Product.find().select('seller reviewedBy').lean()
  missing('products.seller → sellers', productDocs.map((doc) => doc.seller), sellers)
  missing('products.reviewedBy → admins', productDocs.map((doc) => doc.reviewedBy), admins)
  const orders = await Order.find().lean()
  missing('orders.customer → customers', orders.map((order) => order.customer), customers)
  missing('orders.items.seller → sellers', orders.flatMap((order) => order.items.map((item) => item.seller)), sellers)
  const reservations = await Reservation.find().lean()
  missing('reservations.customer → customers', reservations.map((doc) => doc.customer), customers)
  missing('reservations.product → products', reservations.map((doc) => doc.product), products)
  const restocks = await RestockRequest.find().lean()
  missing('restockrequests.seller → sellers', restocks.map((doc) => doc.seller), sellers)
  missing('restockrequests.requestedBy → admins', restocks.map((doc) => doc.requestedBy), admins)
  missing('restockrequests.product → products', restocks.map((doc) => doc.product), products)
  // Order items keep a snapshot of the product, so a deleted product is reported but is not an error.
  const deletedProducts = orders.flatMap((order) => order.items).filter((item) => !products.has(String(item.product)))
  return { problems, deletedProducts: deletedProducts.map((item) => item.name), counts: { sellers: sellers.size, customers: customers.size, admins: admins.size, products: products.size, orders: orders.length } }
}

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required in seller/backend/.env')
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db
  const collections = new Set((await db.listCollections().toArray()).map((entry) => entry.name))

  console.log(`Backup written to ${await backup(db)}`)
  if (collections.has('users')) {
    const { total, moved } = await moveAccounts(db)
    console.log(`Moved ${total} accounts: ${moved.seller} sellers, ${moved.customer} customers, ${moved.admin} admins.`)
  } else {
    console.log('No `users` collection found; accounts were already split.')
  }

  for (const model of [Seller, Customer, Admin, Product, Order, Reservation, RestockRequest, Verification]) await model.syncIndexes()
  console.log('Indexes match the shared schemas.')

  const { problems, deletedProducts, counts } = await verify()
  console.log('Collection counts:', JSON.stringify(counts))
  if (deletedProducts.length) console.log(`Note: ${deletedProducts.length} order item(s) refer to products that were deleted (kept as snapshots): ${deletedProducts.join(', ')}`)
  if (problems.length) {
    console.error(`Integrity check FAILED (the old users collection was left in place):\n  ${problems.join('\n  ')}`)
    process.exitCode = 1
  } else {
    console.log('Integrity check passed: every document matches its schema and every link resolves.')
    if (collections.has('users')) {
      await db.collection('users').rename('users_legacy_backup', { dropTarget: true })
      console.log('Renamed the old `users` collection to `users_legacy_backup`.')
    }
  }
  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => undefined)
  process.exitCode = 1
})
