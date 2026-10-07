import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronDown, CreditCard, Eye, Heart, MapPin, Menu, Minus, PackageCheck, Plus, RotateCcw, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Star, Tag, Trash2, Truck, UserRound, X } from 'lucide-react'
import './App.css'
import './marketplace-overrides.css'

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

type Category = { label: string; image: string; tone: string }
type MenuGroup = { title: string; items: string[] }
type CartItem = Product & { quantity: number; size?: string; reservedUntil?: string }
type Address = { id: string; name: string; phone: string; line: string; city: string; state: string; pincode: string; type: string }
type CustomerProfile = { name: string; email: string; phone: string }
type CustomerOrder = { _id: string; total: number; status: string; createdAt: string; items: Array<{ name: string; size?: string; quantity: number; unitPrice: number }> }
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
const categoryRoutes: Record<string, string> = { Men: '/men', Women: '/women', Kids: '/kids', Home: '/living', Beauty: '/beauty' }
const categoryPageCopy: Record<string, { eyebrow: string; title: string; description: string; image: string }> = {
  Men: { eyebrow: 'THE MEN\'S EDIT', title: 'Made for the everyday.', description: 'Easy layers, considered essentials, and pieces that keep up.', image: 'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=1400&q=88' },
  Women: { eyebrow: 'THE WOMEN\'S EDIT', title: 'Dress like yourself.', description: 'Fresh silhouettes and forever favourites for every version of you.', image: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=1400&q=88' },
  Kids: { eyebrow: 'THE LITTLE EDIT', title: 'Big style, little people.', description: 'Play-ready pieces made for all their best adventures.', image: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=1400&q=88' },
  Beauty: { eyebrow: 'THE BEAUTY EDIT', title: 'Your glow, your rules.', description: 'Small rituals and essentials that make a difference.', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1400&q=88' },
  Home: { eyebrow: 'THE HOME EDIT', title: 'Make space for good things.', description: 'Objects with a little more feeling for the places you call yours.', image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1400&q=88' },
}

const categories: Category[] = [
  { label: 'New in', image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=500&q=85', tone: 'rose' },
  { label: 'Women', image: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=500&q=85', tone: 'sand' },
  { label: 'Men', image: 'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=500&q=85', tone: 'blue' },
  { label: 'Accessories', image: 'https://images.unsplash.com/photo-1523779917675-b6ed3a42a561?auto=format&fit=crop&w=500&q=85', tone: 'gold' },
  { label: 'Beauty', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=500&q=85', tone: 'lilac' },
]

function formatPrice(value: number) {
  return `₹${value.toLocaleString('en-IN')}`
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
  const [activeCategory, setActiveCategory] = useState('All')
  const [activeSubcategory, setActiveSubcategory] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState('')
  const [pathname, setPathname] = useState(window.location.pathname)
  const [wishlist, setWishlist] = useState<string[]>(() => readStorage('threadline-wishlist', []))
  const [cart, setCart] = useState<CartItem[]>(() => readStorage('threadline-cart', []))
  const [addresses, setAddresses] = useState<Address[]>(() => readStorage('threadline-addresses', []))
  const [profile, setProfile] = useState<CustomerProfile>({ name: '', email: '', phone: '' })
  const [selectedAddressId, setSelectedAddressId] = useState(() => readStorage('threadline-selected-address', ''))
  const [authUser, setAuthUser] = useState<{ id: string; email: string; profile?: { name?: string } } | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPhone, setAuthPhone] = useState('')
  const [authName, setAuthName] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedImageUrl, setSelectedImageUrl] = useState('')
  const [deliveryPincode, setDeliveryPincode] = useState('')
  const [deliveryMessage, setDeliveryMessage] = useState('')
  const [addressDraft, setAddressDraft] = useState({ name: '', phone: '', line: '', city: '', state: '', pincode: '', type: 'Home' })
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    if (!authUser) return
    void fetch('/api/customer/orders', { credentials: 'include' }).then((response) => response.ok ? response.json() as Promise<{ orders: CustomerOrder[] }> : Promise.reject()).then(({ orders: nextOrders }) => setOrders(nextOrders)).catch(() => undefined)
  }, [authUser])

  useEffect(() => {
    if (!authUser) {
      setProfile({ name: '', email: '', phone: '' })
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
  useEffect(() => { window.localStorage.setItem('threadline-addresses', JSON.stringify(addresses)) }, [addresses])
  useEffect(() => { window.localStorage.setItem('threadline-selected-address', JSON.stringify(selectedAddressId)) }, [selectedAddressId])

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

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path)
    setPathname(path)
    setActiveMenu('')
    setActiveSubcategory('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const categoryPage = Object.entries(categoryRoutes).find(([, path]) => path === pathname)?.[0] || ''
  const pageCopy = categoryPageCopy[categoryPage]

  const catalog = products
  const menuGroups: MenuGroup[] = activeMenu && ['Men', 'Women', 'Home', 'Beauty'].includes(activeMenu)
    ? [{ title: 'Shop by category', items: [...new Set(catalog.filter((product) => product.category === activeMenu).map((product) => product.subcategory))].sort() }].filter((group) => group.items.length)
    : []
  const visibleProducts = catalog.filter((product) => {
    const selectedCategory = categoryPage || activeCategory
    const matchesCategory = selectedCategory === 'All' || product.category.toLowerCase() === selectedCategory.toLowerCase()
    const matchesSubcategory = !activeSubcategory || product.subcategory.toLowerCase() === activeSubcategory.toLowerCase()
    const haystack = `${product.name} ${product.catalogData?.brand || ''} ${(product.catalogData?.tags || []).join(' ')} ${product.tagline || ''} ${product.category} ${product.subcategory}`.toLowerCase()
    return matchesCategory && matchesSubcategory && haystack.includes(searchTerm.toLowerCase())
  })

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  const productId = (product: Product) => product.id || product._id || product.name
  const bagCount = cart.reduce((total, item) => total + item.quantity, 0)
  const cartTotal = cart.reduce((total, item) => total + (item.salePrice ?? item.sellingPrice ?? item.cost) * item.quantity, 0)
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
  const addToCart = async (product: Product, requestedSize?: string) => {
    if (!authUser) { navigateTo('/login'); showNotice('Please sign in before buying') ; return }
    if (product.outOfStock || product.stockTotal === 0) { showNotice('This product is out of stock'); return }
    const sizeStock = Object.entries(product.stock || {})
    const size = requestedSize || sizeStock.find(([, count]) => Number(count) > 0)?.[0] || ''
    if (sizeStock.length && !(Number(product.stock?.[size]) > 0)) { showNotice('Select an available size'); return }
    const id = productId(product)
    const existing = cart.find((item) => productId(item) === id && (item.size || '') === size)
    const quantity = (existing?.quantity || 0) + 1
    const reservedUntil = await reserveItem(id, size, quantity)
    if (reservedUntil === undefined) return
    setCart((current) => {
      const found = current.find((item) => productId(item) === id && (item.size || '') === size)
      if (found) return current.map((item) => item === found ? { ...item, quantity, reservedUntil: reservedUntil || undefined } : item)
      return [...current, { ...product, quantity: 1, size, reservedUntil: reservedUntil || undefined }]
    })
    showNotice(`${product.name}${size ? ` (${size})` : ''} reserved in your bag for 30 minutes`)
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
    setSelectedImageUrl(productImages[0] || '')
  }, [selectedProduct?.id, selectedProduct?._id])
  useEffect(() => {
    if (authReady && !authUser && ['/profile', '/orders', '/address'].includes(pathname)) navigateTo('/login')
  }, [authReady, authUser, pathname])
  const accountPage = ['/login', '/profile', '/address', '/wishlist', '/cart', '/checkout', '/orders'].includes(pathname)

  const placeOrder = async () => {
    const shippingAddress = addresses.find((address) => address.id === selectedAddressId)
    if (!authUser || !shippingAddress || !cart.length) return
    const response = await fetch('/api/customer/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ shippingAddress, items: cart.map((item) => ({ productId: productId(item), size: item.size, quantity: item.quantity })) }) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { showNotice(result.message || 'Could not place order'); return }
    setCart([])
    void fetch('/api/products').then((refreshed) => refreshed.ok ? refreshed.json() as Promise<{ products?: Product[] }> : Promise.reject()).then((result) => { if (Array.isArray(result.products)) setProducts(result.products) }).catch(() => undefined)
    showNotice('Order placed successfully')
    navigateTo('/')
  }

  const checkDelivery = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setDeliveryMessage(!/^\d{6}$/.test(deliveryPincode) ? 'Enter a valid 6-digit PIN code.' : /^560\d{3}$/.test(deliveryPincode) ? 'Delivery is available to this Bangalore PIN code.' : 'Delivery is currently unavailable outside Bangalore.')
  }

  useEffect(() => {
    const interceptPlaceOrder = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest('button')
      if (!button || !button.textContent?.includes('Place order')) return
      event.preventDefault()
      event.stopPropagation()
      void placeOrder()
    }
    document.addEventListener('click', interceptPlaceOrder, true)
    return () => document.removeEventListener('click', interceptPlaceOrder, true)
  }, [authUser, addresses, selectedAddressId, cart])

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validEmail = /^[^\s@]+@gmail\.com$/i.test(authEmail)
    const validPhone = authMode === 'login' || /^[6-9]\d{9}$/.test(authPhone)
    if (!validEmail || !validPhone) { showNotice('Use a Gmail address and valid 10-digit mobile number'); return }
    const path = authMode === 'login' ? '/api/customer-auth/login' : '/api/customer-auth/register'
    const body = authMode === 'login' ? { email: authEmail, password: authPassword } : { name: authName, email: authEmail, phone: authPhone, password: authPassword }
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) { showNotice(result.message || 'Could not sign in'); return }
    setAuthUser(result.user)
    setProfile({ name: result.user.profile?.name || '', email: result.user.email, phone: result.user.phone || '' })
    navigateTo('/profile')
  }

  const logoutUser = async () => {
    await fetch('/api/customer-auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined)
    setAuthUser(null)
    setProfile({ name: '', email: '', phone: '' })
    cartLoaded.current = false
    setCartReady(false)
    setCart([])
    setWishlist([])
    navigateTo('/')
  }

  const renderAccountPage = () => {
    if (pathname === '/checkout' && !authUser) return <section className="account-page page-width"><div className="account-empty large"><UserRound size={30} /><h2>Sign in to checkout</h2><p>You need a customer account before placing an order.</p><button className="account-button" type="button" onClick={() => navigateTo('/login')}>Sign in <ArrowRight size={16} /></button></div></section>
    if (pathname === '/login') return <section className="account-page page-width"><div className="auth-panel"><span className="eyebrow">THREADLINE ACCOUNT</span><h1>{authMode === 'login' ? 'Welcome back.' : 'Join the edit.'}</h1><p>{authMode === 'login' ? 'Sign in to save your bag and place orders.' : 'Create an account to start shopping.'}</p><form className="account-card" onSubmit={submitAuth}>{authMode === 'register' && <label className="account-field"><span>Full name</span><input value={authName} onChange={(event) => setAuthName(event.target.value)} required /></label>}<label className="account-field"><span>Gmail address</span><input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@gmail.com" required /></label>{authMode === 'register' && <label className="account-field"><span>10-digit mobile number</span><input value={authPhone} onChange={(event) => setAuthPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} required /></label>}<label className="account-field"><span>Password</span><input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={8} required /></label><button className="account-button" type="submit">{authMode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></button></form><button className="text-link auth-switch" type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? 'Create a new account' : 'Already have an account? Sign in'}</button></div></section>
    if (pathname === '/orders') return <section className="account-page page-width"><div className="account-heading"><span className="eyebrow">YOUR THREADLINE</span><h1>Orders</h1><p>Track every order from packed to delivered.</p></div>{orders.length ? <div className="orders-list">{orders.map((order) => { const statuses = ['placed', 'packed', 'shipped', 'out_for_delivery', 'delivered']; const current = statuses.indexOf(order.status); return <article className="order-card" key={order._id}><div className="order-card-head"><div><strong>Order {order._id.slice(-8).toUpperCase()}</strong><small>{new Date(order.createdAt).toLocaleDateString('en-IN')} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} items</small></div><b>{formatPrice(order.total)}</b></div><div className="order-timeline">{statuses.map((status, index) => <span className={index <= current ? 'complete' : ''} key={status}><i />{status.replaceAll('_', ' ')}</span>)}</div><div className="order-card-items">{order.items.map((item, index) => <span key={`${item.name}-${item.size || ''}-${index}`}>{item.name}{item.size ? ` (${item.size})` : ''} × {item.quantity}</span>)}</div></article>})}</div> : <div className="account-empty large"><PackageCheck size={30} /><h2>No orders yet</h2><p>Your placed orders will appear here.</p><button className="account-button" type="button" onClick={() => navigateTo('/')}>Start shopping <ArrowRight size={16} /></button></div>}</section>
    if (pathname === '/profile') return <section className="account-page page-width"><div className="account-heading"><span className="eyebrow">YOUR THREADLINE</span><h1>Profile</h1><p>Keep your details and shopping preferences close.</p></div><div className="account-layout"><form className="account-card" onSubmit={async (event) => { event.preventDefault(); const response = await fetch('/api/customer/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: profile.name, phone: profile.phone }) }); const result = await response.json().catch(() => ({})) as { message?: string; profile?: CustomerProfile }; if (!response.ok || !result.profile) { showNotice(result.message || 'Could not save your profile'); return } setProfile(result.profile); showNotice('Profile saved'); }}><h2>Personal details</h2><label className="account-field"><span>Full name</span><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Your name" required /></label><label className="account-field"><span>Email address</span><input type="email" value={profile.email} placeholder="you@gmail.com" readOnly /></label><label className="account-field"><span>Phone number</span><input value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value.replace(/\\D/g, '').slice(0, 10) })} placeholder="10-digit mobile number" /></label><button className="account-button" type="submit">Save details <Check size={16} /></button><button className="account-button" type="button" onClick={() => navigateTo('/orders')}>View orders <PackageCheck size={16} /></button><button className="detail-wishlist" type="button" onClick={() => void logoutUser()}>Sign out</button></form><div className="account-card account-summary"><span className="account-icon"><MapPin size={19} /></span><div><h2>Saved addresses</h2><p>{addresses.length ? `${addresses.length} address${addresses.length === 1 ? '' : 'es'} saved` : 'No addresses saved yet.'}</p></div><button className="text-link" type="button" onClick={() => navigateTo('/address')}>Manage addresses <ArrowRight size={15} /></button></div></div></section>
    if (pathname === '/address') return <section className="account-page page-width"><button className="back-link" type="button" onClick={() => navigateTo('/profile')}><ArrowLeft size={15} /> Back to profile</button><div className="account-heading"><span className="eyebrow">DELIVERY DETAILS</span><h1>Address book</h1><p>Save an address for a faster checkout.</p></div><div className="account-layout"><form className="account-card" onSubmit={(event) => { event.preventDefault(); if (!/^560\d{3}$/.test(addressDraft.pincode.trim())) { showNotice('Delivery is currently unavailable outside Bangalore'); return } if (!/^[6-9]\d{9}$/.test(addressDraft.phone.replace(/\D/g, ''))) { showNotice('Enter a valid 10-digit phone number'); return } const address = { ...addressDraft, id: `address-${Date.now()}` }; setAddresses((current) => [...current, address]); setSelectedAddressId(address.id); setAddressDraft({ name: '', phone: '', line: '', city: '', state: '', pincode: '', type: 'Home' }); showNotice('Address saved') }}><h2>Add a new address</h2>{([['name', 'Full name'], ['phone', 'Phone number'], ['line', 'Address'], ['city', 'City'], ['state', 'State'], ['pincode', 'PIN code']] as const).map(([field, label]) => <label className="account-field" key={field}><span>{label}</span><input value={addressDraft[field]} onChange={(event) => setAddressDraft({ ...addressDraft, [field]: event.target.value })} required /></label>)}<button className="account-button" type="submit">Save address <MapPin size={16} /></button></form><div className="address-list">{addresses.length ? addresses.map((address) => <article className={`address-card ${selectedAddressId === address.id ? 'selected' : ''}`} key={address.id}><div><strong>{address.name}</strong><span>{address.line}, {address.city}, {address.state} - {address.pincode}</span><small>{address.phone} · {address.type}</small></div><button type="button" onClick={() => setSelectedAddressId(address.id)}>{selectedAddressId === address.id ? <><Check size={14} /> Selected</> : 'Use this address'}</button></article>) : <div className="account-empty"><MapPin size={24} /><p>Your saved addresses will appear here.</p></div>}</div></div></section>
    if (pathname === '/wishlist') return <section className="account-page page-width"><div className="account-heading"><span className="eyebrow">SAVED FOR LATER</span><h1>Wishlist</h1><p>{savedProducts.length} saved piece{savedProducts.length === 1 ? '' : 's'}</p></div>{savedProducts.length ? <div className="saved-grid">{savedProducts.map((product) => <article className="saved-card" key={productId(product)}><img src={product.imageUrl} alt={product.name} /><div><h3>{product.name}</h3><strong>{formatPrice(product.sellingPrice ?? product.cost)}</strong><div><button type="button" onClick={() => addToCart(product)}>Add to bag</button><button type="button" aria-label={`Remove ${product.name} from wishlist`} onClick={() => toggleWishlist(product)}><Trash2 size={15} /></button></div></div></article>)}</div> : <div className="account-empty large"><Heart size={30} /><h2>Your wishlist is empty</h2><p>Save pieces you love and come back to them anytime.</p><button className="account-button" type="button" onClick={() => navigateTo('/')}>Browse the edit <ArrowRight size={16} /></button></div>}</section>
    if (pathname === '/cart') return <section className="account-page page-width"><div className="account-heading"><span className="eyebrow">YOUR BAG</span><h1>Shopping bag</h1><p>{bagCount} item{bagCount === 1 ? '' : 's'} ready when you are.</p></div>{cart.length ? <div className="cart-layout"><div className="cart-items">{cart.map((item) => <article className="cart-item" key={cartKey(item)}><img src={item.imageUrl} alt={item.name} /><div className="cart-item-copy"><h3>{item.name}</h3><p>{item.category} / {item.subcategory}{item.size ? ` / Size ${item.size}` : ''}</p><strong>{formatPrice(item.salePrice ?? item.sellingPrice ?? item.cost)}</strong><div className="quantity-control"><button type="button" onClick={() => updateCartQuantity(cartKey(item), -1)}><Minus size={13} /></button><span>{item.quantity}</span><button type="button" onClick={() => updateCartQuantity(cartKey(item), 1)}><Plus size={13} /></button></div></div><button className="remove-item" type="button" onClick={() => removeFromCart(cartKey(item))} aria-label={`Remove ${item.name}`}><Trash2 size={16} /></button></article>)}</div><aside className="cart-summary"><span className="eyebrow">ORDER SUMMARY</span><h2>Almost yours.</h2><div><span>Subtotal</span><strong>{formatPrice(cartTotal)}</strong></div><div><span>Delivery</span><strong>{cartTotal >= 1499 ? 'FREE' : '₹99'}</strong></div><hr /><div><span>GST (18%)</span><strong>{formatPrice(gstAmount)}</strong></div><div className="summary-total"><span>Total (incl. GST)</span><strong>{formatPrice(finalTotal)}</strong></div><button className="account-button" type="button" onClick={() => navigateTo('/checkout')}>Continue to checkout <ArrowRight size={16} /></button></aside></div> : <div className="account-empty large"><ShoppingBag size={30} /><h2>Your bag is empty</h2><p>Find something that feels like you.</p><button className="account-button" type="button" onClick={() => navigateTo('/')}>Continue shopping <ArrowRight size={16} /></button></div>}</section>
    return <section className="account-page page-width"><button className="back-link" type="button" onClick={() => navigateTo('/cart')}><ArrowLeft size={15} /> Back to bag</button><div className="account-heading"><span className="eyebrow">SECURE CHECKOUT</span><h1>Checkout</h1><p>Almost there. Choose where we should deliver your order.</p></div><div className="checkout-layout"><div><div className="account-card checkout-block"><div className="checkout-title"><span><MapPin size={17} /></span><h2>Delivery address</h2><button className="text-link" type="button" onClick={() => navigateTo('/address')}>Add address</button></div>{addresses.length ? addresses.map((address) => <button className={`checkout-address ${selectedAddressId === address.id ? 'selected' : ''}`} type="button" key={address.id} onClick={() => setSelectedAddressId(address.id)}><span>{selectedAddressId === address.id ? <Check size={15} /> : null}</span><strong>{address.name}</strong><small>{address.line}, {address.city}, {address.state} - {address.pincode}</small></button>) : <p className="checkout-empty">Add an address before placing your order.</p>}</div><div className="account-card checkout-block"><div className="checkout-title"><span><CreditCard size={17} /></span><h2>Payment method</h2></div><div className="payment-option"><span>COD</span><div><strong>Cash on delivery</strong><small>Pay when your order arrives</small></div><Check size={16} /></div></div></div><aside className="cart-summary"><span className="eyebrow">YOUR ORDER</span><h2>{bagCount} item{bagCount === 1 ? '' : 's'}</h2>{cart.map((item) => <div className="checkout-line" key={cartKey(item)}><span>{item.name}{item.size ? ` (${item.size})` : ''} × {item.quantity}</span><strong>{formatPrice((item.salePrice ?? item.sellingPrice ?? item.cost) * item.quantity)}</strong></div>)}<hr /><div><span>Subtotal</span><strong>{formatPrice(cartTotal)}</strong></div><div><span>Delivery</span><strong>{deliveryFee ? formatPrice(deliveryFee) : 'FREE'}</strong></div><div><span>GST (18%)</span><strong>{formatPrice(gstAmount)}</strong></div><div className="summary-total"><span>Total (incl. GST)</span><strong>{formatPrice(finalTotal)}</strong></div><button className="account-button" type="button" disabled={!cart.length || !selectedAddressId} onClick={() => { setCart([]); showNotice('Order placed successfully'); navigateTo('/') }}>Place order <Check size={16} /></button></aside></div></section>
  }

  return (
    <div className="storefront">
      <div className="announcement"><Sparkles size={13} /> Free delivery on orders over ₹1,499 <span>•</span> 7 day easy returns</div>
      <header className="site-header">
        <button className="mobile-menu" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
        <button className="brand brand-button" type="button" onClick={() => navigateTo('/')} aria-label="Threadline home"><span className="brand-mark">t</span><span>threadline</span></button>
        <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <button className="mobile-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={20} /></button>
          {navItems.map((item) => <button key={item} type="button" className={activeMenu === item ? 'nav-active' : ''} onMouseEnter={() => setActiveMenu(item)} onClick={() => { setMenuOpen(false); if (categoryRoutes[item]) navigateTo(categoryRoutes[item]); else { setActiveMenu(item); setActiveSubcategory(''); setActiveCategory('All') } }}>{item}{item === 'Studio' && <sup>new</sup>}</button>)}
        </nav>
        {(activeMenu || menuOpen) && <button className="menu-backdrop" type="button" aria-label="Close category menu" onClick={() => { setActiveMenu(''); setMenuOpen(false) }} />}
        <div className={`mega-menu ${activeMenu && menuGroups.length ? 'is-visible' : ''}`} onMouseLeave={() => setActiveMenu('')}>
          <div className="mega-menu-inner">
            {menuGroups.map((group) => <section className="mega-group" key={group.title}><h3>{group.title}</h3>{group.items.map((item) => <button type="button" key={item} onClick={() => { if (categoryRoutes[activeMenu]) navigateTo(categoryRoutes[activeMenu]); setActiveCategory(activeMenu === 'Women' || activeMenu === 'Men' ? activeMenu : 'All'); setActiveSubcategory(item); setActiveMenu('') }}>{item}</button>)}</section>)}
          </div>
        </div>
        <div className="header-actions">
          <label className="search-field"><Search size={18} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search products, brands and more" aria-label="Search products" /></label>
          <button type="button" className="header-icon" onClick={() => navigateTo('/profile')}><UserRound size={20} /><span>Profile</span></button>
          <button type="button" className="header-icon" onClick={() => navigateTo('/wishlist')}><Heart size={20} fill={wishlist.length ? 'currentColor' : 'none'} /><span>Wishlist</span>{wishlist.length > 0 && <b>{wishlist.length}</b>}</button>
          <button type="button" className="header-icon bag-icon" onClick={() => navigateTo('/cart')}><ShoppingBag size={20} /><span>Bag</span>{bagCount > 0 && <b>{bagCount}</b>}</button>
        </div>
      </header>

      {accountPage && renderAccountPage()}
      {selectedProduct && !accountPage && <section className="product-detail-page page-width">
        <nav className="product-breadcrumbs" aria-label="Breadcrumb">
          <button type="button" onClick={() => navigateTo('/')}>Home</button><span>/</span>
          <button type="button" onClick={() => navigateTo(categoryRoutes[selectedProduct.category] || '/')}>{selectedProduct.category}</button><span>/</span>
          <span>{selectedProduct.subcategory}</span>
        </nav>
        <div className="product-detail-layout">
          <div className={`product-gallery ${productImages.length > 1 ? 'has-thumbnails' : ''}`}>
            {productImages.length > 1 && <div className="product-gallery-thumbnails" aria-label="Product images">{productImages.map((image, index) => <button type="button" className={selectedImageUrl === image ? 'selected' : ''} onClick={() => setSelectedImageUrl(image)} key={image} aria-label={`View product image ${index + 1}`}><img src={image} alt="" loading="lazy" /></button>)}</div>}
            <div className="product-gallery-main"><img src={selectedImageUrl || selectedProduct.imageUrl} alt={selectedProduct.name} />{selectedProduct.outOfStock ? <span className="new-badge out-of-stock-badge">Out of stock</span> : null}</div>
          </div>
          <section className="product-purchase-panel" aria-label="Product purchase details">
            <span className="product-brand-name">{selectedProduct.catalogData?.brand || selectedProduct.seller?.application?.businessName || 'Threadline'}</span>
            <p className="product-subtitle">{selectedProduct.category} · {selectedProduct.subcategory}</p>
            <h1>{selectedProduct.name}</h1>
            {Number(selectedProduct.ratingAverage) > 0 && <div className="product-rating"><span>{Number(selectedProduct.ratingAverage).toFixed(1)} <Star size={13} fill="currentColor" /></span><b>{Number(selectedProduct.reviewCount || 0).toLocaleString('en-IN')} Ratings</b></div>}
            <div className="product-price-line"><strong>{formatPrice(productPrice)}</strong>{originalPrice > productPrice && <><del>{formatPrice(originalPrice)}</del>{discountPercent > 0 && <span>({discountPercent}% OFF)</span>}</>}</div>
            <p className="product-tax-note">Inclusive of all taxes</p>

            <section className="product-size-section">
              <div className="product-subsection-heading"><h2>Select size</h2><button type="button" onClick={() => showNotice('Size guidance is not available for this product yet')}>Size guide <ArrowRight size={13} /></button></div>
              <div className="product-size-options">{selectedStock.map(([size, stock]) => <button type="button" className={selectedSize === size ? 'selected' : ''} disabled={stock < 1} onClick={() => setSelectedSize(size)} key={size}><strong>{size}</strong><small>{formatPrice(productPrice)}</small></button>)}</div>
              {selectedSizeStock > 0 && selectedSizeStock < 5 && <p className="product-stock-note">Only {selectedSizeStock} left in this size</p>}
            </section>

            <div className="product-purchase-actions">
              <button className="product-add-button" type="button" disabled={selectedSizeStock < 1} onClick={() => addToCart(selectedProduct, selectedSize)}><ShoppingBag size={17} /> Add to bag</button>
              <button className="product-wishlist-button" type="button" onClick={() => toggleWishlist(selectedProduct)}><Heart size={17} fill={wishlist.includes(productId(selectedProduct)) ? 'currentColor' : 'none'} /> {wishlist.includes(productId(selectedProduct)) ? 'Wishlisted' : 'Wishlist'}</button>
            </div>

            <div className="product-service-notes"><span><Truck size={17} /> {selectedProduct.catalogData?.shippingInformation || 'Free delivery on qualifying orders'}</span><span><RotateCcw size={17} /> {selectedProduct.catalogData?.returnPolicy || 'Easy returns'}</span><span><ShieldCheck size={17} /> Secure checkout</span></div>

            <section className="product-delivery-section">
              <h2>Delivery options</h2>
              <form className="product-pincode-form" onSubmit={checkDelivery}><label className="sr-only" htmlFor="product-pincode">Enter PIN code</label><input id="product-pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="Enter PIN code" value={deliveryPincode} onChange={(event) => setDeliveryPincode(event.target.value.replace(/\D/g, '').slice(0, 6))} /><button type="submit">Check</button></form>
              <p>{deliveryMessage || 'Enter your PIN code to check delivery timing and payment options.'}</p>
            </section>

            <section className="product-offer-note"><div><Tag size={17} /><h2>Offers & benefits</h2></div><p>Free delivery is available on qualifying orders. Final delivery charges are shown at checkout.</p></section>

            <div className="product-information">
              <details open><summary>Product details</summary><p>{selectedProduct.description || selectedProduct.tagline || `${selectedProduct.category} ${selectedProduct.subcategory}.`}</p><p className="product-code">Brand: {selectedProduct.catalogData?.brand || 'Not listed'} · SKU: {selectedProduct.catalogData?.sku || productId(selectedProduct)}</p>{Boolean(selectedProduct.catalogData?.tags?.length) && <div className="product-tag-list">{selectedProduct.catalogData?.tags?.map((tag) => <span key={tag}>{tag}</span>)}</div>}</details>
              <details><summary>Specifications</summary><dl className="product-spec-list"><div><dt>Category</dt><dd>{selectedProduct.catalogData?.category || selectedProduct.category}</dd></div><div><dt>Availability</dt><dd>{selectedProduct.catalogData?.availabilityStatus || (selectedSizeStock ? 'In stock' : 'Out of stock')}</dd></div>{selectedProduct.catalogData?.weight !== undefined && <div><dt>Weight</dt><dd>{selectedProduct.catalogData.weight} g</dd></div>}{selectedProduct.catalogData?.dimensions && <div><dt>Dimensions</dt><dd>{['width', 'height', 'depth'].map((dimension) => selectedProduct.catalogData?.dimensions?.[dimension as keyof NonNullable<ProductCatalogData['dimensions']>]).filter((value) => value !== undefined).join(' × ')}</dd></div>}{selectedProduct.catalogData?.minimumOrderQuantity !== undefined && <div><dt>Minimum order</dt><dd>{selectedProduct.catalogData.minimumOrderQuantity}</dd></div>}{selectedProduct.catalogData?.meta?.barcode && <div><dt>Barcode</dt><dd>{selectedProduct.catalogData.meta.barcode}</dd></div>}{selectedProduct.catalogData?.meta?.createdAt && <div><dt>Listed</dt><dd>{new Date(selectedProduct.catalogData.meta.createdAt).toLocaleDateString('en-IN')}</dd></div>}{selectedProduct.catalogData?.warrantyInformation && <div><dt>Warranty</dt><dd>{selectedProduct.catalogData.warrantyInformation}</dd></div>}</dl>{selectedProduct.catalogData?.meta?.qrCode && <a className="product-qr-link" href={selectedProduct.catalogData.meta.qrCode} target="_blank" rel="noreferrer">View product QR code <ArrowRight size={13} /></a>}</details>
              <details open><summary>Customer reviews ({reviewList.length})</summary>{reviewList.length ? <div className="product-reviews">{reviewList.map((review, index) => <article key={`${review.createdAt || review.date}-${index}`}><span><Star size={12} fill="currentColor" /> {review.rating}/5</span><p>{review.comment}</p><small>{review.customerName || review.reviewerName}{(review.createdAt || review.date) ? ` · ${new Date(review.createdAt || review.date || '').toLocaleDateString('en-IN')}` : ''}</small></article>)}</div> : <p>No reviews yet. Be the first to review this product.</p>}{authUser ? <form className="product-review-form" onSubmit={submitReview}><label>Your rating <select value={reviewDraft.rating} onChange={(event) => setReviewDraft({ ...reviewDraft, rating: event.target.value })}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label><textarea value={reviewDraft.comment} onChange={(event) => setReviewDraft({ ...reviewDraft, comment: event.target.value })} placeholder="Write your review" minLength={3} required /><button className="account-button" type="submit">Submit review</button></form> : <p>Sign in to write a review.</p>}</details>
              <details><summary>Delivery, returns & seller</summary><p>{selectedProduct.catalogData?.shippingInformation || 'Delivery timing is confirmed at checkout.'}</p><p>Returns: {selectedProduct.catalogData?.returnPolicy || 'Check return eligibility at checkout.'}</p><p>Seller: {selectedProduct.seller?.application?.businessName || 'Threadline marketplace seller'}</p></details>
            </div>
          </section>
        </div>
      </section>}
      <main id="top" className={accountPage || selectedProduct ? 'content-hidden' : ''}>
        {!categoryPage && <section className="hero" aria-label="Seasonal campaign">
          <div className="hero-content"><span className="hero-kicker">THE NEW SEASON EDIT</span><h1>Your style,<br /><i>your way.</i></h1><p>New-season fashion, everyday essentials, and the little things that make a look yours.</p><button className="hero-button" type="button" onClick={() => document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth' })}>Shop new arrivals <ArrowRight size={17} /></button></div>
          <div className="hero-note"><span>NEW SEASON</span><span>·</span><span>NEW YOU</span></div>
        </section>}

        {!categoryPage && <section className="category-section page-width"><div className="section-heading"><div><span className="eyebrow">A LITTLE SOMETHING FOR EVERYONE</span><h2>Shop by category</h2></div><button type="button" className="text-link" onClick={() => { setActiveCategory('All'); setActiveSubcategory('') }}>View all <ArrowRight size={15} /></button></div><div className="category-grid">{categories.map((category) => <button className={`category-card ${category.tone}`} type="button" key={category.label} onClick={() => { const route = categoryRoutes[category.label]; if (route) navigateTo(route); else { setActiveCategory('All'); setActiveSubcategory(''); document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth' }) } }}><img src={category.image} alt="" /><span>{category.label}</span><small>Explore <ArrowRight size={13} /></small></button>)}</div></section>}

        {categoryPage && pageCopy && <section className="category-hero page-width"><div className="category-hero-copy"><span className="eyebrow">{pageCopy.eyebrow}</span><h1>{pageCopy.title}</h1><p>{pageCopy.description}</p></div><div className="category-hero-image" style={{ backgroundImage: `url(${pageCopy.image})` }} /></section>}

        <section className={`discover page-width ${categoryPage ? 'category-discover' : ''}`} id="discover">
          <div className="section-heading discover-heading"><div><span className="eyebrow">{categoryPage ? `${categoryPage.toUpperCase()} COLLECTION` : 'JUST LANDED'}</span><h2>{categoryPage ? `${categoryPage} picks` : 'New in, now'}</h2></div><div className="filter-actions"><div className="category-tabs">{['All', 'Women', 'Men', 'Accessories'].map((item) => <button type="button" className={activeCategory === item && !activeSubcategory && !categoryPage ? 'selected' : ''} onClick={() => { setActiveCategory(item); setActiveSubcategory(''); if (categoryPage) navigateTo('/') }} key={item}>{item}</button>)}</div><button className="filter-button" type="button" onClick={() => showNotice('More filters are coming soon')}><SlidersHorizontal size={15} /> Filter</button></div></div>
          {loading && <p className="loading-copy">Loading all products...</p>}
          {!loading && visibleProducts.length === 0 && <p className="empty-copy">No products match that search yet. Try another category or search.</p>}
          <div className="product-grid">{visibleProducts.map((product) => {
            const id = productId(product)
            const saved = wishlist.includes(id)
            const listedPrice = product.salePrice ?? product.sellingPrice ?? product.cost
            return <article className="product-card" key={id}>
              <div className="product-image"><img src={product.imageUrl} alt={product.name} loading="lazy" />{product.salePercent ? <span className="new-badge">{Math.round(product.salePercent)}% OFF</span> : null}{product.outOfStock ? <span className="new-badge out-of-stock-badge">Out of stock</span> : null}<div className="product-actions"><button type="button" aria-label={`View details for ${product.name}`} onClick={() => navigateTo(`/product/${encodeURIComponent(id)}`)}><Eye size={17} /></button><button type="button" className={saved ? 'saved' : ''} aria-label={`${saved ? 'Remove' : 'Add'} ${product.name} ${saved ? 'from' : 'to'} wishlist`} onClick={() => toggleWishlist(product)}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button><button type="button" aria-label={`Add ${product.name} to cart`} onClick={() => addToCart(product)}><ShoppingBag size={17} /></button></div></div>
              <div className="product-meta"><div><h3>{product.catalogData?.brand || product.name}</h3><p>{product.catalogData?.brand ? product.name : product.tagline || `${product.category} / ${product.subcategory}`}</p></div><div className="product-card-pricing"><strong>{formatPrice(listedPrice)}</strong>{(product.sellingPrice ?? product.cost) > listedPrice && <del>{formatPrice(product.sellingPrice ?? product.cost)}</del>}</div></div>
            </article>
          })}</div>
        </section>

        <section className="editorial page-width"><div className="editorial-image" /><div className="editorial-copy"><span className="eyebrow">YOUR NEXT FAVOURITE LOOK</span><h2>Good finds.<br /><i>Great outfits.</i></h2><p>From everyday staples to plans-after-dark pieces, find a little more to love.</p><button className="text-link" type="button" onClick={() => document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth' })}>Explore new arrivals <ArrowRight size={15} /></button></div></section>
      </main>
      <footer className="site-footer page-width"><a className="brand" href="#top"><span className="brand-mark">t</span><span>threadline</span></a><span>Independent style, thoughtfully gathered.</span><span>© 2026 Threadline</span></footer>
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}

export default App
