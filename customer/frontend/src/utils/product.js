export const productId = (product) => product.id || product._id || product.name

export function brandOf(product) {
  return product.catalogData?.brand || product.seller?.application?.businessName || ''
}

export function priceOf(product) {
  return product.salePrice ?? product.sellingPrice ?? product.cost
}

export function mrpOf(product) {
  return product.sellingPrice ?? product.cost
}

export function discountOf(product) {
  const price = priceOf(product)
  const mrp = mrpOf(product)
  return Math.round(product.salePercent || (mrp > price && mrp > 0 ? (mrp - price) / mrp * 100 : 0))
}

// [value, count] pairs for the values key() returns, most common first.
export function countBy(items, key) {
  const counts = new Map()
  items.forEach((item) => { const value = key(item); if (value) counts.set(value, (counts.get(value) || 0) + 1) })
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export const productPath = (product) => `/product/${encodeURIComponent(productId(product))}`

// The 12 most stocked category / subcategory pairs, each with a photo and its best discount.
export function categoryTilesOf(catalog) {
  return countBy(catalog, (product) => `${product.category}::${product.subcategory}`).slice(0, 12).map(([key]) => {
    const [category, subcategory] = key.split('::')
    const items = catalog.filter((product) => product.category === category && product.subcategory === subcategory)
    return { category, subcategory, image: items.find((product) => product.imageUrl)?.imageUrl || '', discount: Math.max(0, ...items.map(discountOf)) }
  })
}

// DummyJSON is the fallback catalogue when the API has no products; its categories map onto ours.
const dummyJsonCategories = {
  beauty: ['Beauty', 'Makeup'], fragrances: ['Beauty', 'Fragrance'], furniture: ['Home', 'Furniture'], groceries: ['Grocery', 'Groceries'],
  'home-decoration': ['Home', 'Home Decor'], 'kitchen-accessories': ['Home', 'Kitchen'], laptops: ['Electronics', 'Laptops'],
  'mens-shirts': ['Men', 'Shirts'], 'mens-shoes': ['Men', 'Shoes'], 'mens-watches': ['Men', 'Watches'],
  'mobile-accessories': ['Electronics', 'Mobile Accessories'], motorcycle: ['Automotive', 'Motorcycles'], 'skin-care': ['Beauty', 'Skin Care'],
  smartphones: ['Electronics', 'Smartphones'], 'sports-accessories': ['Sports', 'Sports Accessories'], sunglasses: ['Accessories', 'Sunglasses'],
  tablets: ['Electronics', 'Tablets'], tops: ['Women', 'Tops'], vehicle: ['Automotive', 'Vehicles'], 'womens-bags': ['Women', 'Bags'],
  'womens-dresses': ['Women', 'Dresses'], 'womens-jewellery': ['Women', 'Jewellery'], 'womens-shoes': ['Women', 'Shoes'], 'womens-watches': ['Women', 'Watches'],
}

export function mapDummyJsonProduct(source) {
  const [category, subcategory] = dummyJsonCategories[source.category] || [source.category, 'Products']
  const originalPrice = Number((source.price * 83.5).toFixed(2))
  const discount = Math.min(100, Math.max(0, Number(source.discountPercentage || 0)))
  const images = (source.images || []).filter(Boolean)
  const reviews = (source.reviews || []).map(({ rating, comment, date, reviewerName }) => ({ rating, comment, date, reviewerName }))
  const stock = Math.max(0, Number(source.stock || 0))
  return {
    id: `dummyjson-${source.id}`,
    name: source.title,
    tagline: source.description.slice(0, 180),
    description: source.description,
    category,
    subcategory,
    cost: originalPrice,
    sellingPrice: originalPrice,
    salePrice: Number((originalPrice * (1 - discount / 100)).toFixed(2)),
    salePercent: discount,
    stock: { 'One size': stock },
    stockTotal: stock,
    outOfStock: stock === 0,
    ratingAverage: Number(source.rating || 0),
    reviewCount: reviews.length,
    imageUrl: source.thumbnail || images[0] || '',
    catalogData: { ...source, category: source.category, images, reviews },
  }
}
