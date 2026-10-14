export const navItems = ['Men', 'Women', 'Kids', 'Home', 'Beauty', 'GenZ', 'Studio']
export const navColors = { Men: '#ee5f73', Women: '#fb56c1', Kids: '#f26a10', Home: '#f2c210', Beauty: '#0db7af', GenZ: '#ff3f6c', Studio: '#ff3f6c' }
export const categoryRoutes = { Men: '/men', Women: '/women', Kids: '/kids', Home: '/living', Beauty: '/beauty' }
export const heroSlides = [
  { kicker: 'THE NEW SEASON EDIT', title: 'Fresh fits for every plan', image: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1600&q=85', background: '#fbe4e4', accent: '#ff3f6c', route: '/women' },
  { kicker: 'THE MEN\'S EDIT', title: 'Made for the everyday', image: 'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=1600&q=85', background: '#e3eef8', accent: '#3466b5', route: '/men' },
  { kicker: 'THE BEAUTY EDIT', title: 'Your glow, your rules', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1600&q=85', background: '#e2f4f1', accent: '#0d8f88', route: '/beauty' },
]
export const tileTones = ['#fde8ec', '#e7f1fd', '#fdf2e1', '#e6f6f0', '#f0eafc', '#fff5d6']
export const priceBuckets = [
  { id: 'under-500', label: 'Under ₹500', min: 0, max: 500 },
  { id: '500-999', label: '₹500 to ₹999', min: 500, max: 1000 },
  { id: '1000-2499', label: '₹1,000 to ₹2,499', min: 1000, max: 2500 },
  { id: '2500-4999', label: '₹2,500 to ₹4,999', min: 2500, max: 5000 },
  { id: '5000-9999', label: '₹5,000 to ₹9,999', min: 5000, max: 10000 },
  { id: '10000-plus', label: '₹10,000 and above', min: 10000, max: Infinity },
]
export const discountSteps = [10, 20, 30, 40, 50, 60, 70, 80]
export const sortOptions = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'popularity', label: 'Popularity' },
  { id: 'discount', label: 'Better Discount' },
  { id: 'price-desc', label: 'Price: High to Low' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'rating', label: 'Customer Rating' },
]
export const emptyProfile = { name: '', email: '', phone: '', gender: '', dateOfBirth: '', alternateMobile: '', location: '' }
export const emptyAddressDraft = { name: '', phone: '', line: '', locality: '', city: '', state: '', pincode: '', type: 'Home' }
export const departments = [
  { label: 'Men', image: 'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=700&q=80' },
  { label: 'Women', image: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=700&q=80' },
  { label: 'Kids', image: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=700&q=80' },
  { label: 'Home', image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=700&q=80' },
  { label: 'Beauty', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=700&q=80' },
]
export const emptyFilters = { categories: [], types: [], brands: [], prices: [], discount: 0 }

export const orderSteps = ['placed', 'packed', 'shipped', 'out_for_delivery', 'delivered']
export const orderStatusLabels = { placed: 'Order placed', packed: 'Packed', shipped: 'Shipped', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' }
// Shop settings from .env ("Shop settings" in seller/backend/.env), loaded from the customer API at /api/shop-settings.
// These defaults are used until it answers, or if it cannot be reached.
export const defaultShopSettings = { customerEmailDomain: 'gmail.com', customerPasswordMinLength: 8, deliveryPinPrefix: '560', deliveryAreaName: 'Bangalore', deliveryCity: 'Bengaluru', deliveryState: 'Karnataka', freeDeliveryFrom: 1499, deliveryFee: 99, gstPercent: 18, bagHoldMinutes: 30, returnWindowDays: 7 }
// Mirrors the customer API: delivered items can be returned within returnWindowDays (above), for one of these reasons.
export const returnReasons = ['Size too small', 'Size too large', 'Quality not as expected', 'Received a damaged or defective item', 'Received a different item', 'Item does not match the description or photos', 'No longer needed']

// Pages that need a signed-in customer; anyone else is sent to /login.
export const signedInPages = ['/account', '/profile', '/orders', '/address']
// Pages drawn by the account, bag and checkout screens instead of the storefront.
export const accountPages = ['/login', '/account', '/profile', '/address', '/wishlist', '/cart', '/checkout', '/orders']
