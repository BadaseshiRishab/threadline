import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { ArrowLeft, ArrowUpDown, Banknote, Check, ChevronDown, Copy, LogOut, Pencil, ChevronLeft, ChevronRight, CreditCard, Heart, QrCode, MapPin, Menu, Minus, PackageCheck, Plus, RotateCcw, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Smartphone, Star, Tag, Trash2, Truck, UserRound, X } from 'lucide-react'
import './App.css'

type ProductReview = { rating: number; comment: string; date?: string; createdAt?: string; reviewerName?: string; customerName?: string }
type ProductCatalogData = {
  category?: string
  brand?: string
  sku?: string
  weight?: number
  dimensions?: { width?: number; height?: number; depth?: number }
  warrantyInformation?: string
  shippingInformation?: string
  availabilityStatus?: string
  returnPolicy?: string
  minimumOrderQuantity?: number
  tags?: string[]
  images?: string[]
  reviews?: ProductReview[]
  meta?: { createdAt?: string; updatedAt?: string; barcode?: string; qrCode?: string }
  specifications?: Record<string, string>
  photoCredit?: { source?: string; photographer?: string; photographerUrl?: string; photoUrl?: string }
}
type Product = {
  _id?: string
  id?: string
  name: string
  tagline?: string
  description?: string
  category: string
  subcategory: string
  cost: number
  sellingPrice?: number | null
  salePrice?: number
  salePercent?: number
  outOfStock?: boolean
  stockTotal?: number
  stock?: Record<string, number>
  ratingAverage?: number
  reviewCount?: number
  reviews?: ProductReview[]
  imageUrl: string
  catalogData?: ProductCatalogData
  seller?: { application?: { businessName?: string } }
}

type FilterKey = 'categories' | 'types' | 'brands' | 'prices'
type Filters = Record<FilterKey, string[]> & { discount: number }
type MenuGroup = { title: string; kind: 'types' | 'brands' | 'prices'; items: Array<{ value: string; label: string }> }
type CartItem = Product & { quantity: number; size?: string; reservedUntil?: string }
type Address = { id: string; name: string; phone: string; line: string; locality?: string; city: string; state: string; pincode: string; type: string }
type CustomerProfile = { name: string; email: string; phone: string; gender?: string; dateOfBirth?: string; alternateMobile?: string; location?: string; memberSince?: string }
type ReturnRequest = { status: 'requested' | 'approved' | 'rejected'; reason: string; message: string; sellerMessage?: string; requestedAt: string; resolvedAt?: string; restockedQuantity?: number }
// After the seller accepts a return, a delivery partner collects it; the return code to give them comes by SMS.
type ReturnPickup = { status: 'awaiting_partner' | 'assigned' | 'picked_up' | 'returned'; codeSent?: boolean; partner: { name: string; phone: string; vehicleNumber?: string } | null; assignedAt?: string; pickedUpAt?: string; returnedAt?: string }
type OrderItem = { _id: string; product?: string; name: string; imageUrl?: string; size?: string; quantity: number; unitPrice: number; returnRequest?: ReturnRequest; returnPickup?: ReturnPickup | null }
type PaymentMethod = 'cod' | 'razorpay' | 'upi' | 'phonepe'
type PaymentOptions = { cod: boolean; razorpay: boolean; upi: boolean; upiId: string; upiPayeeName: string; phonepe?: boolean; paymentWindowMinutes: number }
// The PhonePe return page (/payment/phonepe?order=<id>) while it asks the API how the payment went.
type PhonePeReturn = { orderId: string; state: 'checking' | 'pending' | 'failed' }
type RazorpayPayment = { keyId: string; razorpayOrderId: string; amount: number; currency: string }
type UpiPaymentDetails = { upiId: string; payeeName: string; link: string; expiresAt: string }
type UpiPayment = UpiPaymentDetails & { orderId: string; total: number; qr: string; transactionId: string; sending: boolean; error: string }
type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }
}
// Razorpay Checkout is loaded only when a customer actually chooses to pay with it.
let razorpayScript: Promise<void> | null = null
const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve()
  razorpayScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => { razorpayScript = null; script.remove(); reject(new Error('Could not load Razorpay Checkout.')) }
    document.body.appendChild(script)
  })
  return razorpayScript
}
type CustomerOrder = { _id: string; total: number; status: string; paymentMethod?: PaymentMethod; paymentStatus?: 'pending' | 'awaiting_verification' | 'paid' | 'failed'; createdAt: string; updatedAt?: string; deliveredAt?: string; smsTo?: string; deliveryPartner?: { name: string; phone: string; vehicleType?: string; vehicleNumber?: string } | null; items: OrderItem[] }
// Mirrors the user API: delivered items can be returned within this many days, for one of these reasons.
const returnWindowDays = 7
const returnReasons = ['Size too small', 'Size too large', 'Quality not as expected', 'Received a damaged or defective item', 'Received a different item', 'Item does not match the description or photos', 'No longer needed']
type DummyJsonProduct = {
  id: number
  title: string
  description: string
  category: string
  price: number
  discountPercentage: number
  rating: number
  stock: number
  tags?: string[]
  brand?: string
  sku?: string
  weight?: number
  dimensions?: ProductCatalogData['dimensions']
  warrantyInformation?: string
  shippingInformation?: string
  availabilityStatus?: string
  reviews?: ProductReview[]
  returnPolicy?: string
  minimumOrderQuantity?: number
  meta?: ProductCatalogData['meta']
  images?: string[]
  thumbnail?: string
}

const dummyJsonCategories: Record<string, [string, string]> = {
  beauty: ['Beauty', 'Makeup'], fragrances: ['Beauty', 'Fragrance'], furniture: ['Home', 'Furniture'], groceries: ['Grocery', 'Groceries'],
  'home-decoration': ['Home', 'Home Decor'], 'kitchen-accessories': ['Home', 'Kitchen'], laptops: ['Electronics', 'Laptops'],
  'mens-shirts': ['Men', 'Shirts'], 'mens-shoes': ['Men', 'Shoes'], 'mens-watches': ['Men', 'Watches'],
  'mobile-accessories': ['Electronics', 'Mobile Accessories'], motorcycle: ['Automotive', 'Motorcycles'], 'skin-care': ['Beauty', 'Skin Care'],
  smartphones: ['Electronics', 'Smartphones'], 'sports-accessories': ['Sports', 'Sports Accessories'], sunglasses: ['Accessories', 'Sunglasses'],
  tablets: ['Electronics', 'Tablets'], tops: ['Women', 'Tops'], vehicle: ['Automotive', 'Vehicles'], 'womens-bags': ['Women', 'Bags'],
  'womens-dresses': ['Women', 'Dresses'], 'womens-jewellery': ['Women', 'Jewellery'], 'womens-shoes': ['Women', 'Shoes'], 'womens-watches': ['Women', 'Watches'],
}

function mapDummyJsonProduct(source: DummyJsonProduct): Product {
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

const navItems = ['Men', 'Women', 'Kids', 'Home', 'Beauty', 'GenZ', 'Studio']
const navColors: Record<string, string> = { Men: '#ee5f73', Women: '#fb56c1', Kids: '#f26a10', Home: '#f2c210', Beauty: '#0db7af', GenZ: '#ff3f6c', Studio: '#ff3f6c' }
const categoryRoutes: Record<string, string> = { Men: '/men', Women: '/women', Kids: '/kids', Home: '/living', Beauty: '/beauty' }
const heroSlides = [
  { kicker: 'THE NEW SEASON EDIT', title: 'Fresh fits for every plan', image: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1600&q=85', background: '#fbe4e4', accent: '#ff3f6c', route: '/women' },
  { kicker: 'THE MEN\'S EDIT', title: 'Made for the everyday', image: 'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=1600&q=85', background: '#e3eef8', accent: '#3466b5', route: '/men' },
  { kicker: 'THE BEAUTY EDIT', title: 'Your glow, your rules', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1600&q=85', background: '#e2f4f1', accent: '#0d8f88', route: '/beauty' },
]
const tileTones = ['#fde8ec', '#e7f1fd', '#fdf2e1', '#e6f6f0', '#f0eafc', '#fff5d6']
const priceBuckets = [
  { id: 'under-500', label: 'Under ₹500', min: 0, max: 500 },
  { id: '500-999', label: '₹500 to ₹999', min: 500, max: 1000 },
  { id: '1000-2499', label: '₹1,000 to ₹2,499', min: 1000, max: 2500 },
  { id: '2500-4999', label: '₹2,500 to ₹4,999', min: 2500, max: 5000 },
  { id: '5000-9999', label: '₹5,000 to ₹9,999', min: 5000, max: 10000 },
  { id: '10000-plus', label: '₹10,000 and above', min: 10000, max: Infinity },
]
const discountSteps = [10, 20, 30, 40, 50, 60, 70, 80]
const sortOptions = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'popularity', label: 'Popularity' },
  { id: 'discount', label: 'Better Discount' },
  { id: 'price-desc', label: 'Price: High to Low' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'rating', label: 'Customer Rating' },
]
const emptyProfile: CustomerProfile = { name: '', email: '', phone: '', gender: '', dateOfBirth: '', alternateMobile: '', location: '' }
const emptyAddressDraft = { name: '', phone: '', line: '', locality: '', city: '', state: '', pincode: '', type: 'Home' }
const departments = [
  { label: 'Men', image: 'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=700&q=80' },
  { label: 'Women', image: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=700&q=80' },
  { label: 'Kids', image: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=700&q=80' },
  { label: 'Home', image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=700&q=80' },
  { label: 'Beauty', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=700&q=80' },
]
const orderSteps = ['placed', 'packed', 'shipped', 'out_for_delivery', 'delivered']
const paymentSummary = (order: CustomerOrder) => {
  if (order.paymentMethod === 'razorpay') return 'Paid online'
  if (order.paymentMethod === 'phonepe') return 'Paid with PhonePe UPI'
  if (order.paymentMethod === 'upi') return order.paymentStatus === 'paid' ? 'Paid by UPI' : order.paymentStatus === 'failed' ? 'UPI payment could not be verified' : 'UPI payment being verified'
  return order.paymentStatus === 'paid' ? 'Paid on delivery' : 'Cash on delivery'
}
const emptyFilters: Filters = { categories: [], types: [], brands: [], prices: [], discount: 0 }

function formatPrice(value: number) {
  return `₹${value.toLocaleString('en-IN')}`
}

// Mirrors user/backend/src/utils/indianMobile.js — keep the two in sync.
const indianMobileMessage = 'Enter a valid Indian mobile number (10 digits starting with 6, 7, 8 or 9).'
function normalizeIndianMobile(input: string) {
  let digits = input.replace(/[\s\-().]/g, '')
  if (!/^\+?\d+$/.test(digits)) return null
  digits = digits.replace(/^\+/, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  else if (digits.length === 13 && digits.startsWith('091')) digits = digits.slice(3)
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (!/^[6-9]\d{9}$/.test(digits)) return null
  const rest = digits.slice(1)
  if (/^(\d)+$/.test(rest)) return null
  const steps = [...digits].slice(1).map((digit, index) => (Number(digit) - Number(digits[index]) + 10) % 10)
  if (steps.every((step) => step === 1) || steps.every((step) => step === 9)) return null
  if ([2, 3, 4].some((size) => digits.slice(0, size).repeat(Math.ceil(10 / size)).slice(0, 10) === digits)) return null
  if (new Set(digits).size <= 2) return null
  return digits
}

// Only complain once the person has typed a full number, not while they are still typing.
function mobileError(value: string) {
  return value.replace(/\D/g, '').length >= 10 && !normalizeIndianMobile(value) ? indianMobileMessage : ''
}

function formatCount(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(value)
}

function brandOf(product: Product) {
  return product.catalogData?.brand || product.seller?.application?.businessName || ''
}

function priceOf(product: Product) {
  return product.salePrice ?? product.sellingPrice ?? product.cost
}

function mrpOf(product: Product) {
  return product.sellingPrice ?? product.cost
}

function discountOf(product: Product) {
  const price = priceOf(product)
  const mrp = mrpOf(product)
  return Math.round(product.salePercent || (mrp > price && mrp > 0 ? (mrp - price) / mrp * 100 : 0))
}

function countBy(items: Product[], key: (product: Product) => string) {
  const counts = new Map<string, number>()
  items.forEach((item) => { const value = key(item); if (value) counts.set(value, (counts.get(value) || 0) + 1) })
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) as T : fallback
  } catch {
    return fallback
  }
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [sortBy, setSortBy] = useState('recommended')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState('')
  const [heroIndex, setHeroIndex] = useState(0)
  const [pathname, setPathname] = useState(window.location.pathname)
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage('threadline-wishlist', []))
  const [cart, setCart] = useState<CartItem[]>(() => readStorage('threadline-cart', []))
  const [addresses, setAddresses] = useState<Address[]>([])
  const [profile, setProfile] = useState<CustomerProfile>(emptyProfile)
  const [profileDraft, setProfileDraft] = useState<CustomerProfile | null>(null)
  const [orderQuery, setOrderQuery] = useState('')
  const [orderFilter, setOrderFilter] = useState('all')
  const [addressModal, setAddressModal] = useState<{ editingId: string } | null>(null)
  const [returnModal, setReturnModal] = useState<{ orderId: string; item: OrderItem; reason: string; message: string; sending: boolean; error: string } | null>(null)
  const [makeDefaultAddress, setMakeDefaultAddress] = useState(true)
  const [searchFocused, setSearchFocused] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [authUser, setAuthUser] = useState<{ id: string; email: string; profile?: { name?: string } } | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authIdentifier, setAuthIdentifier] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authName, setAuthName] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [selectedSize, setSelectedSize] = useState('')
  const [sizePicker, setSizePicker] = useState<{ product: Product; size: string } | null>(null)
  const [deliveryPincode, setDeliveryPincode] = useState('')
  const [deliveryMessage, setDeliveryMessage] = useState('')
  const [addressDraft, setAddressDraft] = useState(emptyAddressDraft)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod')
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions | null>(null)
  const [upiPayment, setUpiPayment] = useState<UpiPayment | null>(null)
  // Shown for a few seconds after the customer submits their UPI transaction ID, before moving on to their orders.
  // verified: the gateway (PhonePe) confirmed the payment; otherwise it still has to be checked (UPI UTR).
  const [paymentSuccess, setPaymentSuccess] = useState<{ orderId: string; total: number; verified?: boolean } | null>(null)
  const [phonePeReturn, setPhonePeReturn] = useState<PhonePeReturn | null>(null)
  const [placingOrder, setPlacingOrder] = useState(false)

  useEffect(() => {
    let active = true
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/products').catch(() => null)
        if (response?.ok) {
          const result = await response.json() as { products?: Product[] }
          if (Array.isArray(result.products) && result.products.length) {
            if (active) setProducts(result.products)
            return
          }
        }
        const remoteResponse = await fetch('https://dummyjson.com/products?limit=0')
        if (!remoteResponse.ok) throw new Error(`DummyJSON returned HTTP ${remoteResponse.status}`)
        const payload = await remoteResponse.json() as { products?: DummyJsonProduct[] }
        if (!Array.isArray(payload.products)) throw new Error('DummyJSON returned an invalid product list')
        if (active) setProducts(payload.products.map(mapDummyJsonProduct))
      } catch {
        if (active) setProducts([])
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadProducts()
    return () => { active = false }
  }, [])

  useEffect(() => {
    fetch('/api/customer-auth/me', { credentials: 'include' }).then((response) => response.ok ? response.json() as Promise<{ user: typeof authUser }> : Promise.reject()).then(({ user }) => setAuthUser(user)).catch(() => setAuthUser(null)).finally(() => setAuthReady(true))
  }, [])

  // Re-fetched on opening the orders pages so delivery updates and seller replies to returns show up.
  const ordersPage = pathname === '/orders' || pathname === '/account'
  useEffect(() => {
    if (!authUser) return
    void fetch('/api/customer/orders', { credentials: 'include' }).then((response) => response.ok ? response.json() as Promise<{ orders: CustomerOrder[] }> : Promise.reject()).then(({ orders: nextOrders }) => setOrders(nextOrders)).catch(() => undefined)
  }, [authUser, ordersPage])

  useEffect(() => {
    if (!authUser) {
      setProfile(emptyProfile)
      return
    }
    let active = true
    void fetch('/api/customer/profile', { credentials: 'include' })
      .then((response) => response.ok ? response.json() as Promise<{ profile: CustomerProfile }> : Promise.reject())
      .then(({ profile: customerProfile }) => { if (active) setProfile(customerProfile) })
      .catch(() => { if (active) showNotice('Could not load your profile') })
    return () => { active = false }
  }, [authUser])

  useEffect(() => { window.localStorage.setItem('threadline-wishlist', JSON.stringify(wishlist)) }, [wishlist])
  useEffect(() => { window.localStorage.setItem('threadline-cart', JSON.stringify(cart)) }, [cart])
  // Addresses belong to the signed-in customer and are saved on their account. Only the choice of default address is
  // kept in this browser, under a key per customer. (Addresses used to be stored in the browser for everyone who
  // signed in on it, so those old keys are removed.)
  useEffect(() => {
    window.localStorage.removeItem('threadline-addresses')
    window.localStorage.removeItem('threadline-selected-address')
  }, [])
  useEffect(() => {
    setAddresses([])
    setSelectedAddressId('')
    if (!authUser) return
    let active = true
    void fetch('/api/customer/addresses', { credentials: 'include' })
      .then((response) => response.ok ? response.json() as Promise<{ addresses: Address[] }> : Promise.reject())
      .then(({ addresses: saved }) => {
        if (!active) return
        const remembered = readStorage(`threadline-default-address-${authUser.id}`, '')
        setAddresses(saved)
        setSelectedAddressId(saved.some((entry) => entry.id === remembered) ? remembered : saved[0]?.id || '')
      })
      .catch(() => { if (active) showNotice('Could not load your addresses') })
    return () => { active = false }
  }, [authUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (authUser && selectedAddressId) window.localStorage.setItem(`threadline-default-address-${authUser.id}`, JSON.stringify(selectedAddressId))
  }, [authUser, selectedAddressId])

  const cartLoaded = useRef(false)
  const [cartReady, setCartReady] = useState(false)
  useEffect(() => {
    if (!authUser || !products.length || cartLoaded.current) return
    cartLoaded.current = true
    const load = async <T,>(path: string, fallback: T): Promise<T> => {
      const result = await fetch(path, { credentials: 'include' }).catch(() => null)
      return result?.ok ? await result.json() as T : fallback
    }
    void Promise.all([
      load<{ cart: Array<{ productId: string; size?: string; quantity: number }> }>('/api/customer/cart', { cart: [] }),
      load<{ wishlist: string[] }>('/api/customer/wishlist', { wishlist: [] }),
      load<{ reservations: Array<{ product: string; size: string; expiresAt: string }> }>('/api/customer/reservations', { reservations: [] }),
    ]).then(([savedCart, savedWishlist, savedReservations]) => {
      const active = new Map(savedReservations.reservations.map((reservation) => [`${reservation.product}:${reservation.size}`, reservation.expiresAt]))
      setCart(savedCart.cart.flatMap((saved) => {
        const product = products.find((entry) => productId(entry) === saved.productId)
        const reservedUntil = active.get(`${saved.productId}:${saved.size || ''}`)
        return product && reservedUntil ? [{ ...product, quantity: saved.quantity, size: saved.size || '', reservedUntil }] : []
      }))
      setWishlist(savedWishlist.wishlist)
      setCartReady(true)
    })
  }, [authUser, products])
  useEffect(() => {
    if (!authUser || !cartReady) return
    void fetch('/api/customer/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ cart: cart.map((item) => ({ productId: productId(item), size: item.size || '', quantity: item.quantity })) }) })
  }, [cart, cartReady])
  useEffect(() => {
    if (!authUser || !cartReady) return
    void fetch('/api/customer/wishlist', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ wishlist }) })
  }, [wishlist, cartReady])
  useEffect(() => {
    const timer = window.setInterval(() => {
      const alive = cart.filter((item) => !item.reservedUntil || new Date(item.reservedUntil).getTime() > Date.now())
      if (alive.length !== cart.length) { setCart(alive); showNotice('Some bag items were released after their 30-minute reservation ended') }
    }, 15000)
    return () => window.clearInterval(timer)
  }, [cart])

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setHeroIndex((current) => (current + 1) % heroSlides.length), 5000)
    return () => window.clearInterval(timer)
  }, [heroIndex])

  useEffect(() => {
    if (!addressModal) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setAddressModal(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [addressModal])

  useEffect(() => {
    if (!sizePicker) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSizePicker(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [sizePicker])

  useEffect(() => {
    if (!returnModal) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setReturnModal(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [returnModal])

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path)
    setPathname(path)
    setActiveMenu('')
    setMenuOpen(false)
    setFiltersOpen(false)
    setFilters(emptyFilters)
    setSearchFocused(false)
    setProfileDraft(null)
    if (!path.startsWith('/shop')) setSearchTerm('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const productId = (product: Product) => product.id || product._id || product.name
  const categoryPage = Object.entries(categoryRoutes).find(([, path]) => path === pathname)?.[0] || ''
  const catalog = products

  const menuProducts = activeMenu ? catalog.filter((product) => product.category.toLowerCase() === activeMenu.toLowerCase()) : []
  const menuGroups: MenuGroup[] = ([
    { title: 'Shop by category', kind: 'types', items: countBy(menuProducts, (product) => product.subcategory).map(([name]) => ({ value: name, label: name })) },
    { title: 'Top brands', kind: 'brands', items: countBy(menuProducts, brandOf).slice(0, 12).map(([name]) => ({ value: name, label: name })) },
    { title: 'Shop by price', kind: 'prices', items: priceBuckets.filter((bucket) => menuProducts.some((product) => priceOf(product) >= bucket.min && priceOf(product) < bucket.max)).map((bucket) => ({ value: bucket.id, label: bucket.label })) },
  ] as MenuGroup[]).filter((group) => group.items.length)
  const menuDepartment = departments.find((entry) => entry.label === activeMenu)

  const searchMatches = (product: Product) => `${product.name} ${brandOf(product)} ${(product.catalogData?.tags || []).join(' ')} ${product.tagline || ''} ${product.category} ${product.subcategory}`.toLowerCase().includes(searchTerm.toLowerCase())
  const pageProducts = catalog.filter((product) => (!categoryPage || product.category.toLowerCase() === categoryPage.toLowerCase()) && searchMatches(product))
  const inCategories = (product: Product) => !filters.categories.length || filters.categories.includes(product.category)
  const inPriceRange = (product: Product) => !filters.prices.length || filters.prices.some((id) => {
    const bucket = priceBuckets.find((entry) => entry.id === id)
    return Boolean(bucket) && priceOf(product) >= bucket!.min && priceOf(product) < bucket!.max
  })
  const visibleProducts = pageProducts
    .filter((product) => inCategories(product)
      && (!filters.types.length || filters.types.includes(product.subcategory))
      && (!filters.brands.length || filters.brands.includes(brandOf(product)))
      && inPriceRange(product)
      && discountOf(product) >= filters.discount)
    .sort((a, b) => {
      if (sortBy === 'popularity') return Number(b.reviewCount || 0) - Number(a.reviewCount || 0)
      if (sortBy === 'discount') return discountOf(b) - discountOf(a)
      if (sortBy === 'price-desc') return priceOf(b) - priceOf(a)
      if (sortBy === 'price-asc') return priceOf(a) - priceOf(b)
      if (sortBy === 'rating') return Number(b.ratingAverage || 0) - Number(a.ratingAverage || 0)
      return 0
    })
  const categoryFacets = countBy(pageProducts, (product) => product.category)
  const typeFacets = countBy(pageProducts.filter(inCategories), (product) => product.subcategory)
  const brandFacets = countBy(pageProducts, brandOf)
  const priceFacets = priceBuckets.map((bucket) => ({ ...bucket, count: pageProducts.filter((product) => priceOf(product) >= bucket.min && priceOf(product) < bucket.max).length })).filter((bucket) => bucket.count)
  const discountFacets = discountSteps.filter((step) => pageProducts.some((product) => discountOf(product) >= step))
  const appliedFilters = [
    ...(['categories', 'types', 'brands'] as const).flatMap((key) => filters[key].map((value) => ({ key, value, label: value }))),
    ...filters.prices.map((value) => ({ key: 'prices' as const, value, label: priceBuckets.find((bucket) => bucket.id === value)?.label || value })),
  ]
  const toggleFilter = (key: FilterKey, value: string) => setFilters((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((entry) => entry !== value) : [...current[key], value] }))
  const shopWithFilter = (category: string, patch: Partial<Filters>) => {
    const label = Object.keys(categoryRoutes).find((entry) => entry.toLowerCase() === category.toLowerCase())
    const route = label ? categoryRoutes[label] : '/shop'
    if (pathname !== route) navigateTo(route)
    setFilters({ ...emptyFilters, ...(!label && category ? { categories: [category] } : {}), ...patch })
    setActiveMenu('')
    setMenuOpen(false)
    setSearchFocused(false)
  }

  const categoryTiles = countBy(catalog, (product) => `${product.category}::${product.subcategory}`).slice(0, 12).map(([key]) => {
    const [category, subcategory] = key.split('::')
    const items = catalog.filter((product) => product.category === category && product.subcategory === subcategory)
    return { category, subcategory, image: items.find((product) => product.imageUrl)?.imageUrl || '', discount: Math.max(0, ...items.map(discountOf)) }
  })
  const brandTiles = countBy(catalog, brandOf).slice(0, 8).map(([brand]) => {
    const items = catalog.filter((product) => brandOf(product) === brand)
    return { brand, image: items.find((product) => product.imageUrl)?.imageUrl || '', discount: Math.max(0, ...items.map(discountOf)), count: items.length }
  })
  const maxDiscount = Math.max(0, ...catalog.map(discountOf))
  const dealProducts = [...catalog].filter((product) => !product.outOfStock && discountOf(product) > 0).sort((a, b) => discountOf(b) - discountOf(a)).slice(0, 12)
  const trendingProducts = [...catalog].filter((product) => !product.outOfStock && Number(product.ratingAverage) > 0).sort((a, b) => Number(b.ratingAverage || 0) - Number(a.ratingAverage || 0) || Number(b.reviewCount || 0) - Number(a.reviewCount || 0)).slice(0, 12)
  const departmentTiles = departments.map((entry) => ({ ...entry, count: catalog.filter((product) => product.category.toLowerCase() === entry.label.toLowerCase()).length })).filter((entry) => entry.count > 0)
  const query = searchTerm.trim().toLowerCase()
  const suggestions = query ? [
    ...countBy(catalog, (product) => `${product.category}::${product.subcategory}`).filter(([key]) => key.split('::')[1].toLowerCase().includes(query)).slice(0, 4).map(([key, count]) => { const [category, subcategory] = key.split('::'); return { key: `type-${key}`, label: subcategory, hint: `in ${category} · ${count}`, run: () => { setSearchTerm(''); shopWithFilter(category, { types: [subcategory] }) } } }),
    ...countBy(catalog, brandOf).filter(([brand]) => brand.toLowerCase().includes(query)).slice(0, 4).map(([brand, count]) => ({ key: `brand-${brand}`, label: brand, hint: `Brand · ${count}`, run: () => { setSearchTerm(''); shopWithFilter('', { brands: [brand] }) } })),
    ...catalog.filter((product) => product.name.toLowerCase().includes(query)).slice(0, 4).map((product) => ({ key: `product-${productId(product)}`, label: product.name, hint: brandOf(product) || product.subcategory, run: () => navigateTo(`/product/${encodeURIComponent(productId(product))}`) })),
  ].slice(0, 9) : []

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }
  // Delivery OTPs and return codes are only ever sent by SMS; this asks the API to text one again.
  const [resending, setResending] = useState('')
  const resendCode = async (key: string, path: string) => {
    setResending(key)
    try {
      const { result } = await postJson(path)
      showNotice(String((result as { message?: string })?.message || 'Could not send the code. Try again.'))
    } finally {
      setResending('')
    }
  }

  const bagCount = cart.reduce((total, item) => total + item.quantity, 0)
  const cartTotal = cart.reduce((total, item) => total + (item.salePrice ?? item.sellingPrice ?? item.cost) * item.quantity, 0)
  const cartMrp = cart.reduce((total, item) => total + mrpOf(item) * item.quantity, 0)
  const deliveryFee = cartTotal >= 1499 ? 0 : 99
  const gstAmount = Number(((cartTotal + deliveryFee) * 0.18).toFixed(2))
  const finalTotal = Number((cartTotal + deliveryFee + gstAmount).toFixed(2))
  const cartKey = (item: CartItem) => `${productId(item)}::${item.size || ''}`
  const reserveItem = async (id: string, size: string, quantity: number) => {
    if (!size) return quantity > 0 ? '' : null
    const reservationResponse = await fetch('/api/customer/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ productId: id, size, quantity }) })
    const result = await reservationResponse.json().catch(() => ({})) as { message?: string; reservation?: { expiresAt: string } | null }
    if (!reservationResponse.ok) { showNotice(result.message || 'Could not reserve this item'); return undefined }
    return result.reservation?.expiresAt ?? null
  }
  // Resolves to true only when the item actually made it into the bag.
  const addToCart = async (product: Product, requestedSize?: string) => {
    if (!authUser) { navigateTo('/login'); showNotice('Please sign in before buying') ; return false }
    if (product.outOfStock || product.stockTotal === 0) { showNotice('This product is out of stock'); return false }
    const sizeStock = Object.entries(product.stock || {})
    const size = requestedSize || sizeStock.find(([, count]) => Number(count) > 0)?.[0] || ''
    if (sizeStock.length && !(Number(product.stock?.[size]) > 0)) { showNotice('Select an available size'); return false }
    const id = productId(product)
    const existing = cart.find((item) => productId(item) === id && (item.size || '') === size)
    const quantity = (existing?.quantity || 0) + 1
    const reservedUntil = await reserveItem(id, size, quantity)
    if (reservedUntil === undefined) return false
    setCart((current) => {
      const found = current.find((item) => productId(item) === id && (item.size || '') === size)
      if (found) return current.map((item) => item === found ? { ...item, quantity, reservedUntil: reservedUntil || undefined } : item)
      return [...current, { ...product, quantity: 1, size, reservedUntil: reservedUntil || undefined }]
    })
    showNotice(`${product.name}${size ? ` (${size})` : ''} reserved in your bag for 30 minutes`)
    return true
  }
  const updateCartQuantity = async (key: string, change: number) => {
    const item = cart.find((entry) => cartKey(entry) === key)
    if (!item) return
    const quantity = item.quantity + change
    const reservedUntil = await reserveItem(productId(item), item.size || '', Math.max(0, quantity))
    if (reservedUntil === undefined) return
    setCart((current) => current.flatMap((entry) => cartKey(entry) === key ? (quantity > 0 ? [{ ...entry, quantity, reservedUntil: reservedUntil || undefined }] : []) : [entry]))
  }
  const removeFromCart = async (key: string) => {
    const item = cart.find((entry) => cartKey(entry) === key)
    if (item) await reserveItem(productId(item), item.size || '', 0)
    setCart((current) => current.filter((entry) => cartKey(entry) !== key))
  }

  const moveToBag = async (product: Product, size?: string) => {
    if (!await addToCart(product, size)) return
    const id = productId(product)
    setWishlist((current) => current.filter((item) => item !== id))
    setSizePicker(null)
    showNotice(`${product.name}${size && size !== 'One size' ? ` (${size})` : ''} moved to your bag`)
  }
  // Like Myntra, products with a choice of sizes ask for one before leaving the wishlist.
  const startMoveToBag = (product: Product) => {
    const sizes = Object.keys(product.stock || {})
    if (!authUser || product.outOfStock || product.stockTotal === 0 || sizes.length < 2) { void moveToBag(product); return }
    setSizePicker({ product, size: '' })
  }

  const toggleWishlist = (product: Product) => {
    const id = productId(product)
    setWishlist((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    showNotice(wishlist.includes(id) ? 'Removed from your wishlist' : 'Added to your wishlist')
  }

  const savedProducts = catalog.filter((product) => wishlist.includes(productId(product)))
  const selectedProduct = pathname.startsWith('/product/') ? catalog.find((product) => productId(product) === decodeURIComponent(pathname.replace('/product/', ''))) : undefined
  const productImages = selectedProduct ? [...new Set([...(selectedProduct.catalogData?.images || []), selectedProduct.imageUrl].filter(Boolean))] : []
  const selectedStock = selectedProduct ? Object.entries(selectedProduct.stock || { 'One size': selectedProduct.stockTotal || 0 }) : []
  const productPrice = selectedProduct ? selectedProduct.salePrice ?? selectedProduct.sellingPrice ?? selectedProduct.cost : 0
  const originalPrice = selectedProduct ? selectedProduct.sellingPrice ?? selectedProduct.cost : 0
  const discountPercent = selectedProduct?.salePercent || (originalPrice > productPrice && originalPrice > 0 ? Math.round((originalPrice - productPrice) / originalPrice * 100) : 0)
  const selectedSizeStock = Number(selectedStock.find(([size]) => size === selectedSize)?.[1] || 0)
  const similarProducts = selectedProduct ? catalog.filter((product) => product.subcategory === selectedProduct.subcategory && productId(product) !== productId(selectedProduct)).slice(0, 10) : []
  const reviewList: ProductReview[] = selectedProduct ? (Array.isArray(selectedProduct.reviews) && selectedProduct.reviews.length ? selectedProduct.reviews : selectedProduct.catalogData?.reviews || []) : []
  const [reviewDraft, setReviewDraft] = useState({ rating: '5', comment: '' })
  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedProduct) return
    const reviewResponse = await fetch(`/api/customer/products/${productId(selectedProduct)}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ rating: Number(reviewDraft.rating), comment: reviewDraft.comment }) })
    const result = await reviewResponse.json().catch(() => ({})) as { message?: string; ratingAverage?: number; reviewCount?: number; reviews?: ProductReview[] }
    if (!reviewResponse.ok) { showNotice(result.message || 'Could not submit review'); return }
    setProducts((current) => current.map((product) => productId(product) === productId(selectedProduct) ? { ...product, ratingAverage: result.ratingAverage, reviewCount: result.reviewCount, reviews: result.reviews } : product))
    setReviewDraft({ rating: '5', comment: '' })
    showNotice('Thanks for your review')
  }
  useEffect(() => {
    setSelectedSize(selectedStock[0]?.[0] || '')
  }, [selectedProduct?.id, selectedProduct?._id])
  useEffect(() => {
    if (authReady && !authUser && ['/account', '/profile', '/orders', '/address'].includes(pathname)) navigateTo('/login')
  }, [authReady, authUser, pathname])
  const accountPage = ['/login', '/account', '/profile', '/address', '/wishlist', '/cart', '/checkout', '/orders'].includes(pathname)
  const productPath = pathname.startsWith('/product/')
  const listingPage = Boolean(categoryPage) || pathname === '/shop'
  const checkoutFlow = pathname === '/cart' || pathname === '/checkout'

  useEffect(() => {
    if (pathname !== '/checkout' || !authUser || paymentOptions) return
    void fetch('/api/customer/payment-options', { credentials: 'include' }).then((response) => response.ok ? response.json() as Promise<PaymentOptions> : Promise.reject()).then(setPaymentOptions).catch(() => undefined)
  }, [pathname, authUser, paymentOptions])

  const postJson = async (path: string, body?: unknown) => {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body ?? {}) }).catch(() => null)
    return { ok: Boolean(response?.ok), result: await response?.json().catch(() => ({})) ?? {} }
  }

  const orderPlaced = (message: string) => {
    setCart([])
    void fetch('/api/products').then((refreshed) => refreshed.ok ? refreshed.json() as Promise<{ products?: Product[] }> : Promise.reject()).then((result) => { if (Array.isArray(result.products)) setProducts(result.products) }).catch(() => undefined)
    showNotice(message)
    navigateTo('/orders')
  }

  // Releases the stock an unpaid online order was holding. A Razorpay payment that went through anyway completes the order.
  const cancelOnlinePayment = async (orderId: string, message: string) => {
    const { result } = await postJson(`/api/customer/orders/${orderId}/payment/cancel`)
    if (result.order) orderPlaced('Payment received. Order placed successfully')
    else showNotice(message)
  }

  const payWithRazorpay = async (order: CustomerOrder, payment: RazorpayPayment) => {
    try {
      await loadRazorpay()
    } catch {
      setPlacingOrder(false)
      await cancelOnlinePayment(order._id, 'Could not load the payment page. Check your connection and try again.')
      return
    }
    const checkout = new window.Razorpay!({
      key: payment.keyId,
      amount: payment.amount,
      currency: payment.currency,
      order_id: payment.razorpayOrderId,
      name: 'Threadline',
      description: `Order #${order._id.slice(-8).toUpperCase()}`,
      prefill: { name: profile.name || authUser?.profile?.name || '', email: profile.email || authUser?.email || '', contact: profile.phone || '' },
      theme: { color: '#ff3f6c' },
      handler: (success: RazorpaySuccess) => void (async () => {
        const { ok, result } = await postJson(`/api/customer/orders/${order._id}/payment/razorpay`, success)
        setPlacingOrder(false)
        if (ok) orderPlaced('Payment successful. Order placed')
        else showNotice(result.message || 'We could not confirm your payment yet. If you were charged, your order will be confirmed automatically.')
      })(),
      modal: { ondismiss: () => { setPlacingOrder(false); void cancelOnlinePayment(order._id, 'Payment cancelled. Your order was not placed.') } },
    })
    checkout.open()
  }

  const startUpiPayment = async (order: CustomerOrder, payment: UpiPaymentDetails) => {
    const qr = await QRCode.toDataURL(payment.link, { width: 440, margin: 1 }).catch(() => '')
    setUpiPayment({ ...payment, orderId: order._id, total: order.total, qr, transactionId: '', sending: false, error: '' })
  }

  const submitUpiPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!upiPayment || upiPayment.sending) return
    if (!/^\d{12}$/.test(upiPayment.transactionId)) { setUpiPayment({ ...upiPayment, error: 'Enter the 12-digit UPI transaction ID (UTR) from your UPI app.' }); return }
    setUpiPayment({ ...upiPayment, sending: true, error: '' })
    const { ok, result } = await postJson(`/api/customer/orders/${upiPayment.orderId}/payment/upi`, { transactionId: upiPayment.transactionId })
    if (!ok) { setUpiPayment((current) => current && { ...current, sending: false, error: result.message || 'Could not submit your payment. Please try again.' }); return }
    setPaymentSuccess({ orderId: upiPayment.orderId, total: upiPayment.total })
    setUpiPayment(null)
  }

  const finishPaymentSuccess = () => {
    const verified = paymentSuccess?.verified
    setPaymentSuccess(null)
    setPhonePeReturn(null)
    orderPlaced(verified ? 'Payment successful. Order placed' : 'Order placed. We will confirm your UPI payment shortly')
  }

  // Back from PhonePe's payment page: ask the API (which asks PhonePe) every 3 seconds until the payment is settled.
  // Only PhonePe's answer counts; the return to this page alone says nothing about the payment.
  const checkPhonePePayment = async (orderId: string) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const { result } = await postJson(`/api/customer/orders/${orderId}/payment/phonepe/status`)
      if (result.state === 'paid' && result.order) { setPaymentSuccess({ orderId, total: result.order.total, verified: true }); return }
      if (result.state === 'failed') { setPhonePeReturn({ orderId, state: 'failed' }); return }
      setPhonePeReturn({ orderId, state: 'pending' })
      await new Promise((resolve) => window.setTimeout(resolve, 3000))
    }
  }
  useEffect(() => {
    if (pathname !== '/payment/phonepe' || phonePeReturn) return
    const orderId = new URLSearchParams(window.location.search).get('order') || ''
    if (!/^[0-9a-f]{24}$/i.test(orderId)) { setPhonePeReturn({ orderId: '', state: 'failed' }); return }
    setPhonePeReturn({ orderId, state: 'checking' })
    void checkPhonePePayment(orderId)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const renderPhonePeReturn = () => {
    const state = phonePeReturn?.state || 'checking'
    if (state === 'failed') return <section className="phonepe-return page-width">
      <div className="phonepe-return-card is-failed">
        <span className="phonepe-return-icon"><X size={30} /></span>
        <h1>Payment not completed</h1>
        <p>The PhonePe payment failed or was cancelled, so your order was not placed. Any amount debited is refunded by your bank automatically.</p>
        <div className="phonepe-return-actions"><button className="primary-button" type="button" onClick={() => { setPhonePeReturn(null); navigateTo('/checkout') }}>Try again</button><button className="outline-button" type="button" onClick={() => { setPhonePeReturn(null); navigateTo('/cart') }}>Back to bag</button></div>
      </div>
    </section>
    return <section className="phonepe-return page-width">
      <div className="phonepe-return-card">
        <span className="phonepe-return-spinner" aria-hidden="true" />
        <h1>{state === 'pending' ? 'Waiting for PhonePe to confirm…' : 'Confirming your payment…'}</h1>
        <p>{state === 'pending' ? 'If you approved the payment in your UPI app, this usually takes a few seconds. Please keep this page open.' : 'Checking with PhonePe. Please don’t close or refresh this page.'}</p>
        {state === 'pending' && phonePeReturn?.orderId && <button className="outline-button" type="button" onClick={() => void checkPhonePePayment(phonePeReturn.orderId)}>Check again</button>}
      </div>
    </section>
  }
  // Moves on to the orders page by itself once the animation has played.
  useEffect(() => {
    if (!paymentSuccess) return
    const timer = window.setTimeout(finishPaymentSuccess, 4200)
    return () => window.clearTimeout(timer)
  }, [paymentSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  const renderPaymentSuccess = () => {
    if (!paymentSuccess) return null
    return <div className="payment-success" role="alertdialog" aria-modal="true" aria-labelledby="payment-success-title" aria-describedby="payment-success-note">
      <div className="payment-success-card">
        <div className="payment-success-mark" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--angle': `${index * 30}deg`, '--delay': `${0.55 + (index % 3) * 0.05}s` } as CSSProperties} />)}
          <svg viewBox="0 0 120 120">
            <circle className="payment-success-ring" cx="60" cy="60" r="52" />
            <path className="payment-success-tick" d="M38 62 L54 77 L84 45" />
          </svg>
        </div>
        <h2 id="payment-success-title">Payment successful</h2>
        <p className="payment-success-amount">{formatPrice(paymentSuccess.total)}</p>
        <p className="payment-success-order">Order #{paymentSuccess.orderId.slice(-8).toUpperCase()} placed</p>
        <small id="payment-success-note">{paymentSuccess.verified ? 'Your payment is confirmed. We’ll let you know when your order ships.' : 'We’ll confirm your UPI payment with your bank shortly.'}</small>
        <button className="primary-button" type="button" onClick={finishPaymentSuccess} autoFocus>View my orders</button>
      </div>
    </div>
  }

  const closeUpiPayment = () => {
    if (!upiPayment || upiPayment.sending) return
    if (!window.confirm('Close without paying? Your order will not be placed. If you have already paid, enter the transaction ID instead.')) return
    const { orderId } = upiPayment
    setUpiPayment(null)
    void cancelOnlinePayment(orderId, 'UPI payment cancelled. Your order was not placed.')
  }

  const placeOrder = async () => {
    const shippingAddress = addresses.find((address) => address.id === selectedAddressId)
    if (!authUser || !shippingAddress || !cart.length || placingOrder) return
    setPlacingOrder(true)
    const { ok, result } = await postJson('/api/customer/orders', { shippingAddress, paymentMethod, items: cart.map((item) => ({ productId: productId(item), size: item.size, quantity: item.quantity })) })
    if (!ok) { setPlacingOrder(false); showNotice(result.message || 'Could not place order'); return }
    // Razorpay keeps the button busy until its payment window closes.
    if (paymentMethod === 'razorpay') { void payWithRazorpay(result.order, result.payment); return }
    // PhonePe: go to its payment page; it sends the customer back to /payment/phonepe?order=<id>.
    if (paymentMethod === 'phonepe' && result.payment?.redirectUrl) { window.location.assign(result.payment.redirectUrl); return }
    setPlacingOrder(false)
    if (paymentMethod === 'upi') { await startUpiPayment(result.order, result.payment); return }
    orderPlaced('Order placed successfully')
  }

  const renderUpiModal = () => {
    if (!upiPayment) return null
    const { total, upiId, payeeName, link, qr, expiresAt, transactionId, sending, error } = upiPayment
    return <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="upi-modal-title">
      <button className="modal-backdrop" type="button" aria-label="Close" onClick={closeUpiPayment} />
      <form className="modal-card upi-modal" onSubmit={submitUpiPayment}>
        <div className="modal-head"><h2 id="upi-modal-title">Pay with UPI</h2><button type="button" aria-label="Close" onClick={closeUpiPayment}><X size={20} /></button></div>
        <div className="modal-body">
          <div className="upi-pay">
            <p className="upi-amount"><span>Amount to pay</span><strong>{formatPrice(total)}</strong></p>
            {qr && <img className="upi-qr" src={qr} alt={`UPI QR code to pay ${formatPrice(total)} to ${upiId}`} width={220} height={220} />}
            <small>Scan with any UPI app: Google Pay, PhonePe, Paytm or BHIM</small>
            <a className="outline-button upi-app-link" href={link}>Open UPI app</a>
            <p className="upi-id">Or pay to <b>{upiId}</b> ({payeeName})<button type="button" aria-label="Copy UPI ID" onClick={() => void navigator.clipboard?.writeText(upiId).then(() => showNotice('UPI ID copied')).catch(() => undefined)}><Copy size={14} /></button></p>
          </div>
          <label className="field"><span>UPI transaction ID (UTR)</span><input inputMode="numeric" autoComplete="off" maxLength={12} placeholder="12-digit number from your UPI app" value={transactionId} aria-invalid={Boolean(error)} onChange={(event) => setUpiPayment({ ...upiPayment, transactionId: event.target.value.replace(/\D/g, '').slice(0, 12), error: '' })} /></label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <p className="return-note">After paying, open the payment in your UPI app and copy its 12-digit UTR / UPI reference number. Pay by {new Date(expiresAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}, otherwise the items are released. We confirm the order once the payment is verified.</p>
        </div>
        <div className="modal-actions"><button className="outline-button" type="button" disabled={sending} onClick={closeUpiPayment}>Cancel</button><button className="primary-button" type="submit" disabled={sending || transactionId.length !== 12}>{sending ? 'Submitting…' : 'I have paid'}</button></div>
      </form>
    </div>
  }

  const checkDelivery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDeliveryMessage(!/^\d{6}$/.test(deliveryPincode) ? 'Enter a valid 6-digit PIN code.' : /^560\d{3}$/.test(deliveryPincode) ? 'Delivery is available to this Bangalore PIN code.' : 'Delivery is currently unavailable outside Bangalore.')
  }

  // OTP: login with a code instead of a password, and mobile verification at sign-up.
  const [otpConfig, setOtpConfig] = useState({ signupOtp: false, loginOtpPhone: false, loginOtpEmail: false })
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password')
  const [otpSentTo, setOtpSentTo] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)
  useEffect(() => {
    if (pathname !== '/login') return
    void fetch('/api/customer-auth/otp-config').then((response) => response.ok ? response.json() : Promise.reject()).then(setOtpConfig).catch(() => undefined)
  }, [pathname])
  const resetOtp = () => { setOtpSentTo(''); setOtpCode('') }
  const switchAuthMode = (mode: 'login' | 'register') => { setAuthMode(mode); resetOtp() }
  const postAuth = async (path: string, body: unknown) => {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }).catch(() => null)
    return { ok: Boolean(response?.ok), result: await response?.json().catch(() => ({})) ?? {} }
  }
  const loginIdentifier = () => authIdentifier.includes('@') ? authIdentifier.trim() : normalizeIndianMobile(authIdentifier)
  const sendAuthOtp = async () => {
    const usingEmail = authIdentifier.includes('@')
    if (usingEmail && !/^[^\s@]+@gmail\.com$/i.test(authIdentifier.trim())) { showNotice('Enter your Gmail address'); return }
    if (!usingEmail && !normalizeIndianMobile(authIdentifier)) { showNotice(indianMobileMessage); return }
    setOtpBusy(true)
    const { ok, result } = await postAuth('/api/customer-auth/login-otp', { identifier: loginIdentifier() })
    setOtpBusy(false)
    showNotice(result.message || (ok ? 'Code sent' : 'Could not send the code'))
    if (ok) { setOtpSentTo(String(loginIdentifier())); setOtpCode('') }
  }
  // Sign-up verifies the mobile number by SMS when SMS is configured; the Gmail address is not verified.
  const signupPhone = normalizeIndianMobile(authPhone) || ''
  const signupEmail = authEmail.trim().toLowerCase()
  const phoneCodePending = otpConfig.signupOtp && otpSentTo !== signupPhone
  const showPhoneCode = otpConfig.signupOtp && Boolean(otpSentTo) && otpSentTo === signupPhone
  const sendSignupCode = async () => {
    setOtpBusy(true)
    const { ok, result } = await postAuth('/api/customer-auth/signup-otp', { phone: signupPhone })
    setOtpBusy(false)
    showNotice(result.message || (ok ? 'Code sent.' : 'Could not send the code.'))
    if (ok) { setOtpSentTo(signupPhone); setOtpCode('') }
  }
  const finishAuth = (user: { profile?: { name?: string }; email: string; phone?: string }) => {
    setAuthUser(user as typeof authUser)
    setProfile({ ...emptyProfile, name: user.profile?.name || '', email: user.email, phone: user.phone || '' })
    resetOtp()
    navigateTo('/account')
  }

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (authMode === 'login' && loginMethod === 'otp') {
      if (!otpSentTo) { await sendAuthOtp(); return }
      const { ok, result } = await postAuth('/api/customer-auth/login-otp/verify', { identifier: loginIdentifier(), code: otpCode })
      if (!ok) { showNotice(result.message || 'Could not sign in'); return }
      finishAuth(result.user)
      return
    }
    if (authMode === 'login') {
      const usingEmail = authIdentifier.includes('@')
      if (usingEmail && !/^[^\s@]+@gmail\.com$/i.test(authIdentifier.trim())) { showNotice('Enter your Gmail address'); return }
      if (!usingEmail && !normalizeIndianMobile(authIdentifier)) { showNotice(indianMobileMessage); return }
    } else {
      if (!/^[^\s@]+@gmail\.com$/i.test(signupEmail)) { showNotice('Use a Gmail address'); return }
      if (!signupPhone) { showNotice(indianMobileMessage); return }
      if (phoneCodePending) { await sendSignupCode(); return }
    }
    const path = authMode === 'login' ? '/api/customer-auth/login' : '/api/customer-auth/register'
    const body = authMode === 'login' ? { identifier: loginIdentifier(), password: authPassword } : { name: authName, email: signupEmail, phone: signupPhone, password: authPassword, otp: otpCode }
    const { ok, result } = await postAuth(path, body)
    if (!ok) { showNotice(result.message || 'Could not sign in'); return }
    finishAuth(result.user)
  }

  const logoutUser = async () => {
    await fetch('/api/customer-auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined)
    setAuthUser(null)
    setProfile(emptyProfile)
    cartLoaded.current = false
    setCartReady(false)
    setCart([])
    setWishlist([])
    navigateTo('/')
  }

  const renderProductCard = (product: Product) => {
    const id = productId(product)
    const saved = wishlist.includes(id)
    const brand = brandOf(product)
    const price = priceOf(product)
    const mrp = mrpOf(product)
    const discount = discountOf(product)
    const sizes = Object.entries(product.stock || {}).filter(([, count]) => Number(count) > 0).map(([size]) => size)
    const href = `/product/${encodeURIComponent(id)}`
    return <article className="product-card" key={id}>
      <a className="product-card-link" href={href} onClick={(event) => { event.preventDefault(); navigateTo(href) }}>
        <div className="product-image">
          <img src={product.imageUrl} alt={product.name} loading="lazy" />
          {Number(product.ratingAverage) > 0 && <span className="rating-pill">{Number(product.ratingAverage).toFixed(1)} <Star size={11} fill="currentColor" />{Number(product.reviewCount) > 0 && <><i>|</i>{formatCount(Number(product.reviewCount))}</>}</span>}
          {product.outOfStock && <span className="stock-pill">OUT OF STOCK</span>}
        </div>
        <div className="product-info">
          <div className="product-titles"><h3>{brand || product.name}</h3><h4>{brand ? product.name : product.subcategory}</h4></div>
          <div className="product-price"><strong>{formatPrice(price)}</strong>{mrp > price && <><del>{formatPrice(mrp)}</del>{discount > 0 && <span>({discount}% OFF)</span>}</>}</div>
        </div>
      </a>
      <div className="product-hover">
        <div>
          <button type="button" className={`hover-wishlist ${saved ? 'saved' : ''}`} onClick={() => toggleWishlist(product)}><Heart size={15} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Wishlisted' : 'Wishlist'}</button>
          <button type="button" className="hover-bag" aria-label={`Add ${product.name} to bag`} onClick={() => addToCart(product)}><ShoppingBag size={16} /></button>
        </div>
        <p>{sizes.length ? `Sizes: ${sizes.join(', ')}` : 'Currently unavailable'}</p>
      </div>
      <button type="button" className={`card-heart ${saved ? 'saved' : ''}`} aria-label={`${saved ? 'Remove' : 'Add'} ${product.name} ${saved ? 'from' : 'to'} wishlist`} onClick={() => toggleWishlist(product)}><Heart size={16} fill={saved ? 'currentColor' : 'none'} /></button>
    </article>
  }

  const renderEmptyState = (icon: ReactNode, title: string, text: string, actions: ReactNode) => <div className="empty-state">{icon}<h2>{title}</h2><p>{text}</p><div className="empty-actions">{actions}</div></div>

  const renderAccountShell = (content: ReactNode) => <section className="account-page page-width">
    <div className="account-title"><h1>Account</h1><p>{profile.name || authUser?.email || ''}</p></div>
    <div className="account-shell">
      <nav className="account-nav" aria-label="Account">
        <button type="button" className={pathname === '/account' ? 'active' : ''} onClick={() => navigateTo('/account')}>Overview</button>
        <small>Orders</small>
        <button type="button" className={pathname === '/orders' ? 'active' : ''} onClick={() => navigateTo('/orders')}>Orders & Returns</button>
        <small>Account</small>
        <button type="button" className={pathname === '/profile' ? 'active' : ''} onClick={() => navigateTo('/profile')}>Profile</button>
        <button type="button" className={pathname === '/address' ? 'active' : ''} onClick={() => navigateTo('/address')}>Saved Addresses</button>
        <button type="button" onClick={() => navigateTo('/wishlist')}>Wishlist</button>
        <button type="button" onClick={() => navigateTo('/cart')}>Bag</button>
        <small />
        <button type="button" onClick={() => void logoutUser()}>Logout</button>
      </nav>
      <div className="account-content">{content}</div>
    </div>
  </section>

  const renderOverview = () => {
    const tiles = [
      { icon: <PackageCheck size={30} />, title: 'Orders', text: 'Check your order status', path: '/orders', count: orders.length },
      { icon: <Heart size={30} />, title: 'Wishlist', text: 'All the products you have saved', path: '/wishlist', count: wishlist.length },
      { icon: <ShoppingBag size={30} />, title: 'Bag', text: 'Items waiting to be ordered', path: '/cart', count: bagCount },
      { icon: <MapPin size={30} />, title: 'Addresses', text: 'Save addresses for a hassle-free checkout', path: '/address', count: addresses.length },
      { icon: <UserRound size={30} />, title: 'Profile Details', text: 'Change your profile details', path: '/profile', count: 0 },
    ]
    return <>
      <div className="overview-hero">
        <span className="overview-avatar">{(profile.name || authUser?.email || '?').trim().charAt(0).toUpperCase()}</span>
        <div><strong>{profile.name || 'Add your name'}</strong><span>{profile.email || authUser?.email}</span>{profile.phone && <span>+91 {profile.phone}</span>}</div>
        <button className="outline-button small" type="button" onClick={() => { navigateTo('/profile'); setProfileDraft({ ...profile }) }}><Pencil size={13} /> Edit profile</button>
      </div>
      <div className="overview-grid">{tiles.map((tile) => <button type="button" className="overview-tile" key={tile.title} onClick={() => navigateTo(tile.path)}>{tile.icon}<strong>{tile.title}{tile.count > 0 && <b>{tile.count}</b>}</strong><span>{tile.text}</span></button>)}</div>
      <button className="primary-button overview-logout" type="button" onClick={() => void logoutUser()}><LogOut size={16} /> Logout</button>
    </>
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profileDraft) return
    if (profileDraft.phone && !normalizeIndianMobile(profileDraft.phone)) { showNotice(indianMobileMessage); return }
    if (profileDraft.alternateMobile && !normalizeIndianMobile(profileDraft.alternateMobile)) { showNotice(`Alternate mobile: ${indianMobileMessage}`); return }
    const { name, phone, gender, dateOfBirth, alternateMobile, location } = profileDraft
    const response = await fetch('/api/customer/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name, phone, gender, dateOfBirth, alternateMobile, location }) })
    const result = await response.json().catch(() => ({})) as { message?: string; profile?: CustomerProfile }
    if (!response.ok || !result.profile) { showNotice(result.message || 'Could not save your profile'); return }
    setProfile(result.profile)
    setProfileDraft(null)
    showNotice('Profile details saved')
  }

  const renderProfile = () => {
    if (profileDraft) {
      const latestBirthday = new Date(Date.now() - 13 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10)
      return <form className="panel profile-panel" onSubmit={saveProfile}>
        <h2>Edit Details</h2>
        <label className="field field-phone"><span>Mobile number</span><div><b>+91</b><input type="tel" inputMode="numeric" autoComplete="tel-national" value={profileDraft.phone} onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10-digit mobile number" aria-invalid={Boolean(mobileError(profileDraft.phone))} /></div>{mobileError(profileDraft.phone) && <small className="field-error">{mobileError(profileDraft.phone)}</small>}</label>
        <label className="field"><span>Customer ID</span><input value={authUser?.id || ''} readOnly /></label>
        <label className="field"><span>Full name</span><input value={profileDraft.name} onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })} maxLength={80} required /></label>
        <label className="field"><span>Email</span><input type="email" value={profileDraft.email} readOnly /></label>
        <div className="field"><span>Gender</span><div className="gender-picker">{['Male', 'Female', 'Other'].map((gender) => <button type="button" className={profileDraft.gender === gender ? 'selected' : ''} aria-pressed={profileDraft.gender === gender} onClick={() => setProfileDraft({ ...profileDraft, gender: profileDraft.gender === gender ? '' : gender })} key={gender}>{profileDraft.gender === gender && <Check size={14} />}{gender}</button>)}</div></div>
        <label className="field"><span>Birthday</span><input type="date" value={profileDraft.dateOfBirth || ''} max={latestBirthday} min="1906-01-01" onChange={(event) => setProfileDraft({ ...profileDraft, dateOfBirth: event.target.value })} /></label>
        <label className="field"><span>Location</span><input value={profileDraft.location || ''} onChange={(event) => setProfileDraft({ ...profileDraft, location: event.target.value })} maxLength={80} placeholder="e.g. Bengaluru" /></label>
        <label className="field field-phone"><span>Alternate mobile</span><div><b>+91</b><input type="tel" inputMode="numeric" value={profileDraft.alternateMobile || ''} onChange={(event) => setProfileDraft({ ...profileDraft, alternateMobile: event.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="Optional" aria-invalid={Boolean(mobileError(profileDraft.alternateMobile || ''))} /></div>{mobileError(profileDraft.alternateMobile || '') && <small className="field-error">{mobileError(profileDraft.alternateMobile || '')}</small>}</label>
        <div className="form-actions"><button className="outline-button" type="button" onClick={() => setProfileDraft(null)}>Cancel</button><button className="primary-button" type="submit">Save details</button></div>
      </form>
    }
    const rows: Array<[string, string | undefined]> = [
      ['Customer ID', authUser?.id],
      ['Full Name', profile.name],
      ['Mobile Number', profile.phone && `+91 ${profile.phone}`],
      ['Email ID', profile.email],
      ['Gender', profile.gender],
      ['Date of Birth', profile.dateOfBirth && new Date(`${profile.dateOfBirth}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })],
      ['Location', profile.location],
      ['Alternate Mobile', profile.alternateMobile && `+91 ${profile.alternateMobile}`],
    ]
    return <div className="panel profile-panel">
      <h2>Profile Details</h2>
      <dl className="profile-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || <em>- not added -</em>}</dd></div>)}</dl>
      <button className="primary-button" type="button" onClick={() => setProfileDraft({ ...profile })}>Edit</button>
    </div>
  }

  const orderStatusLabels: Record<string, string> = { placed: 'Order placed', packed: 'Packed', shipped: 'Shipped', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' }
  const shortDate = (value: string | Date) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const renderReturnPickup = (order: CustomerOrder, item: OrderItem) => {
    const pickup = item.returnPickup
    if (!pickup) return <p>A pickup will be arranged and your refund processed after the item is collected.</p>
    if (pickup.status === 'returned') return <p><b>Returned to the seller</b>{pickup.returnedAt ? ` on ${shortDate(pickup.returnedAt)}` : ''}. Your refund will be processed shortly.</p>
    if (pickup.status === 'picked_up') return <p><b>Collected</b>{pickup.pickedUpAt ? ` on ${shortDate(pickup.pickedUpAt)}` : ''} and on its way back to the seller. Your refund is processed once it arrives.</p>
    return <div className="return-pickup">
      <p>{pickup.status === 'assigned' && pickup.partner ? <><b>{pickup.partner.name}</b> ({pickup.partner.phone}{pickup.partner.vehicleNumber ? ` · ${pickup.partner.vehicleNumber}` : ''}) will collect this item from your delivery address.</> : 'We are finding a delivery partner to collect this item from your delivery address.'}</p>
      {pickup.codeSent && <p className="return-pickup-code"><span>Return code sent by SMS{order.smsTo ? ` to ${order.smsTo}` : ''}</span><small>Give it to the partner only when you hand over the item.</small><button className="otp-resend" type="button" disabled={resending === item._id} onClick={() => void resendCode(item._id, `/api/customer/orders/${order._id}/items/${item._id}/return-code`)}>{resending === item._id ? 'Sending…' : 'Resend code'}</button></p>}
    </div>
  }
  const renderItemReturn = (order: CustomerOrder, item: OrderItem, deadline: Date) => {
    const request = item.returnRequest
    if (!request) {
      if (Date.now() > deadline.getTime()) return <p className="return-status is-closed">Return window closed on {shortDate(deadline)}</p>
      return <div className="return-status is-open"><span>Return available till {shortDate(deadline)}</span><button type="button" onClick={() => setReturnModal({ orderId: order._id, item, reason: '', message: '', sending: false, error: '' })}><RotateCcw size={14} /> Return</button></div>
    }
    const title = request.status === 'requested' ? 'Return requested · waiting for the seller' : request.status === 'approved' ? 'Return accepted' : 'Return rejected'
    return <div className={`return-status is-${request.status}`}>
      <strong>{title}</strong>
      <p><b>Your reason:</b> {request.reason}. “{request.message}”</p>
      {request.status !== 'requested' && request.sellerMessage && <p><b>Seller’s message:</b> “{request.sellerMessage}”</p>}
      {request.status === 'approved' && renderReturnPickup(order, item)}
      <small>Requested on {shortDate(request.requestedAt)}{request.resolvedAt ? ` · ${request.status === 'approved' ? 'Accepted' : 'Rejected'} on ${shortDate(request.resolvedAt)}` : ''}</small>
    </div>
  }

  const renderOrders = () => {
    const needle = orderQuery.trim().toLowerCase()
    const visibleOrders = orders.filter((order) => (orderFilter === 'all' || (orderFilter === 'active' ? !['delivered', 'cancelled'].includes(order.status) : order.status === orderFilter))
      && (!needle || order._id.toLowerCase().includes(needle) || order.items.some((item) => item.name.toLowerCase().includes(needle))))
    return <>
      <div className="orders-head">
        <div><h2>All orders</h2><p>from anytime</p></div>
        <label className="orders-search"><Search size={16} /><input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="Search in orders" aria-label="Search in orders" /></label>
        <label className="orders-filter"><SlidersHorizontal size={15} /><select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)} aria-label="Filter orders">{[['all', 'All orders'], ['active', 'In progress'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown size={15} /></label>
      </div>
      {!orders.length ? renderEmptyState(<PackageCheck size={46} />, 'No orders yet', 'Your placed orders will appear here.', <button className="primary-button" type="button" onClick={() => navigateTo('/')}>Start shopping</button>)
        : !visibleOrders.length ? <div className="panel muted-panel"><Search size={20} /><p>No orders match your search.</p></div>
        : <div className="orders-list">{visibleOrders.map((order) => {
          const current = orderSteps.indexOf(order.status)
          const cancelled = order.status === 'cancelled'
          const delivered = order.status === 'delivered'
          const finished = cancelled || delivered
          const returnDeadline = new Date(new Date(order.deliveredAt || order.updatedAt || order.createdAt).getTime() + returnWindowDays * 24 * 3600 * 1000)
          return <article className={`order-card ${cancelled ? 'is-cancelled' : delivered ? 'is-delivered' : 'is-active'}`} key={order._id}>
            <div className="order-card-head"><span className="order-status-icon">{cancelled ? <X size={18} /> : delivered ? <Check size={18} /> : <Truck size={18} />}</span><div><strong>{orderStatusLabels[order.status] || order.status}</strong><small>{finished ? 'On' : 'Ordered on'} {new Date(delivered ? order.deliveredAt || order.updatedAt || order.createdAt : finished ? order.updatedAt || order.createdAt : order.createdAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</small></div></div>
            {['shipped', 'out_for_delivery'].includes(order.status) && <div className="order-otp"><ShieldCheck size={20} /><div><strong>Delivery OTP by SMS</strong><small>{order.status === 'out_for_delivery' ? `We have texted your 4-digit delivery OTP${order.smsTo ? ` to ${order.smsTo}` : ''}.` : `We text your delivery OTP${order.smsTo ? ` to ${order.smsTo}` : ''} when your order is out for delivery.`} Tell it to the delivery partner only when you receive your order.</small></div><button className="otp-resend" type="button" disabled={resending === order._id} onClick={() => void resendCode(order._id, `/api/customer/orders/${order._id}/delivery-otp`)}>{resending === order._id ? 'Sending…' : order.status === 'out_for_delivery' ? 'Resend OTP' : 'Send OTP now'}</button></div>}
            {!finished && order.deliveryPartner?.name && <div className="order-partner"><Truck size={18} /><div><strong>{order.deliveryPartner.name} is your delivery partner</strong><small>{[order.deliveryPartner.vehicleType, order.deliveryPartner.vehicleNumber].filter(Boolean).join(' · ')}</small></div><a href={`tel:${order.deliveryPartner.phone}`}>Call</a></div>}
            <div className="order-items">{order.items.map((item, index) => {
              const linked = item.product ? catalog.find((product) => productId(product) === item.product) : undefined
              const href = linked ? `/product/${encodeURIComponent(productId(linked))}` : ''
              const image = item.imageUrl || linked?.imageUrl
              const brand = linked ? brandOf(linked) : ''
              const body = <>{image ? <img src={image} alt="" loading="lazy" /> : <span className="order-item-placeholder"><ShoppingBag size={20} /></span>}<div><strong>{brand || item.name}</strong>{brand && <p>{item.name}</p>}<small>{item.size && item.size !== 'One size' ? `Size: ${item.size} · ` : ''}Qty: {item.quantity} · {formatPrice(item.unitPrice * item.quantity)}</small></div>{href && <ChevronRight size={18} />}</>
              const line = href ? <a className="order-item" href={href} onClick={(event) => { event.preventDefault(); navigateTo(href) }}>{body}</a> : <div className="order-item">{body}</div>
              return <div className="order-line" key={item._id || `${item.name}-${index}`}>{line}{delivered && renderItemReturn(order, item, returnDeadline)}</div>
            })}</div>
            {!cancelled && <div className="order-timeline">{orderSteps.map((status, index) => <span className={index <= current ? 'complete' : ''} key={status}><i />{orderStatusLabels[status]}</span>)}</div>}
            <div className="order-card-foot"><span>Order #{order._id.slice(-8).toUpperCase()} · {paymentSummary(order)}</span><b>Total {formatPrice(order.total)}</b></div>
          </article>
        })}</div>}
    </>
  }

  const openAddressModal = (address?: Address) => {
    setAddressDraft(address ? { name: address.name, phone: address.phone, line: address.line, locality: address.locality || '', city: address.city, state: address.state, pincode: address.pincode, type: address.type } : emptyAddressDraft)
    setMakeDefaultAddress(address ? selectedAddressId === address.id : true)
    setAddressModal({ editingId: address?.id || '' })
  }
  const saveAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!authUser) { showNotice('Sign in to save addresses'); navigateTo('/login'); return }
    if (!/^560\d{3}$/.test(addressDraft.pincode.trim())) { showNotice('Delivery is currently unavailable outside Bangalore'); return }
    const addressPhone = normalizeIndianMobile(addressDraft.phone)
    if (!addressPhone) { showNotice(indianMobileMessage); return }
    const editingId = addressModal?.editingId || ''
    const address: Address = { ...addressDraft, name: addressDraft.name.trim(), line: addressDraft.line.trim(), locality: addressDraft.locality.trim(), city: addressDraft.city.trim(), state: addressDraft.state.trim(), pincode: addressDraft.pincode.trim(), phone: addressPhone, id: editingId || `address-${Date.now()}` }
    const response = await fetch('/api/customer/addresses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(address) }).catch(() => null)
    const result = await response?.json().catch(() => ({})) ?? {}
    if (!response?.ok) { showNotice(result.message || 'Could not save the address'); return }
    setAddresses(result.addresses)
    if (makeDefaultAddress || !selectedAddressId) setSelectedAddressId(address.id)
    setAddressModal(null)
    setAddressDraft(emptyAddressDraft)
    showNotice(editingId ? 'Address updated' : 'Address saved')
  }
  const removeAddress = async (id: string) => {
    const response = await fetch(`/api/customer/addresses/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' }).catch(() => null)
    const result = await response?.json().catch(() => ({})) ?? {}
    if (!response?.ok) { showNotice(result.message || 'Could not remove the address'); return }
    const remaining: Address[] = result.addresses
    setAddresses(remaining)
    if (selectedAddressId === id) setSelectedAddressId(remaining[0]?.id || '')
    showNotice('Address removed')
  }
  const renderAddressCard = (address: Address, isDefault: boolean) => <article className="address-card" key={address.id}>
    <div className="address-card-body">
      <div className="address-card-top"><strong>{address.name}</strong><span className="address-type">{address.type}</span></div>
      <p>{address.line}{address.locality ? `, ${address.locality}` : ''}<br />{address.city} - {address.pincode}<br />{address.state}</p>
      <p>Mobile: <b>{address.phone}</b></p>
      {!isDefault && <button type="button" className="make-default" onClick={() => setSelectedAddressId(address.id)}>Make this default</button>}
    </div>
    <div className="address-card-actions"><button type="button" onClick={() => openAddressModal(address)}>Edit</button><button type="button" onClick={() => removeAddress(address.id)}>Remove</button></div>
  </article>
  const renderAddresses = () => {
    const defaultAddress = addresses.find((entry) => entry.id === selectedAddressId)
    const others = addresses.filter((entry) => entry.id !== selectedAddressId)
    return <>
      <div className="address-page-head"><h2>Saved Addresses</h2><button className="outline-button small" type="button" onClick={() => openAddressModal()}><Plus size={14} /> Add new address</button></div>
      {addresses.length ? <>
        {defaultAddress && <><h3 className="address-group">Default address</h3>{renderAddressCard(defaultAddress, true)}</>}
        {others.length > 0 && <><h3 className="address-group">Other addresses</h3><div className="address-list">{others.map((entry) => renderAddressCard(entry, false))}</div></>}
      </> : renderEmptyState(<MapPin size={46} />, 'Save your addresses now', 'Add your home and office addresses for a faster checkout. We currently deliver within Bangalore.', <button className="outline-button" type="button" onClick={() => openAddressModal()}>Add new address</button>)}
    </>
  }
  const submitReturn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!returnModal || returnModal.sending) return
    const { orderId, item, reason, message } = returnModal
    if (!reason) { setReturnModal({ ...returnModal, error: 'Choose a reason for the return.' }); return }
    if (message.trim().length < 10) { setReturnModal({ ...returnModal, error: 'Tell the seller a little more (at least 10 characters).' }); return }
    setReturnModal({ ...returnModal, sending: true, error: '' })
    const returnResponse = await fetch(`/api/customer/orders/${orderId}/items/${item._id}/return`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ reason, message: message.trim() }) }).catch(() => null)
    const result = await returnResponse?.json().catch(() => ({})) as { message?: string; order?: CustomerOrder } | undefined
    if (!returnResponse?.ok || !result?.order) { setReturnModal((current) => current && { ...current, sending: false, error: result?.message || 'Could not send your return request. Please try again.' }); return }
    const updatedOrder = result.order
    setOrders((current) => current.map((order) => order._id === orderId ? updatedOrder : order))
    setReturnModal(null)
    showNotice('Return requested. The seller will review it shortly.')
  }

  const renderReturnModal = () => {
    if (!returnModal) return null
    const { item, reason, message, sending, error } = returnModal
    return <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="return-modal-title">
      <button className="modal-backdrop" type="button" aria-label="Close" onClick={() => setReturnModal(null)} />
      <form className="modal-card return-modal" onSubmit={submitReturn}>
        <div className="modal-head"><h2 id="return-modal-title">Return item</h2><button type="button" aria-label="Close" onClick={() => setReturnModal(null)}><X size={20} /></button></div>
        <div className="modal-body">
          <div className="return-modal-item">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="order-item-placeholder"><ShoppingBag size={20} /></span>}<div><strong>{item.name}</strong><small>{item.size && item.size !== 'One size' ? `Size: ${item.size} · ` : ''}Qty: {item.quantity}</small></div></div>
          <h3>Reason for return</h3>
          <div className="return-reasons" role="radiogroup" aria-label="Reason for return">{returnReasons.map((option) => <label className={reason === option ? 'selected' : ''} key={option}><input type="radio" name="return-reason" value={option} checked={reason === option} onChange={() => setReturnModal({ ...returnModal, reason: option, error: '' })} />{option}</label>)}</div>
          <label className="field return-message"><span>Message to the seller</span><textarea value={message} onChange={(event) => setReturnModal({ ...returnModal, message: event.target.value.slice(0, 500), error: '' })} placeholder="Describe the problem, e.g. the stitching on the left sleeve is torn." rows={4} required /><small>{message.trim().length}/500 · at least 10 characters</small></label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <p className="return-note">The seller will review your request. If it is accepted, a pickup will be arranged and your refund processed after the item is collected.</p>
        </div>
        <div className="modal-actions"><button className="outline-button" type="button" onClick={() => setReturnModal(null)}>Cancel</button><button className="primary-button" type="submit" disabled={sending}>{sending ? 'Sending…' : 'Request return'}</button></div>
      </form>
    </div>
  }

  const renderSizePicker = () => {
    if (!sizePicker) return null
    const { product, size } = sizePicker
    const price = priceOf(product)
    const mrp = mrpOf(product)
    const sizeStock = Number(product.stock?.[size] || 0)
    return <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="size-picker-title">
      <button className="modal-backdrop" type="button" aria-label="Close" onClick={() => setSizePicker(null)} />
      <div className="modal-card size-picker">
        <div className="size-picker-product">
          <img src={product.imageUrl} alt="" />
          <div><h3>{product.name}</h3><p><strong>{formatPrice(price)}</strong>{mrp > price && <><del>{formatPrice(mrp)}</del><span>({discountOf(product)}% OFF)</span></>}</p></div>
          <button type="button" aria-label="Close" onClick={() => setSizePicker(null)}><X size={20} /></button>
        </div>
        <div className="size-picker-body">
          <h2 id="size-picker-title">Select size</h2>
          <div className="product-size-options">{Object.entries(product.stock || {}).map(([option, count]) => <button type="button" className={size === option ? 'selected' : ''} disabled={Number(count) < 1} aria-pressed={size === option} onClick={() => setSizePicker({ product, size: option })} key={option}>{option === 'One size' ? 'Onesize' : option}</button>)}</div>
          {sizeStock > 0 && sizeStock < 5 && <p className="product-stock-note">Only {sizeStock} left!</p>}
        </div>
        <div className="size-picker-actions"><button className="primary-button" type="button" disabled={!size} onClick={() => void moveToBag(product, size)}>Done</button></div>
      </div>
    </div>
  }

  const renderAddressModal = () => addressModal && <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="address-modal-title">
    <button className="modal-backdrop" type="button" aria-label="Close" onClick={() => setAddressModal(null)} />
    <form className="modal-card" onSubmit={saveAddress}>
      <div className="modal-head"><h2 id="address-modal-title">{addressModal.editingId ? 'Edit address' : 'Add new address'}</h2><button type="button" aria-label="Close" onClick={() => setAddressModal(null)}><X size={20} /></button></div>
      <div className="modal-body">
        <h3>Contact details</h3>
        <label className="field"><span>Name*</span><input value={addressDraft.name} onChange={(event) => setAddressDraft({ ...addressDraft, name: event.target.value })} autoComplete="name" required autoFocus /></label>
        <label className="field field-phone"><span>Mobile no*</span><div><b>+91</b><input type="tel" inputMode="numeric" autoComplete="tel-national" value={addressDraft.phone} onChange={(event) => setAddressDraft({ ...addressDraft, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} required aria-invalid={Boolean(mobileError(addressDraft.phone))} /></div>{mobileError(addressDraft.phone) && <small className="field-error">{mobileError(addressDraft.phone)}</small>}</label>
        <h3>Address</h3>
        <label className="field"><span>Pin code*</span><input inputMode="numeric" autoComplete="postal-code" value={addressDraft.pincode} onChange={(event) => { const pincode = event.target.value.replace(/\D/g, '').slice(0, 6); setAddressDraft((draft) => ({ ...draft, pincode, ...(/^560\d{3}$/.test(pincode) ? { city: draft.city || 'Bengaluru', state: draft.state || 'Karnataka' } : {}) })) }} required aria-invalid={addressDraft.pincode.length === 6 && !/^560\d{3}$/.test(addressDraft.pincode)} />{addressDraft.pincode.length === 6 && !/^560\d{3}$/.test(addressDraft.pincode) && <small className="field-error">We currently deliver only within Bangalore (PIN codes starting with 560).</small>}</label>
        <label className="field"><span>Address (house no, building, street, area)*</span><input value={addressDraft.line} onChange={(event) => setAddressDraft({ ...addressDraft, line: event.target.value })} autoComplete="street-address" required /></label>
        <label className="field"><span>Locality / town</span><input value={addressDraft.locality} onChange={(event) => setAddressDraft({ ...addressDraft, locality: event.target.value })} /></label>
        <div className="field-row"><label className="field"><span>City / district*</span><input value={addressDraft.city} onChange={(event) => setAddressDraft({ ...addressDraft, city: event.target.value })} required /></label><label className="field"><span>State*</span><input value={addressDraft.state} onChange={(event) => setAddressDraft({ ...addressDraft, state: event.target.value })} required /></label></div>
        <h3>Save address as</h3>
        <div className="address-type-picker">{['Home', 'Work'].map((type) => <button type="button" className={addressDraft.type === type ? 'selected' : ''} aria-pressed={addressDraft.type === type} onClick={() => setAddressDraft({ ...addressDraft, type })} key={type}>{type}</button>)}</div>
        <label className="checkbox-field"><input type="checkbox" checked={makeDefaultAddress} onChange={(event) => setMakeDefaultAddress(event.target.checked)} /> Make this my default address</label>
      </div>
      <div className="modal-actions"><button className="outline-button" type="button" onClick={() => setAddressModal(null)}>Cancel</button><button className="primary-button" type="submit">Save</button></div>
    </form>
  </div>

  const renderPriceDetails = (action: ReactNode) => <aside className="price-panel">
    <h3>Price details ({bagCount} item{bagCount === 1 ? '' : 's'})</h3>
    <div><span>Total MRP</span><span>{formatPrice(cartMrp)}</span></div>
    {cartMrp > cartTotal && <div><span>Discount on MRP</span><span className="positive">−{formatPrice(Number((cartMrp - cartTotal).toFixed(2)))}</span></div>}
    <div><span>Delivery fee</span>{deliveryFee ? <span>{formatPrice(deliveryFee)}</span> : <span className="positive">FREE</span>}</div>
    <div><span>GST (18%)</span><span>{formatPrice(gstAmount)}</span></div>
    <div className="price-total"><span>Total Amount</span><span>{formatPrice(finalTotal)}</span></div>
    {action}
  </aside>

  const renderAccountPage = () => {
    if (pathname === '/checkout' && !authUser) return <section className="bag-page page-width">{renderEmptyState(<UserRound size={46} />, 'Sign in to checkout', 'You need a customer account before placing an order.', <button className="primary-button" type="button" onClick={() => navigateTo('/login')}>Login / Signup</button>)}</section>
    if (pathname === '/login') return <section className="auth-page">
      <div className="auth-card">
        <div className="auth-banner"><span>Free delivery</span><strong>on orders above ₹1,499</strong><small>7 day easy returns · Cash on delivery</small></div>
        <div className="auth-body">
          <h1>{authMode === 'login' ? <><b>Login</b> to your account</> : <><b>Signup</b> for a new account</>}</h1>
          {authMode === 'login' && (otpConfig.loginOtpPhone || otpConfig.loginOtpEmail) && <div className="auth-method" role="tablist"><button role="tab" aria-selected={loginMethod === 'password'} className={loginMethod === 'password' ? 'active' : ''} type="button" onClick={() => { setLoginMethod('password'); setOtpSentTo('') }}>Password</button><button role="tab" aria-selected={loginMethod === 'otp'} className={loginMethod === 'otp' ? 'active' : ''} type="button" onClick={() => setLoginMethod('otp')}>One-time code</button></div>}
          <form className="auth-form" onSubmit={submitAuth}>
            {authMode === 'register' && <label className="field"><span>Full name</span><input value={authName} onChange={(event) => setAuthName(event.target.value)} required /></label>}
            {authMode === 'login' ? <label className="field"><span>Gmail address or mobile number</span><input value={authIdentifier} onChange={(event) => { setAuthIdentifier(event.target.value); if (otpSentTo) setOtpSentTo('') }} placeholder="you@gmail.com or 98XXXXXXXX" autoComplete="username" required aria-invalid={Boolean(!authIdentifier.includes('@') && mobileError(authIdentifier))} />{!authIdentifier.includes('@') && mobileError(authIdentifier) && <small className="field-error">{mobileError(authIdentifier)}</small>}</label> : <label className="field"><span>Gmail address</span><input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@gmail.com" required /></label>}
            {authMode === 'register' && <label className="field field-phone"><span>Mobile number</span><div><b>+91</b><input type="tel" inputMode="numeric" autoComplete="tel-national" value={authPhone} onChange={(event) => setAuthPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" required aria-invalid={Boolean(mobileError(authPhone))} /></div>{mobileError(authPhone) && <small className="field-error">{mobileError(authPhone)}</small>}</label>}
            {!(authMode === 'login' && loginMethod === 'otp') && <label className="field"><span>Password</span><input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={8} required /></label>}
            {otpSentTo && (authMode === 'login' ? loginMethod === 'otp' : showPhoneCode) && <label className="field otp-field"><span>{authMode === 'login' ? 'Login code' : 'Mobile verification code'}</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus /><small>Sent to {otpSentTo}. <button type="button" disabled={otpBusy} onClick={() => void (authMode === 'login' ? sendAuthOtp() : sendSignupCode())}>Resend code</button></small></label>}
            <button className="primary-button" type="submit" disabled={otpBusy}>{otpBusy ? 'Sending code…'
              : authMode === 'login' ? (loginMethod === 'otp' ? (otpSentTo ? 'Verify & login' : 'Send login code') : 'Continue')
              : phoneCodePending ? 'Verify mobile number' : 'Create account'}</button>
          </form>
          <p className="auth-switch">{authMode === 'login' ? 'New here?' : 'Already have an account?'} <button type="button" onClick={() => switchAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Create an account' : 'Login'}</button></p>
        </div>
      </div>
    </section>
    if (pathname === '/account') return renderAccountShell(renderOverview())
    if (pathname === '/orders') return renderAccountShell(renderOrders())
    if (pathname === '/profile') return renderAccountShell(renderProfile())
    if (pathname === '/address') return renderAccountShell(renderAddresses())
    if (pathname === '/wishlist') return <section className="wishlist-page page-width">
      <h1 className="page-title">My Wishlist <span>{savedProducts.length} item{savedProducts.length === 1 ? '' : 's'}</span></h1>
      {savedProducts.length ? <div className="wishlist-grid">{savedProducts.map((product) => {
        const price = priceOf(product)
        const mrp = mrpOf(product)
        const href = `/product/${encodeURIComponent(productId(product))}`
        return <article className="wishlist-card" key={productId(product)}>
          <a href={href} onClick={(event) => { event.preventDefault(); navigateTo(href) }}><img src={product.imageUrl} alt={product.name} loading="lazy" /><div><h3>{product.name}</h3><p><strong>{formatPrice(price)}</strong>{mrp > price && <><del>{formatPrice(mrp)}</del><span>({discountOf(product)}% OFF)</span></>}</p></div></a>
          <button className="wishlist-remove" type="button" aria-label={`Remove ${product.name} from wishlist`} onClick={() => toggleWishlist(product)}><X size={14} /></button>
          <button className="wishlist-move" type="button" onClick={() => startMoveToBag(product)}>Move to bag</button>
        </article>
      })}</div> : renderEmptyState(<Heart size={46} />, 'Your wishlist is empty', 'Add items that you like to your wishlist. Review them anytime and easily move them to the bag.', <button className="outline-button" type="button" onClick={() => navigateTo('/')}>Continue shopping</button>)}
    </section>
    if (pathname === '/cart') return <section className="bag-page page-width">
      {cart.length ? <div className="bag-layout">
        <div className="bag-items">
          {addresses.find((address) => address.id === selectedAddressId) ? (() => { const address = addresses.find((entry) => entry.id === selectedAddressId)!; return <div className="bag-strip"><span>Deliver to: <b>{address.name}, {address.pincode}</b><small>{address.line}, {address.city}</small></span><button type="button" onClick={() => navigateTo('/address')}>Change address</button></div> })() : <div className="bag-strip"><span>Check delivery time & services</span><button type="button" onClick={() => navigateTo('/address')}>Enter PIN code</button></div>}
          <div className="bag-offer"><Tag size={16} /><span>{cartTotal >= 1499 ? 'Yay! You get FREE delivery on this order.' : `Add items worth ${formatPrice(Number((1499 - cartTotal).toFixed(2)))} more for FREE delivery.`}</span></div>
          <h2 className="bag-count">{bagCount} item{bagCount === 1 ? '' : 's'} in your bag</h2>
          {cart.map((item) => {
            const price = item.salePrice ?? item.sellingPrice ?? item.cost
            const mrp = mrpOf(item)
            return <article className="bag-item" key={cartKey(item)}>
              <img src={item.imageUrl} alt={item.name} />
              <div className="bag-item-copy">
                <h3>{brandOf(item) || item.name}</h3>
                <p>{brandOf(item) ? item.name : `${item.category} / ${item.subcategory}`}</p>
                {item.seller?.application?.businessName && <small>Sold by: {item.seller.application.businessName}</small>}
                <div className="bag-item-controls">
                  {item.size && <span className="bag-chip">Size: {item.size}</span>}
                  <div className="quantity-control"><button type="button" aria-label="Decrease quantity" onClick={() => updateCartQuantity(cartKey(item), -1)}><Minus size={13} /></button><span>Qty: {item.quantity}</span><button type="button" aria-label="Increase quantity" onClick={() => updateCartQuantity(cartKey(item), 1)}><Plus size={13} /></button></div>
                </div>
                <p className="bag-price"><strong>{formatPrice(price)}</strong>{mrp > price && <><del>{formatPrice(mrp)}</del><span>{discountOf(item)}% OFF</span></>}</p>
                <p className="bag-note"><RotateCcw size={13} /> 7 day easy returns{item.reservedUntil && <> · Reserved until {new Date(item.reservedUntil).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</>}</p>
              </div>
              <button className="bag-remove" type="button" onClick={() => removeFromCart(cartKey(item))} aria-label={`Remove ${item.name}`}><X size={18} /></button>
            </article>
          })}
          <button className="bag-wishlist-link" type="button" onClick={() => navigateTo('/wishlist')}><Heart size={16} /> Add more from wishlist <ChevronRight size={16} /></button>
        </div>
        {renderPriceDetails(<button className="primary-button" type="button" onClick={() => navigateTo('/checkout')}>Place order</button>)}
      </div> : renderEmptyState(<ShoppingBag size={46} />, 'Hey, it feels so light!', 'There is nothing in your bag. Let\'s add some items.', <><button className="outline-button" type="button" onClick={() => navigateTo('/wishlist')}>Add items from wishlist</button><button className="text-button" type="button" onClick={() => navigateTo('/')}>Continue shopping</button></>)}
    </section>
    return <section className="bag-page page-width">
      <div className="bag-layout">
        <div className="bag-items">
          <div className="checkout-heading"><h2>Select delivery address</h2><button className="outline-button small" type="button" onClick={() => openAddressModal()}>Add new address</button></div>
          {addresses.length ? addresses.map((address) => <button className={`checkout-address ${selectedAddressId === address.id ? 'selected' : ''}`} type="button" key={address.id} onClick={() => setSelectedAddressId(address.id)}>
            <span className="radio" />
            <span className="checkout-address-copy"><span className="address-card-top"><strong>{address.name}</strong><span className="address-type">{address.type}</span></span><small>{address.line}, {address.city}, {address.state} - {address.pincode}</small><small>Mobile: <b>{address.phone}</b></small></span>
          </button>) : <button className="add-address-tile" type="button" onClick={() => openAddressModal()}><Plus size={16} /> Add new address</button>}
          <div className="checkout-heading"><h2>Choose payment mode</h2></div>
          <div className="payment-options" role="radiogroup" aria-label="Payment mode">{([
            { id: 'phonepe', icon: <Smartphone size={20} />, title: 'UPI with PhonePe', text: 'PhonePe, Google Pay, Paytm or any UPI app, secured by PhonePe', available: paymentOptions?.phonepe },
            { id: 'razorpay', icon: <CreditCard size={20} />, title: 'Pay online', text: 'Cards, UPI, netbanking and wallets, secured by Razorpay', available: paymentOptions?.razorpay },
            { id: 'upi', icon: <QrCode size={20} />, title: 'UPI (scan & pay)', text: `Pay to ${paymentOptions?.upiId || 'our UPI ID'} with any UPI app`, available: paymentOptions?.upi },
            { id: 'cod', icon: <Banknote size={20} />, title: 'Cash on delivery (Cash/UPI)', text: 'Pay when your order arrives', available: true },
          ] as const).filter((choice) => choice.available).map((choice) => <button className={`payment-option ${paymentMethod === choice.id ? 'selected' : ''}`} type="button" role="radio" aria-checked={paymentMethod === choice.id} key={choice.id} onClick={() => setPaymentMethod(choice.id)}><span className={`radio ${paymentMethod === choice.id ? 'checked' : ''}`} />{choice.icon}<div><strong>{choice.title}</strong><small>{choice.text}</small></div></button>)}</div>
          <button className="back-link" type="button" onClick={() => navigateTo('/cart')}><ArrowLeft size={15} /> Back to bag</button>
        </div>
        <div>
          {renderPriceDetails(<button className="primary-button" type="button" disabled={!cart.length || !selectedAddressId || placingOrder} onClick={() => void placeOrder()}>{placingOrder ? 'Please wait…' : paymentMethod === 'cod' ? 'Place order' : 'Proceed to pay'}</button>)}
          <div className="checkout-lines">{cart.map((item) => <div key={cartKey(item)}><span>{item.name}{item.size ? ` (${item.size})` : ''} × {item.quantity}</span><b>{formatPrice((item.salePrice ?? item.sellingPrice ?? item.cost) * item.quantity)}</b></div>)}</div>
        </div>
      </div>
    </section>
  }

  const renderFilterOptions = (key: FilterKey, entries: Array<[string, number]>, labelFor?: (value: string) => string) => <div className="filter-scroll">{entries.map(([value, count]) => <label className="filter-option" key={value}><input type="checkbox" checked={filters[key].includes(value)} onChange={() => toggleFilter(key, value)} /><span>{labelFor ? labelFor(value) : value}</span><small>({count})</small></label>)}</div>

  const renderListing = () => <section className="listing page-width" id="discover">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><button type="button" onClick={() => navigateTo('/')}>Home</button><span>/</span><b>{categoryPage || (searchTerm ? 'Search' : 'Shop')}</b></nav>
    <div className="listing-title"><h1>{categoryPage ? `${categoryPage} Collection` : searchTerm ? `Results for "${searchTerm}"` : 'All Products'}</h1>{!loading && <span>- {visibleProducts.length} item{visibleProducts.length === 1 ? '' : 's'}</span>}</div>
    <div className="listing-layout">
      {filtersOpen && <button className="filter-backdrop" type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />}
      <aside className={`filter-panel ${filtersOpen ? 'is-open' : ''}`} aria-label="Filters">
        <div className="filter-panel-head"><strong>Filters</strong>{(appliedFilters.length > 0 || filters.discount > 0) && <button type="button" onClick={() => setFilters(emptyFilters)}>Clear all</button>}<button className="filter-close" type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={18} /></button></div>
        {!categoryPage && categoryFacets.length > 1 && <section className="filter-section"><h3>Categories</h3>{renderFilterOptions('categories', categoryFacets)}</section>}
        {typeFacets.length > 0 && <section className="filter-section"><h3>{categoryPage ? 'Categories' : 'Type'}</h3>{renderFilterOptions('types', typeFacets)}</section>}
        {brandFacets.length > 0 && <section className="filter-section"><h3>Brand</h3>{renderFilterOptions('brands', brandFacets)}</section>}
        {priceFacets.length > 0 && <section className="filter-section"><h3>Price</h3>{renderFilterOptions('prices', priceFacets.map((bucket) => [bucket.id, bucket.count]), (id) => priceBuckets.find((bucket) => bucket.id === id)?.label || id)}</section>}
        {discountFacets.length > 0 && <section className="filter-section"><h3>Discount range</h3>{discountFacets.map((step) => <label className="filter-option" key={step}><input type="radio" name="discount" checked={filters.discount === step} onChange={() => setFilters({ ...filters, discount: step })} /><span>{step}% and above</span></label>)}</section>}
        <button className="primary-button filter-apply" type="button" onClick={() => setFiltersOpen(false)}>Show {visibleProducts.length} products</button>
      </aside>
      <div className="listing-main">
        <div className="listing-toolbar">
          <div className="applied-filters">{appliedFilters.map((filter) => <button type="button" key={`${filter.key}-${filter.value}`} onClick={() => toggleFilter(filter.key, filter.value)}>{filter.label} <X size={12} /></button>)}{filters.discount > 0 && <button type="button" onClick={() => setFilters({ ...filters, discount: 0 })}>{filters.discount}% and above <X size={12} /></button>}</div>
          <label className="sort-select"><span>Sort by :</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>{sortOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
        </div>
        {loading && <div className="product-grid">{Array.from({ length: 10 }, (_, index) => <div className="product-skeleton" key={index}><span /><i /><i /></div>)}</div>}
        {!loading && visibleProducts.length === 0 && renderEmptyState(<Search size={42} />, 'We couldn\'t find any matches', 'Try a different search, or clear some filters.', <button className="outline-button" type="button" onClick={() => { setFilters(emptyFilters); setSearchTerm('') }}>Clear search & filters</button>)}
        {!loading && visibleProducts.length > 0 && <div className="product-grid">{visibleProducts.map(renderProductCard)}</div>}
      </div>
    </div>
    <div className="mobile-listing-bar">
      <label><ArrowUpDown size={16} /> Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort products">{sortOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
      <button type="button" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16} /> Filter{appliedFilters.length + (filters.discount ? 1 : 0) > 0 && <b>{appliedFilters.length + (filters.discount ? 1 : 0)}</b>}</button>
    </div>
  </section>

  const highlightMatch = (text: string) => {
    const index = text.toLowerCase().indexOf(query)
    return index < 0 ? text : <>{text.slice(0, index)}<b>{text.slice(index, index + query.length)}</b>{text.slice(index + query.length)}</>
  }
  const renderProductRow = (title: string, items: Product[], onViewAll: () => void) => items.length > 0 && <section className="home-section page-width">
    <div className="section-head"><h2>{title}</h2><button className="view-all" type="button" onClick={onViewAll}>View all <ChevronRight size={16} /></button></div>
    <div className="product-row">{items.map(renderProductCard)}</div>
  </section>
  const slide = heroSlides[heroIndex]

  return (
    <div className={`storefront ${checkoutFlow ? 'in-checkout' : ''}`}>
      {checkoutFlow ? <header className="site-header checkout-header">
        <button className="brand" type="button" onClick={() => navigateTo('/')} aria-label="Threadline home"><span className="brand-mark">t</span></button>
        <ol className="checkout-steps">
          <li className={pathname === '/cart' ? 'current' : 'done'}>Bag</li>
          <li className={pathname === '/checkout' ? 'current' : ''}>Address</li>
          <li className={pathname === '/checkout' ? 'current' : ''}>Payment</li>
        </ol>
        <span className="secure-badge"><ShieldCheck size={20} /> 100% Secure</span>
      </header> : <header className="site-header">
        <button className="mobile-menu" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
        <button className="brand" type="button" onClick={() => navigateTo('/')} aria-label="Threadline home"><span className="brand-mark">t</span><span className="brand-word">threadline</span></button>
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <div className="mobile-nav-head"><span>Shop by category</span><button className="mobile-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={20} /></button></div>
          {navItems.map((item) => <button key={item} type="button" style={{ '--nav-color': navColors[item] } as CSSProperties} className={activeMenu === item || categoryPage === item ? 'nav-active' : ''} onMouseEnter={() => setActiveMenu(item)} onClick={() => { if (categoryRoutes[item]) navigateTo(categoryRoutes[item]); else { setMenuOpen(false); showNotice(`${item} is coming soon`) } }}>{item}{item === 'Studio' && <sup>New</sup>}</button>)}
        </nav>
        {menuOpen && <button className="menu-backdrop" type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
        <div className={`mega-menu ${activeMenu && menuGroups.length ? 'is-visible' : ''}`} style={{ '--nav-color': navColors[activeMenu] || '#ff3f6c' } as CSSProperties} onMouseLeave={() => setActiveMenu('')}>
          <div className="mega-menu-inner">
            {menuGroups.map((group) => <section className="mega-group" key={group.title}><h3>{group.title}</h3>{group.items.map((item) => <button type="button" key={item.value} onClick={() => shopWithFilter(activeMenu, { [group.kind]: [item.value] })}>{item.label}</button>)}</section>)}
            {menuDepartment && <section className="mega-feature"><button type="button" onClick={() => shopWithFilter(activeMenu, {})}><img src={menuDepartment.image} alt="" /><span>Shop all {activeMenu}</span><small>{menuProducts.length} styles <ChevronRight size={13} /></small></button></section>}
          </div>
        </div>
        <form className="search-field" role="search" onSubmit={(event) => { event.preventDefault(); navigateTo('/shop') }}>
          <Search size={17} />
          <input value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setSearchFocused(true) }} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} onKeyDown={(event) => { if (event.key === 'Escape') { setSearchFocused(false); event.currentTarget.blur() } }} placeholder="Search for products, brands and more" aria-label="Search products" aria-autocomplete="list" aria-expanded={searchFocused && suggestions.length > 0} aria-controls="search-suggestions" />
          {searchTerm && <button type="button" aria-label="Clear search" onMouseDown={(event) => event.preventDefault()} onClick={() => setSearchTerm('')}><X size={15} /></button>}
          {searchFocused && suggestions.length > 0 && <ul className="search-suggestions" id="search-suggestions" role="listbox">{suggestions.map((suggestion) => <li key={suggestion.key} role="option" aria-selected="false"><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={suggestion.run}><span>{highlightMatch(suggestion.label)}</span><small>{suggestion.hint}</small></button></li>)}<li className="search-all"><button type="submit" onMouseDown={(event) => event.preventDefault()}><Search size={14} /> See all results for "{searchTerm.trim()}"</button></li></ul>}
        </form>
        <div className="header-actions" onMouseEnter={() => setActiveMenu('')}>
          <div className="profile-menu">
            <button type="button" className="header-icon" onClick={() => navigateTo(authUser ? '/account' : '/login')}><UserRound size={20} /><span>Profile</span></button>
            <div className="profile-dropdown">
              {authUser ? <div className="profile-dropdown-head"><strong>Hello {profile.name || authUser.profile?.name || 'there'}</strong><span>{profile.phone || authUser.email}</span></div> : <div className="profile-dropdown-head"><strong>Welcome</strong><span>To access account and manage orders</span><button className="outline-button small" type="button" onClick={() => navigateTo('/login')}>Login / Signup</button></div>}
              {authUser && <button type="button" onClick={() => navigateTo('/account')}>Overview</button>}
              <button type="button" onClick={() => navigateTo('/orders')}>Orders</button>
              <button type="button" onClick={() => navigateTo('/wishlist')}>Wishlist</button>
              <button type="button" onClick={() => navigateTo('/cart')}>Bag</button>
              <button type="button" onClick={() => navigateTo('/address')}>Saved Addresses</button>
              {authUser && <><button type="button" onClick={() => navigateTo('/profile')}>Edit Profile</button><button type="button" onClick={() => void logoutUser()}>Logout</button></>}
            </div>
          </div>
          <button type="button" className="header-icon" onClick={() => navigateTo('/wishlist')}><Heart size={20} /><span>Wishlist</span>{wishlist.length > 0 && <b>{wishlist.length}</b>}</button>
          <button type="button" className="header-icon" onClick={() => navigateTo('/cart')}><ShoppingBag size={20} /><span>Bag</span>{bagCount > 0 && <b>{bagCount}</b>}</button>
        </div>
      </header>}

      {accountPage && renderAccountPage()}
      {pathname === '/payment/phonepe' && renderPhonePeReturn()}

      {selectedProduct && !accountPage && <section className="product-detail-page page-width">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <button type="button" onClick={() => navigateTo('/')}>Home</button><span>/</span>
          <button type="button" onClick={() => shopWithFilter(selectedProduct.category, {})}>{selectedProduct.category}</button><span>/</span>
          <button type="button" onClick={() => shopWithFilter(selectedProduct.category, { types: [selectedProduct.subcategory] })}>{selectedProduct.subcategory}</button><span>/</span>
          <b>{brandOf(selectedProduct) || selectedProduct.name}</b>
        </nav>
        <div className="product-detail-layout">
          <div className="product-media">
            <div className={`product-gallery ${productImages.length > 1 ? '' : 'single'}`}>
              {(productImages.length ? productImages : [selectedProduct.imageUrl]).slice(0, 6).map((image, index) => <div className="product-gallery-image" key={image}><img src={image} alt={index === 0 ? selectedProduct.name : `${selectedProduct.name}, view ${index + 1}`} loading={index > 1 ? 'lazy' : undefined} /></div>)}
            </div>
            {selectedProduct.catalogData?.photoCredit?.photographer && <p className="photo-credit">Photo by <a href={selectedProduct.catalogData.photoCredit.photographerUrl} target="_blank" rel="noreferrer">{selectedProduct.catalogData.photoCredit.photographer}</a> on <a href={selectedProduct.catalogData.photoCredit.photoUrl} target="_blank" rel="noreferrer">{selectedProduct.catalogData.photoCredit.source || 'Unsplash'}</a></p>}
          </div>
          <section className="product-purchase-panel" aria-label="Product purchase details">
            <span className="product-brand-name">{brandOf(selectedProduct) || 'Threadline'}</span>
            <h1>{selectedProduct.name}</h1>
            {Number(selectedProduct.ratingAverage) > 0 && <div className="product-rating"><span>{Number(selectedProduct.ratingAverage).toFixed(1)} <Star size={14} fill="currentColor" /></span><b>{Number(selectedProduct.reviewCount || 0).toLocaleString('en-IN')} Ratings</b></div>}
            <div className="product-price-block">
              <div className="product-price-line"><strong>{formatPrice(productPrice)}</strong>{originalPrice > productPrice && <><span className="mrp">MRP <del>{formatPrice(originalPrice)}</del></span>{discountPercent > 0 && <span className="off">({Math.round(discountPercent)}% OFF)</span>}</>}</div>
              <p className="product-tax-note">inclusive of all taxes</p>
            </div>

            <section className="product-size-section">
              <div className="product-subsection-heading"><h2>Select size</h2><button type="button" onClick={() => showNotice('Size guidance is not available for this product yet')}>Size chart <ChevronRight size={14} /></button></div>
              <div className="product-size-options">{selectedStock.map(([size, stock]) => <button type="button" className={selectedSize === size ? 'selected' : ''} disabled={stock < 1} onClick={() => setSelectedSize(size)} key={size}>{size === 'One size' ? 'Onesize' : size}</button>)}</div>
              {selectedSizeStock > 0 && selectedSizeStock < 5 && <p className="product-stock-note">Only {selectedSizeStock} left!</p>}
            </section>

            <div className="product-purchase-actions">
              <button className="product-add-button" type="button" disabled={selectedSizeStock < 1} onClick={() => addToCart(selectedProduct, selectedSize)}><ShoppingBag size={19} /> {selectedSizeStock < 1 ? 'Out of stock' : 'Add to bag'}</button>
              <button className={`product-wishlist-button ${wishlist.includes(productId(selectedProduct)) ? 'saved' : ''}`} type="button" onClick={() => toggleWishlist(selectedProduct)}><Heart size={19} fill={wishlist.includes(productId(selectedProduct)) ? 'currentColor' : 'none'} /> {wishlist.includes(productId(selectedProduct)) ? 'Wishlisted' : 'Wishlist'}</button>
            </div>

            <section className="product-delivery-section">
              <h2>Delivery options <Truck size={20} /></h2>
              <form className="product-pincode-form" onSubmit={checkDelivery}><label className="sr-only" htmlFor="product-pincode">Enter PIN code</label><input id="product-pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="Enter pincode" value={deliveryPincode} onChange={(event) => setDeliveryPincode(event.target.value.replace(/\D/g, '').slice(0, 6))} /><button type="submit">Check</button></form>
              <p>{deliveryMessage || 'Please enter PIN code to check delivery time & Pay on Delivery availability'}</p>
              <ul className="product-service-notes">
                <li><Truck size={16} /> {selectedProduct.catalogData?.shippingInformation || 'Free delivery on orders above ₹1,499'}</li>
                <li><CreditCard size={16} /> Pay on delivery is available</li>
                <li><RotateCcw size={16} /> {selectedProduct.catalogData?.returnPolicy || 'Easy 7 day returns and exchanges'}</li>
              </ul>
            </section>

            <section className="product-offer-note"><h2>Best offers <Tag size={18} /></h2><p><b>Free delivery</b> on orders above ₹1,499. Final delivery charges are shown at checkout.</p></section>

            <div className="product-information">
              <details open><summary>Product details</summary><p>{selectedProduct.description || selectedProduct.tagline || `${selectedProduct.category} ${selectedProduct.subcategory}.`}</p><p className="product-code">Brand: {brandOf(selectedProduct) || 'Not listed'} · SKU: {selectedProduct.catalogData?.sku || productId(selectedProduct)}</p>{Boolean(selectedProduct.catalogData?.tags?.length) && <div className="product-tag-list">{selectedProduct.catalogData?.tags?.map((tag) => <span key={tag}>{tag}</span>)}</div>}</details>
              <details open={Boolean(selectedProduct.catalogData?.specifications)}><summary>Specifications</summary><dl className="product-spec-list">{Object.entries(selectedProduct.catalogData?.specifications || {}).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}<div><dt>Category</dt><dd>{selectedProduct.category} / {selectedProduct.subcategory}</dd></div><div><dt>Availability</dt><dd>{selectedProduct.catalogData?.availabilityStatus || (selectedSizeStock ? 'In stock' : 'Out of stock')}</dd></div>{selectedProduct.catalogData?.weight !== undefined && <div><dt>Weight</dt><dd>{selectedProduct.catalogData.weight} g</dd></div>}{selectedProduct.catalogData?.dimensions && <div><dt>Dimensions</dt><dd>{['width', 'height', 'depth'].map((dimension) => selectedProduct.catalogData?.dimensions?.[dimension as keyof NonNullable<ProductCatalogData['dimensions']>]).filter((value) => value !== undefined).join(' × ')}</dd></div>}{selectedProduct.catalogData?.minimumOrderQuantity !== undefined && <div><dt>Minimum order</dt><dd>{selectedProduct.catalogData.minimumOrderQuantity}</dd></div>}{selectedProduct.catalogData?.meta?.barcode && <div><dt>Barcode</dt><dd>{selectedProduct.catalogData.meta.barcode}</dd></div>}{selectedProduct.catalogData?.meta?.createdAt && <div><dt>Listed</dt><dd>{new Date(selectedProduct.catalogData.meta.createdAt).toLocaleDateString('en-IN')}</dd></div>}{selectedProduct.catalogData?.warrantyInformation && <div><dt>Warranty</dt><dd>{selectedProduct.catalogData.warrantyInformation}</dd></div>}</dl>{selectedProduct.catalogData?.meta?.qrCode && <a className="product-qr-link" href={selectedProduct.catalogData.meta.qrCode} target="_blank" rel="noreferrer">View product QR code <ChevronRight size={13} /></a>}</details>
              <details open><summary>Ratings & reviews ({reviewList.length})</summary>{reviewList.length ? <div className="product-reviews">{reviewList.map((review, index) => <article key={`${review.createdAt || review.date}-${index}`}><span className={review.rating < 3 ? 'low' : ''}>{review.rating} <Star size={10} fill="currentColor" /></span><div><p>{review.comment}</p><small>{review.customerName || review.reviewerName}{(review.createdAt || review.date) ? ` | ${new Date(review.createdAt || review.date || '').toLocaleDateString('en-IN')}` : ''}</small></div></article>)}</div> : <p>No reviews yet. Be the first to review this product.</p>}{authUser ? <form className="product-review-form" onSubmit={submitReview}><label>Your rating <select value={reviewDraft.rating} onChange={(event) => setReviewDraft({ ...reviewDraft, rating: event.target.value })}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label><textarea value={reviewDraft.comment} onChange={(event) => setReviewDraft({ ...reviewDraft, comment: event.target.value })} placeholder="Write your review" minLength={3} required /><button className="outline-button small" type="submit">Submit review</button></form> : <p>Sign in to write a review.</p>}</details>
              <details><summary>Delivery, returns & seller</summary><p>{selectedProduct.catalogData?.shippingInformation || 'Delivery timing is confirmed at checkout.'}</p><p>Returns: {selectedProduct.catalogData?.returnPolicy || 'Check return eligibility at checkout.'}</p><p>Seller: {selectedProduct.seller?.application?.businessName || 'Threadline marketplace seller'}</p></details>
            </div>
          </section>
        </div>
        {similarProducts.length > 0 && <section className="similar-products"><h2>Similar products</h2><div className="product-grid">{similarProducts.map(renderProductCard)}</div></section>}
      </section>}
      {productPath && !selectedProduct && !accountPage && <section className="product-detail-page page-width">{loading ? <div className="product-detail-layout pdp-loading"><div className="product-gallery"><span /><span /></div><div><i /><i /><i /></div></div> : renderEmptyState(<Search size={42} />, 'Product not found', 'This product may have been removed or is no longer available.', <button className="primary-button" type="button" onClick={() => navigateTo('/shop')}>Browse all products</button>)}</section>}

      <main id="top" className={accountPage || productPath || pathname === '/payment/phonepe' ? 'content-hidden' : ''}>
        {!listingPage && <>
          <section className="hero-carousel" aria-label="Featured collections">
            <div className="hero-slide" style={{ '--slide-bg': slide.background, '--slide-accent': slide.accent } as CSSProperties} key={heroIndex}>
              <div className="hero-copy">
                <span>{slide.kicker}</span>
                <h2>{slide.title}</h2>
                {maxDiscount > 0 && <strong>Up to {maxDiscount}% off</strong>}
                <button type="button" onClick={() => navigateTo(slide.route)}>Shop now</button>
              </div>
              <div className="hero-image" style={{ backgroundImage: `url(${slide.image})` }} />
            </div>
            <button className="hero-arrow prev" type="button" aria-label="Previous slide" onClick={() => setHeroIndex((heroIndex - 1 + heroSlides.length) % heroSlides.length)}><ChevronLeft size={22} /></button>
            <button className="hero-arrow next" type="button" aria-label="Next slide" onClick={() => setHeroIndex((heroIndex + 1) % heroSlides.length)}><ChevronRight size={22} /></button>
            <div className="hero-dots">{heroSlides.map((entry, index) => <button type="button" className={index === heroIndex ? 'active' : ''} aria-label={`Show slide ${index + 1}`} onClick={() => setHeroIndex(index)} key={entry.kicker} />)}</div>
          </section>

          <div className="offer-strip page-width"><span><Truck size={18} /> <b>Free delivery</b> on orders above ₹1,499</span><span><RotateCcw size={18} /> <b>7 day</b> easy returns</span><span><CreditCard size={18} /> <b>Cash on delivery</b> available</span></div>

          {renderProductRow('Deals of the day', dealProducts, () => { navigateTo('/shop'); setSortBy('discount') })}

          {brandTiles.length > 1 && <section className="home-section page-width"><h2>Top brands to bag</h2><div className="brand-grid">{brandTiles.map((tile) => <button className="brand-tile" type="button" key={tile.brand} onClick={() => shopWithFilter('', { brands: [tile.brand] })}><span className="brand-image">{tile.image && <img src={tile.image} alt="" loading="lazy" />}</span><span className="brand-copy"><b>{tile.brand}</b><strong>{tile.discount > 0 ? `Up to ${tile.discount}% off` : `${tile.count} styles`}</strong><small>Shop now</small></span></button>)}</div></section>}

          {categoryTiles.length > 0 && <section className="home-section page-width"><h2>Shop by category</h2><div className="deal-grid">{categoryTiles.map((tile, index) => <button className="deal-tile" type="button" style={{ '--tile-bg': tileTones[index % tileTones.length] } as CSSProperties} key={`${tile.category}-${tile.subcategory}`} onClick={() => shopWithFilter(tile.category, { types: [tile.subcategory] })}><span className="deal-image">{tile.image && <img src={tile.image} alt="" loading="lazy" />}</span><span className="deal-copy"><span>{tile.subcategory}</span><strong>{tile.discount > 0 ? `Up to ${tile.discount}% off` : 'Explore'}</strong><small>Shop now</small></span></button>)}</div></section>}

          {departmentTiles.length > 0 && <section className="home-section page-width"><h2>Shop by department</h2><div className="department-grid">{departmentTiles.map((entry) => <button className="department-tile" type="button" key={entry.label} onClick={() => navigateTo(categoryRoutes[entry.label])}><img src={entry.image} alt="" loading="lazy" /><span><b>{entry.label}</b><small>{entry.count} styles · Shop now</small></span></button>)}</div></section>}

          {renderProductRow('Trending now', trendingProducts, () => { navigateTo('/shop'); setSortBy('rating') })}

          {loading && <div className="page-width home-loading"><div className="product-grid">{Array.from({ length: 5 }, (_, index) => <div className="product-skeleton" key={index}><span /><i /><i /></div>)}</div></div>}
          {!loading && catalog.length > 0 && <div className="page-width home-cta"><button className="outline-button" type="button" onClick={() => navigateTo('/shop')}>View all {catalog.length} products</button></div>}
        </>}

        {listingPage && renderListing()}
      </main>

      {checkoutFlow ? <footer className="checkout-footer page-width"><span><ShieldCheck size={16} /> Secure checkout</span><span>© 2026 Threadline</span></footer> : <footer className="site-footer">
        <div className="page-width footer-grid">
          <div><h4>Online shopping</h4><button type="button" onClick={() => navigateTo('/shop')}>All products</button>{Object.entries(categoryRoutes).map(([label, route]) => <button type="button" key={label} onClick={() => navigateTo(route)}>{label}</button>)}</div>
          <div><h4>Your account</h4><button type="button" onClick={() => navigateTo('/account')}>Account</button><button type="button" onClick={() => navigateTo('/orders')}>Track orders</button><button type="button" onClick={() => navigateTo('/wishlist')}>Wishlist</button><button type="button" onClick={() => navigateTo('/cart')}>Bag</button><button type="button" onClick={() => navigateTo('/address')}>Saved addresses</button></div>
          <div><h4>Good to know</h4><p>Free delivery on orders above ₹1,499</p><p>Cash on delivery available</p><p>We currently deliver within Bangalore</p></div>
          <div className="footer-promises"><div><ShieldCheck size={36} /><p><b>Secure checkout</b> for every order</p></div><div><RotateCcw size={36} /><p><b>Return within 7 days</b> of receiving your order</p></div></div>
        </div>
        {categoryTiles.length > 0 && <div className="page-width footer-popular"><h4>Popular searches</h4><p>{categoryTiles.map((tile, index) => <span key={`${tile.category}-${tile.subcategory}`}>{index > 0 && <i>|</i>}<button type="button" onClick={() => { navigateTo('/shop'); setSearchTerm(tile.subcategory) }}>{tile.subcategory}</button></span>)}</p></div>}
        <div className="page-width footer-bottom"><span>© 2026 Threadline. All rights reserved.</span><span>Independent style, thoughtfully gathered.</span></div>
      </footer>}
      {renderAddressModal()}
      {renderSizePicker()}
      {renderReturnModal()}
      {renderUpiModal()}
      {renderPaymentSuccess()}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}

export default App
