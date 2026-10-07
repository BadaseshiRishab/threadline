// Imports the Threadline fashion, home and beauty catalog from data/threadlineCatalog.json.
// Safe to re-run: products are matched by sourceId, and stock and customer reviews are only
// written on first insert so later orders and reviews are never overwritten.
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { Seller } from './src/models/index.js'
import Product from './src/models/Product.js'

const sourceProvider = 'threadline-catalog'
const catalog = JSON.parse(readFileSync(new URL('./data/threadlineCatalog.json', import.meta.url), 'utf8'))

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required in seller/backend/.env')
  await mongoose.connect(process.env.MONGODB_URI)

  const businessNames = [...new Set(catalog.products.map((product) => product.sellerBusinessName))]
  const sellers = await Seller.find({ 'application.businessName': { $in: businessNames }, email: /@threadline\.test$/ }).select('application.businessName').lean()
  const sellerByName = new Map(sellers.map((seller) => [seller.application.businessName, seller._id]))
  const missing = businessNames.filter((name) => !sellerByName.has(name))
  if (missing.length) throw new Error(`Catalog sellers not found: ${missing.join(', ')}. Run "npm run seed:sellers" first.`)

  let created = 0
  let updated = 0
  for (const { sellerBusinessName, sourceId, stock, reviews, ratingAverage, reviewCount, ...product } of catalog.products) {
    const result = await Product.updateOne(
      { sourceProvider, sourceId },
      {
        $set: { ...product, seller: sellerByName.get(sellerBusinessName), sourceProvider, sourceId, status: 'approved', marginPercent: 0, marginAmount: 0 },
        $setOnInsert: { stock, reviews, ratingAverage, reviewCount, reviewedAt: new Date() },
      },
      { upsert: true, runValidators: true },
    )
    if (result.upsertedCount) created += 1
    else updated += 1
  }

  const counts = await Product.aggregate([{ $match: { sourceProvider, status: 'approved' } }, { $group: { _id: '$category', products: { $sum: 1 }, subcategories: { $addToSet: '$subcategory' } } }, { $sort: { _id: 1 } }])
  console.log(`Threadline catalog: ${created} created, ${updated} refreshed.`)
  counts.forEach((row) => console.log(`  ${row._id.padEnd(7)} ${String(row.products).padStart(3)} products in ${row.subcategories.length} sub-categories`))
  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => undefined)
  process.exitCode = 1
})
