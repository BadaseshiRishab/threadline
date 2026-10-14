export const ADMIN_PORTAL_URL = process.env.ADMIN_PORTAL_URL || 'http://localhost:5174'

export const initialProfile = {
  gstin: '',
  businessName: '',
  primaryName: '',
  primaryEmail: '',
  primaryPhone: '',
  sameOwner: true,
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  sellerAddress: '',
  sellerCity: '',
  sellerState: '',
  sellerPincode: '',
  sameWarehouse: true,
  warehouseAddress: '',
  warehouseCity: '',
  warehouseState: '',
  warehousePincode: '',
  signature: '',
  bankName: '',
  accountType: '',
  ifsc: '',
  accountNumber: '',
  accountHolder: '',
  sellingMode: 'marketplace',
  marketplaceName: '',
  marketplaceRating: '',
  websiteUrl: '',
}

export const emptyProduct = {
  name: '',
  tagline: '',
  category: 'Women',
  subcategory: 'Dresses',
  cost: '',
  description: '',
  imageUrl: '',
  stock: {},
}

export const productCategories = {
  Women: ['Dresses', 'Tops', 'Kurtas', 'Jeans'],
  Men: ['Shirts', 'T-shirts', 'Jeans', 'Kurtas'],
  Footwear: ['Sneakers', 'Sandals', 'Heels', 'Flats'],
  Accessories: ['Bags', 'Belts', 'Jewellery', 'Scarves'],
}

export const onboardingSteps = ['Business', 'People & address', 'Bank details', 'Selling online']

export const dashboardTabLabels = { overview: 'OVERVIEW', products: 'PRODUCTS', orders: 'ORDERS', returns: 'RETURNS', restock: 'RESTOCK REQUESTS', 'add-product': 'ADD PRODUCT' }

// An accepted return comes back with a delivery partner; the return code to give them arrives by SMS.
export const returnPickupLabels = { awaiting_partner: 'Waiting for a delivery partner', assigned: 'Partner collecting from customer', picked_up: 'On its way back to you', returned: 'Returned to you' }
