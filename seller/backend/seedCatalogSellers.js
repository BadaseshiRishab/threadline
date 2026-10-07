import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { Seller } from './src/models/index.js'
import Product from './src/models/Product.js'

const sellerPassword = process.env.SEED_SELLER_PASSWORD || 'ThreadlineSeller2026!'
const dummyJsonUrl = (process.env.DUMMYJSON_API_URL || 'https://dummyjson.com').replace(/\/$/, '')
const sellers = [
  ['01', 'Aster & Loom'],
  ['02', 'Northstar Goods'],
  ['03', 'Mitti Studio'],
  ['04', 'Sunday Standard'],
  ['05', 'Common Thread'],
  ['06', 'House of Mira'],
]
const dummyCategories = {
  beauty: ['Beauty', 'Makeup'],
  fragrances: ['Beauty', 'Fragrance'],
  furniture: ['Home', 'Furniture'],
  groceries: ['Grocery', 'Groceries'],
  'home-decoration': ['Home', 'Home Decor'],
  'kitchen-accessories': ['Home', 'Kitchen'],
  laptops: ['Electronics', 'Laptops'],
  'mens-shirts': ['Men', 'Shirts'],
  'mens-shoes': ['Men', 'Shoes'],
  'mens-watches': ['Men', 'Watches'],
  'mobile-accessories': ['Electronics', 'Mobile Accessories'],
  motorcycle: ['Automotive', 'Motorcycles'],
  'skin-care': ['Beauty', 'Skin Care'],
  smartphones: ['Electronics', 'Smartphones'],
  'sports-accessories': ['Sports', 'Sports Accessories'],
  sunglasses: ['Accessories', 'Sunglasses'],
  tablets: ['Electronics', 'Tablets'],
  tops: ['Women', 'Tops'],
  vehicle: ['Automotive', 'Vehicles'],
  'womens-bags': ['Women', 'Bags'],
  'womens-dresses': ['Women', 'Dresses'],
  'womens-jewellery': ['Women', 'Jewellery'],
  'womens-shoes': ['Women', 'Shoes'],
  'womens-watches': ['Women', 'Watches'],
}

const clothingSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const footwearSizes = ['36', '37', '38', '39', '40', '41', '42']
const sizesByCategory = {
  'mens-shirts': clothingSizes,
  tops: clothingSizes,
  'womens-dresses': clothingSizes,
  'mens-shoes': footwearSizes,
  'womens-shoes': footwearSizes,
}

function buildStock(sourceCategory, total) {
  const sizes = sizesByCategory[sourceCategory]
  if (!sizes) return { 'One size': total }
  const base = Math.floor(total / sizes.length)
  const remainder = total % sizes.length
  return Object.fromEntries(sizes.map((size, index) => [size, base + (index < remainder ? 1 : 0)]))
}

function mapCatalogProduct(product) {
  const sourceCategory = String(product.category || '').toLowerCase()
  const mapped = dummyCategories[sourceCategory]
  if (!mapped) return null
  const title = String(product.title || 'Untitled product')
  const description = String(product.description || 'Thoughtfully selected for everyday living.')
  const rawPrice = Number(product.price)
  if (!Number.isFinite(rawPrice) || rawPrice <= 0) return null
  const multiplier = Number(process.env.DUMMYJSON_PRICE_MULTIPLIER || 83.5)
  const sourceDiscount = Math.min(100, Math.max(0, Number(product.discountPercentage || 0)))
  const discount = Number(product.id) % 7 === 0 && sourceDiscount >= 10 && sourceDiscount <= 90 ? sourceDiscount : 0
  const originalPrice = Number((rawPrice * multiplier).toFixed(2))
  const reviews = Array.isArray(product.reviews) ? product.reviews.map((review) => ({
    rating: Number(review.rating || 0),
    comment: String(review.comment || ''),
    date: review.date || '',
    reviewerName: String(review.reviewerName || ''),
  })) : []
  const images = Array.isArray(product.images) ? product.images.filter((image) => typeof image === 'string' && image) : []
  return {
    sourceId: String(product.id),
    sourceProvider: 'dummyjson',
    name: title.slice(0, 160),
    tagline: description.slice(0, 180),
    category: mapped[0],
    subcategory: mapped[1],
    cost: originalPrice,
    sellingPrice: originalPrice,
    salePercent: discount,
    description: description.slice(0, 5000),
    imageUrl: String(product.thumbnail || images[0] || '').replace(/^http:/, 'https:'),
    stock: buildStock(sourceCategory, Math.max(0, Number(product.stock || 0))),
    reviews,
    ratingAverage: Number(product.rating || 0),
    reviewCount: reviews.length,
    catalogData: {
      ...product,
      category: sourceCategory,
      images,
      thumbnail: String(product.thumbnail || images[0] || '').replace(/^http:/, 'https:'),
      reviews,
    },
  }
}

async function loadCatalog() {
  const response = await fetch(`${dummyJsonUrl}/products?limit=0`, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`DummyJSON returned HTTP ${response.status}`)
  const payload = await response.json()
  if (!Array.isArray(payload.products)) throw new Error('DummyJSON returned an invalid product list.')
  const products = payload.products.map(mapCatalogProduct).filter(Boolean)
  if (payload.total && products.length < payload.total) throw new Error(`DummyJSON catalog is incomplete (${products.length} of ${payload.total} products).`)
  if (!products.length) throw new Error('Catalog sources returned no usable products.')
  return products
}

const run = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required in seller/backend/.env')
  await mongoose.connect(process.env.MONGODB_URI)
  const catalog = await loadCatalog()
  const passwordHash = await bcrypt.hash(sellerPassword, 12)
  const sellerRecords = []

  for (let index = 0; index < sellers.length; index += 1) {
    const [suffix, businessName] = sellers[index]
    const email = `seller${suffix}@threadline.test`
    const phone = String(9000000000 + index + 1)
    const seller = await Seller.findOneAndUpdate(
      { email },
      {
        $set: {
          email,
          phone,
          passwordHash,
          sellerStatus: 'approved',
          application: { businessName, primaryName: `${businessName} team`, primaryEmail: email, primaryPhone: phone, sellingMode: 'marketplace' },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    sellerRecords.push(seller)
  }

  const firstCatalogProduct = await Product.findOne({ sourceProvider: 'dummyjson' }).sort({ createdAt: 1 }).select('createdAt').lean()
  const legacyCatalogCutoff = firstCatalogProduct?.createdAt || new Date()
  await Product.updateMany(
    { status: 'approved', createdAt: { $lt: legacyCatalogCutoff }, $or: [{ sourceProvider: 'seller' }, { sourceProvider: { $exists: false } }] },
    { $set: { sourceProvider: 'seller-legacy' } },
  )
  await Product.updateMany(
    { sourceProvider: { $in: ['catalogService-seed', 'shoppingwebsite-json'] }, status: { $ne: 'rejected' } },
    { $set: { status: 'rejected', reviewedAt: new Date() } },
  )
  let seededProducts = 0
  for (let index = 0; index < catalog.length; index += 1) {
    const source = catalog[index]
    const seller = sellerRecords[index % sellerRecords.length]
    await Product.findOneAndUpdate(
      { seller: seller.id, sourceProvider: source.sourceProvider, sourceId: source.sourceId },
      { $set: { ...source, seller: seller.id, status: 'approved', marginPercent: 0, marginAmount: 0 } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    )
    seededProducts += 1
  }

  console.log(`Created or refreshed ${sellerRecords.length} catalog sellers and published ${seededProducts} DummyJSON products.`)
  console.log(`Seed seller password: ${sellerPassword}`)
  sellerRecords.forEach((seller) => console.log(`${seller.email} / ${seller.phone}`))
  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => undefined)
  process.exitCode = 1
})
