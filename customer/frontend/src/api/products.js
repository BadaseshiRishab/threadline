import { getJson } from './client'
import { mapDummyJsonProduct } from '../utils/product'

// The marketplace catalogue, or null when the API has none (or cannot be reached).
export async function fetchCatalog() {
  const result = await getJson('/products').catch(() => null)
  return Array.isArray(result?.products) && result.products.length ? result.products : null
}

// Shown when the API has no products, so the storefront is never empty.
export async function fetchDummyJsonCatalog() {
  const response = await fetch('https://dummyjson.com/products?limit=0')
  if (!response.ok) throw new Error(`DummyJSON returned HTTP ${response.status}`)
  const payload = await response.json()
  if (!Array.isArray(payload.products)) throw new Error('DummyJSON returned an invalid product list')
  return payload.products.map(mapDummyJsonProduct)
}

export async function fetchProducts() {
  return await fetchCatalog() || await fetchDummyJsonCatalog()
}
