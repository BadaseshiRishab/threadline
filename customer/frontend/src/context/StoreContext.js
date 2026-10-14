import { createContext, useContext, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import * as authApi from '../api/auth'
import * as customerApi from '../api/customer'
import { getJson } from '../api/client'
import { fetchProducts } from '../api/products'
import { categoryRoutes, defaultShopSettings, emptyFilters, emptyProfile, signedInPages } from '../utils/constants'
import { indianMobileMessage, normalizeIndianMobile } from '../utils/mobile'
import { mrpOf, productId } from '../utils/product'
import { readStorage, writeStorage } from '../utils/storage'

const StoreContext = createContext(null)

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside <StoreProvider>')
  return store
}

export function StoreProvider({ children }) {
  // ── Navigation and notices ─────────────────────────────────────────────────────────────────────────────────────
  const [pathname, setPathname] = useState(window.location.pathname)
  const [notice, setNotice] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const [sortBy, setSortBy] = useState('recommended')
  const [searchTerm, setSearchTerm] = useState('')
  const [profileDraft, setProfileDraft] = useState(null)
  // Fees, delivery area and account rules, as the customer API enforces them.
  const [shopSettings, setShopSettings] = useState(defaultShopSettings)
  useEffect(() => {
    customerApi.fetchShopSettings().then((settings) => setShopSettings({ ...defaultShopSettings, ...settings })).catch(() => undefined)
  }, [])
  const inDeliveryArea = (pincode) => /^\d{6}$/.test(String(pincode).trim()) && String(pincode).trim().startsWith(shopSettings.deliveryPinPrefix)

  const showNotice = (message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  const navigateTo = (path) => {
    window.history.pushState({}, '', path)
    setPathname(path)
    setFilters(emptyFilters)
    setProfileDraft(null)
    if (!path.startsWith('/shop')) setSearchTerm('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Opens the listing for a department (or every product), with some filters already applied.
  const shopWithFilter = (category, patch) => {
    const label = Object.keys(categoryRoutes).find((entry) => entry.toLowerCase() === category.toLowerCase())
    const route = label ? categoryRoutes[label] : '/shop'
    if (pathname !== route) navigateTo(route)
    setFilters({ ...emptyFilters, ...(!label && category ? { categories: [category] } : {}), ...patch })
  }
  const toggleFilter = (key, value) => setFilters((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((entry) => entry !== value) : [...current[key], value] }))

  // ── Catalogue ───────────────────────────────────────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchProducts()
      .then((catalog) => { if (active) setProducts(catalog) })
      .catch(() => { if (active) setProducts([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const refreshProducts = () => getJson('/products').then((result) => { if (Array.isArray(result.products)) setProducts(result.products) }).catch(() => undefined)

  const submitReview = async (product, review) => {
    const { ok, result } = await customerApi.submitReview(productId(product), review)
    if (!ok) { showNotice(result.message || 'Could not submit review'); return false }
    setProducts((current) => current.map((entry) => productId(entry) === productId(product) ? { ...entry, ratingAverage: result.ratingAverage, reviewCount: result.reviewCount, reviews: result.reviews } : entry))
    showNotice('Thanks for your review')
    return true
  }

  // ── Signed-in customer ──────────────────────────────────────────────────────────────────────────────────────────
  const [authUser, setAuthUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState(emptyProfile)

  useEffect(() => {
    authApi.fetchCurrentUser().then(setAuthUser).catch(() => setAuthUser(null)).finally(() => setAuthReady(true))
  }, [])

  useEffect(() => {
    if (!authUser) {
      setProfile(emptyProfile)
      return
    }
    let active = true
    customerApi.fetchProfile()
      .then((customerProfile) => { if (active) setProfile(customerProfile) })
      .catch(() => { if (active) showNotice('Could not load your profile') })
    return () => { active = false }
  }, [authUser])

  useEffect(() => {
    if (authReady && !authUser && signedInPages.includes(pathname)) navigateTo('/login')
  }, [authReady, authUser, pathname])

  const finishAuth = (user) => {
    setAuthUser(user)
    setProfile({ ...emptyProfile, name: user.profile?.name || '', email: user.email, phone: user.phone || '' })
    navigateTo('/account')
  }

  const saveProfile = async (draft) => {
    if (draft.phone && !normalizeIndianMobile(draft.phone)) { showNotice(indianMobileMessage); return }
    if (draft.alternateMobile && !normalizeIndianMobile(draft.alternateMobile)) { showNotice(`Alternate mobile: ${indianMobileMessage}`); return }
    const { name, phone, gender, dateOfBirth, alternateMobile, location } = draft
    const { ok, result } = await customerApi.saveProfile({ name, phone, gender, dateOfBirth, alternateMobile, location })
    if (!ok || !result.profile) { showNotice(result.message || 'Could not save your profile'); return }
    setProfile(result.profile)
    setProfileDraft(null)
    showNotice('Profile details saved')
  }

  // ── Wishlist and bag ────────────────────────────────────────────────────────────────────────────────────────────
  // Kept in this browser, and on the customer's account once they sign in.
  const [wishlist, setWishlist] = useState(() => readStorage('threadline-wishlist', []))
  const [cart, setCart] = useState(() => readStorage('threadline-cart', []))
  const [sizePicker, setSizePicker] = useState(null)
  const cartLoaded = useRef(false)
  const [cartReady, setCartReady] = useState(false)

  useEffect(() => { writeStorage('threadline-wishlist', wishlist) }, [wishlist])
  useEffect(() => { writeStorage('threadline-cart', cart) }, [cart])

  // After sign-in, the saved bag (only items whose stock is still reserved) and wishlist replace the browser's.
  useEffect(() => {
    if (!authUser || !products.length || cartLoaded.current) return
    cartLoaded.current = true
    void Promise.all([customerApi.fetchSavedCart(), customerApi.fetchSavedWishlist(), customerApi.fetchReservations()]).then(([savedCart, savedWishlist, savedReservations]) => {
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
    void customerApi.saveCart(cart.map((item) => ({ productId: productId(item), size: item.size || '', quantity: item.quantity })))
  }, [cart, cartReady])
  useEffect(() => {
    if (!authUser || !cartReady) return
    void customerApi.saveWishlist(wishlist)
  }, [wishlist, cartReady])
  useEffect(() => {
    const timer = window.setInterval(() => {
      const alive = cart.filter((item) => !item.reservedUntil || new Date(item.reservedUntil).getTime() > Date.now())
      if (alive.length !== cart.length) { setCart(alive); showNotice(`Some bag items were released after their ${shopSettings.bagHoldMinutes}-minute reservation ended`) }
    }, 15000)
    return () => window.clearInterval(timer)
  }, [cart, shopSettings.bagHoldMinutes])

  const bagCount = cart.reduce((total, item) => total + item.quantity, 0)
  const cartTotal = cart.reduce((total, item) => total + (item.salePrice ?? item.sellingPrice ?? item.cost) * item.quantity, 0)
  const cartMrp = cart.reduce((total, item) => total + mrpOf(item) * item.quantity, 0)
  const deliveryFee = cartTotal >= shopSettings.freeDeliveryFrom ? 0 : shopSettings.deliveryFee
  const gstAmount = Number(((cartTotal + deliveryFee) * shopSettings.gstPercent / 100).toFixed(2))
  const finalTotal = Number((cartTotal + deliveryFee + gstAmount).toFixed(2))
  const cartKey = (item) => `${productId(item)}::${item.size || ''}`

  // Resolves to the reservation's expiry, '' or null when nothing needs reserving, or undefined when it failed.
  const reserveItem = async (id, size, quantity) => {
    if (!size) return quantity > 0 ? '' : null
    const { ok, result } = await customerApi.reserve(id, size, quantity)
    if (!ok) { showNotice(result.message || 'Could not reserve this item'); return undefined }
    return result.reservation?.expiresAt ?? null
  }
  // Resolves to true only when the item actually made it into the bag.
  const addToCart = async (product, requestedSize) => {
    if (!authUser) { navigateTo('/login'); showNotice('Please sign in before buying'); return false }
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
    showNotice(`${product.name}${size ? ` (${size})` : ''} reserved in your bag for ${shopSettings.bagHoldMinutes} minutes`)
    return true
  }
  const updateCartQuantity = async (key, change) => {
    const item = cart.find((entry) => cartKey(entry) === key)
    if (!item) return
    const quantity = item.quantity + change
    const reservedUntil = await reserveItem(productId(item), item.size || '', Math.max(0, quantity))
    if (reservedUntil === undefined) return
    setCart((current) => current.flatMap((entry) => cartKey(entry) === key ? (quantity > 0 ? [{ ...entry, quantity, reservedUntil: reservedUntil || undefined }] : []) : [entry]))
  }
  const removeFromCart = async (key) => {
    const item = cart.find((entry) => cartKey(entry) === key)
    if (item) await reserveItem(productId(item), item.size || '', 0)
    setCart((current) => current.filter((entry) => cartKey(entry) !== key))
  }

  const toggleWishlist = (product) => {
    const id = productId(product)
    setWishlist((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
    showNotice(wishlist.includes(id) ? 'Removed from your wishlist' : 'Added to your wishlist')
  }
  const moveToBag = async (product, size) => {
    if (!await addToCart(product, size)) return
    const id = productId(product)
    setWishlist((current) => current.filter((item) => item !== id))
    setSizePicker(null)
    showNotice(`${product.name}${size && size !== 'One size' ? ` (${size})` : ''} moved to your bag`)
  }
  // Like Myntra, products with a choice of sizes ask for one before leaving the wishlist.
  const startMoveToBag = (product) => {
    const sizes = Object.keys(product.stock || {})
    if (!authUser || product.outOfStock || product.stockTotal === 0 || sizes.length < 2) { void moveToBag(product); return }
    setSizePicker(product)
  }

  // ── Addresses ───────────────────────────────────────────────────────────────────────────────────────────────────
  // Addresses belong to the signed-in customer and are saved on their account. Only the choice of default address is
  // kept in this browser, under a key per customer. (Addresses used to be stored in the browser for everyone who
  // signed in on it, so those old keys are removed.)
  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  // { address } while the add/edit address form is open; address is undefined when adding a new one.
  const [addressModal, setAddressModal] = useState(null)

  useEffect(() => {
    window.localStorage.removeItem('threadline-addresses')
    window.localStorage.removeItem('threadline-selected-address')
  }, [])
  useEffect(() => {
    setAddresses([])
    setSelectedAddressId('')
    if (!authUser) return
    let active = true
    customerApi.fetchAddresses()
      .then((saved) => {
        if (!active) return
        const remembered = readStorage(`threadline-default-address-${authUser.id}`, '')
        setAddresses(saved)
        setSelectedAddressId(saved.some((entry) => entry.id === remembered) ? remembered : saved[0]?.id || '')
      })
      .catch(() => { if (active) showNotice('Could not load your addresses') })
    return () => { active = false }
  }, [authUser?.id])
  useEffect(() => {
    if (authUser && selectedAddressId) writeStorage(`threadline-default-address-${authUser.id}`, selectedAddressId)
  }, [authUser, selectedAddressId])

  const openAddressModal = (address) => setAddressModal({ address })
  // Resolves to true once the address is saved.
  const saveAddress = async (draft, makeDefault, editingId) => {
    if (!authUser) { showNotice('Sign in to save addresses'); navigateTo('/login'); return false }
    if (!inDeliveryArea(draft.pincode)) { showNotice(`Delivery is currently unavailable outside ${shopSettings.deliveryAreaName}`); return false }
    const addressPhone = normalizeIndianMobile(draft.phone)
    if (!addressPhone) { showNotice(indianMobileMessage); return false }
    const address = { ...draft, name: draft.name.trim(), line: draft.line.trim(), locality: draft.locality.trim(), city: draft.city.trim(), state: draft.state.trim(), pincode: draft.pincode.trim(), phone: addressPhone, id: editingId || `address-${Date.now()}` }
    const { ok, result } = await customerApi.saveAddress(address)
    if (!ok) { showNotice(result.message || 'Could not save the address'); return false }
    setAddresses(result.addresses)
    if (makeDefault || !selectedAddressId) setSelectedAddressId(address.id)
    setAddressModal(null)
    showNotice(editingId ? 'Address updated' : 'Address saved')
    return true
  }
  const removeAddress = async (id) => {
    const { ok, result } = await customerApi.removeAddress(id)
    if (!ok) { showNotice(result.message || 'Could not remove the address'); return }
    const remaining = result.addresses
    setAddresses(remaining)
    if (selectedAddressId === id) setSelectedAddressId(remaining[0]?.id || '')
    showNotice('Address removed')
  }

  // ── Orders and returns ──────────────────────────────────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState([])
  // { orderId, item } while the return form is open.
  const [returnModal, setReturnModal] = useState(null)

  // Re-fetched on opening the orders pages so delivery updates and seller replies to returns show up.
  const ordersPage = pathname === '/orders' || pathname === '/account'
  useEffect(() => {
    if (!authUser) return
    customerApi.fetchOrders().then(setOrders).catch(() => undefined)
  }, [authUser, ordersPage])

  const updateOrder = (updatedOrder) => setOrders((current) => current.map((order) => order._id === updatedOrder._id ? updatedOrder : order))

  // ── Checkout and payment ────────────────────────────────────────────────────────────────────────────────────────
  const [placingOrder, setPlacingOrder] = useState(false)
  // The UPI payment box: { orderId, total, upiId, payeeName, link, expiresAt, qr, transactionId, sending, error }.
  const [upiPayment, setUpiPayment] = useState(null)
  // Shown for a few seconds after paying, before moving on to the orders page.
  // verified: the gateway (PhonePe) confirmed the payment; otherwise it still has to be checked (UPI UTR).
  const [paymentSuccess, setPaymentSuccess] = useState(null)

  const orderPlaced = (message) => {
    setCart([])
    void refreshProducts()
    showNotice(message)
    navigateTo('/orders')
  }

  // Releases the stock an unpaid online order was holding (UPI with a UTR, when the customer closes the payment box).
  const cancelOnlinePayment = async (orderId, message) => {
    const { result } = await customerApi.cancelPayment(orderId)
    if (result.order) orderPlaced('Payment received. Order placed successfully')
    else showNotice(message)
  }

  const startUpiPayment = async (order, payment) => {
    const qr = await QRCode.toDataURL(payment.link, { width: 440, margin: 1 }).catch(() => '')
    setUpiPayment({ ...payment, orderId: order._id, total: order.total, qr, transactionId: '', sending: false, error: '' })
  }

  const submitUpiPayment = async () => {
    if (!upiPayment || upiPayment.sending) return
    if (!/^\d{12}$/.test(upiPayment.transactionId)) { setUpiPayment({ ...upiPayment, error: 'Enter the 12-digit UPI transaction ID (UTR) from your UPI app.' }); return }
    setUpiPayment({ ...upiPayment, sending: true, error: '' })
    const { ok, result } = await customerApi.submitUpiPayment(upiPayment.orderId, upiPayment.transactionId)
    if (!ok) { setUpiPayment((current) => current && { ...current, sending: false, error: result.message || 'Could not submit your payment. Please try again.' }); return }
    setPaymentSuccess({ orderId: upiPayment.orderId, total: upiPayment.total })
    setUpiPayment(null)
  }

  const closeUpiPayment = () => {
    if (!upiPayment || upiPayment.sending) return
    if (!window.confirm('Close without paying? Your order will not be placed. If you have already paid, enter the transaction ID instead.')) return
    const { orderId } = upiPayment
    setUpiPayment(null)
    void cancelOnlinePayment(orderId, 'UPI payment cancelled. Your order was not placed.')
  }

  const finishPaymentSuccess = () => {
    const verified = paymentSuccess?.verified
    setPaymentSuccess(null)
    orderPlaced(verified ? 'Payment successful. Order placed' : 'Order placed. We will confirm your UPI payment shortly')
  }

  const placeOrder = async (paymentMethod) => {
    const shippingAddress = addresses.find((address) => address.id === selectedAddressId)
    if (!authUser || !shippingAddress || !cart.length || placingOrder) return
    setPlacingOrder(true)
    const { ok, result } = await customerApi.placeOrder({ shippingAddress, paymentMethod, items: cart.map((item) => ({ productId: productId(item), size: item.size, quantity: item.quantity })) })
    if (!ok) { setPlacingOrder(false); showNotice(result.message || 'Could not place order'); return }
    // PhonePe: go to its payment page; it sends the customer back to /payment/phonepe?order=<id>.
    if (paymentMethod === 'phonepe' && result.payment?.redirectUrl) { window.location.assign(result.payment.redirectUrl); return }
    setPlacingOrder(false)
    if (paymentMethod === 'upi') { await startUpiPayment(result.order, result.payment); return }
    orderPlaced('Order placed successfully')
  }

  const logoutUser = async () => {
    await authApi.logout()
    setAuthUser(null)
    setProfile(emptyProfile)
    cartLoaded.current = false
    setCartReady(false)
    setCart([])
    setWishlist([])
    navigateTo('/')
  }

  const value = {
    pathname, navigateTo, notice, showNotice, shopSettings, inDeliveryArea,
    filters, setFilters, toggleFilter, sortBy, setSortBy, searchTerm, setSearchTerm, shopWithFilter,
    products, loading, submitReview,
    authUser, authReady, profile, profileDraft, setProfileDraft, finishAuth, saveProfile, logoutUser,
    wishlist, toggleWishlist, cart, cartKey, addToCart, updateCartQuantity, removeFromCart, moveToBag, startMoveToBag, sizePicker, setSizePicker,
    bagCount, cartTotal, cartMrp, deliveryFee, gstAmount, finalTotal,
    addresses, selectedAddressId, setSelectedAddressId, addressModal, setAddressModal, openAddressModal, saveAddress, removeAddress,
    orders, updateOrder, returnModal, setReturnModal,
    placingOrder, placeOrder, upiPayment, setUpiPayment, submitUpiPayment, closeUpiPayment, paymentSuccess, setPaymentSuccess, finishPaymentSuccess,
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
