import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CreditCard, Eye, Heart, MapPin, Menu, Minus, PackageCheck, Plus, RotateCcw, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Star, Tag, Trash2, Truck, UserRound, X } from 'lucide-react';
import './App.css';
import './marketplace-overrides.css';
const dummyJsonCategories = {
    beauty: ['Beauty', 'Makeup'], fragrances: ['Beauty', 'Fragrance'], furniture: ['Home', 'Furniture'], groceries: ['Grocery', 'Groceries'],
    'home-decoration': ['Home', 'Home Decor'], 'kitchen-accessories': ['Home', 'Kitchen'], laptops: ['Electronics', 'Laptops'],
    'mens-shirts': ['Men', 'Shirts'], 'mens-shoes': ['Men', 'Shoes'], 'mens-watches': ['Men', 'Watches'],
    'mobile-accessories': ['Electronics', 'Mobile Accessories'], motorcycle: ['Automotive', 'Motorcycles'], 'skin-care': ['Beauty', 'Skin Care'],
    smartphones: ['Electronics', 'Smartphones'], 'sports-accessories': ['Sports', 'Sports Accessories'], sunglasses: ['Accessories', 'Sunglasses'],
    tablets: ['Electronics', 'Tablets'], tops: ['Women', 'Tops'], vehicle: ['Automotive', 'Vehicles'], 'womens-bags': ['Women', 'Bags'],
    'womens-dresses': ['Women', 'Dresses'], 'womens-jewellery': ['Women', 'Jewellery'], 'womens-shoes': ['Women', 'Shoes'], 'womens-watches': ['Women', 'Watches'],
};
function mapDummyJsonProduct(source) {
    const [category, subcategory] = dummyJsonCategories[source.category] || [source.category, 'Products'];
    const originalPrice = Number((source.price * 83.5).toFixed(2));
    const discount = Math.min(100, Math.max(0, Number(source.discountPercentage || 0)));
    const images = (source.images || []).filter(Boolean);
    const reviews = (source.reviews || []).map(({ rating, comment, date, reviewerName }) => ({ rating, comment, date, reviewerName }));
    const stock = Math.max(0, Number(source.stock || 0));
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
    };
}
const navItems = ['Men', 'Women', 'Kids', 'Home', 'Beauty', 'GenZ', 'Studio'];
const categoryRoutes = { Men: '/men', Women: '/women', Kids: '/kids', Home: '/living', Beauty: '/beauty' };
const categoryPageCopy = {
    Men: { eyebrow: 'THE MEN\'S EDIT', title: 'Made for the everyday.', description: 'Easy layers, considered essentials, and pieces that keep up.', image: 'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=1400&q=88' },
    Women: { eyebrow: 'THE WOMEN\'S EDIT', title: 'Dress like yourself.', description: 'Fresh silhouettes and forever favourites for every version of you.', image: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=1400&q=88' },
    Kids: { eyebrow: 'THE LITTLE EDIT', title: 'Big style, little people.', description: 'Play-ready pieces made for all their best adventures.', image: 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=1400&q=88' },
    Beauty: { eyebrow: 'THE BEAUTY EDIT', title: 'Your glow, your rules.', description: 'Small rituals and essentials that make a difference.', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1400&q=88' },
    Home: { eyebrow: 'THE HOME EDIT', title: 'Make space for good things.', description: 'Objects with a little more feeling for the places you call yours.', image: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1400&q=88' },
};
const categories = [
    { label: 'New in', image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=500&q=85', tone: 'rose' },
    { label: 'Women', image: 'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=500&q=85', tone: 'sand' },
    { label: 'Men', image: 'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=500&q=85', tone: 'blue' },
    { label: 'Accessories', image: 'https://images.unsplash.com/photo-1523779917675-b6ed3a42a561?auto=format&fit=crop&w=500&q=85', tone: 'gold' },
    { label: 'Beauty', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=500&q=85', tone: 'lilac' },
];
function formatPrice(value) {
    return `₹${value.toLocaleString('en-IN')}`;
}
function readStorage(key, fallback) {
    try {
        const stored = window.localStorage.getItem(key);
        return stored ? JSON.parse(stored) : fallback;
    }
    catch {
        return fallback;
    }
}
function App() {
    const [products, setProducts] = useState([]);
    const [activeCategory, setActiveCategory] = useState('All');
    const [activeSubcategory, setActiveSubcategory] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState('');
    const [pathname, setPathname] = useState(window.location.pathname);
    const [wishlist, setWishlist] = useState(() => readStorage('threadline-wishlist', []));
    const [cart, setCart] = useState(() => readStorage('threadline-cart', []));
    const [addresses, setAddresses] = useState(() => readStorage('threadline-addresses', []));
    const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
    const [selectedAddressId, setSelectedAddressId] = useState(() => readStorage('threadline-selected-address', ''));
    const [authUser, setAuthUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const [authMode, setAuthMode] = useState('login');
    const [authEmail, setAuthEmail] = useState('');
    const [authPhone, setAuthPhone] = useState('');
    const [authName, setAuthName] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [orders, setOrders] = useState([]);
    const [selectedSize, setSelectedSize] = useState('');
    const [selectedImageUrl, setSelectedImageUrl] = useState('');
    const [deliveryPincode, setDeliveryPincode] = useState('');
    const [deliveryMessage, setDeliveryMessage] = useState('');
    const [addressDraft, setAddressDraft] = useState({ name: '', phone: '', line: '', city: '', state: '', pincode: '', type: 'Home' });
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let active = true;
        const loadProducts = async () => {
            try {
                const response = await fetch('/api/products').catch(() => null);
                if (response?.ok) {
                    const result = await response.json();
                    if (Array.isArray(result.products) && result.products.length) {
                        if (active)
                            setProducts(result.products);
                        return;
                    }
                }
                const remoteResponse = await fetch('https://dummyjson.com/products?limit=0');
                if (!remoteResponse.ok)
                    throw new Error(`DummyJSON returned HTTP ${remoteResponse.status}`);
                const payload = await remoteResponse.json();
                if (!Array.isArray(payload.products))
                    throw new Error('DummyJSON returned an invalid product list');
                if (active)
                    setProducts(payload.products.map(mapDummyJsonProduct));
            }
            catch {
                if (active)
                    setProducts([]);
            }
            finally {
                if (active)
                    setLoading(false);
            }
        };
        void loadProducts();
        return () => { active = false; };
    }, []);
    useEffect(() => {
        fetch('/api/customer-auth/me', { credentials: 'include' }).then((response) => response.ok ? response.json() : Promise.reject()).then(({ user }) => setAuthUser(user)).catch(() => setAuthUser(null)).finally(() => setAuthReady(true));
    }, []);
    useEffect(() => {
        if (!authUser)
            return;
        void fetch('/api/customer/orders', { credentials: 'include' }).then((response) => response.ok ? response.json() : Promise.reject()).then(({ orders: nextOrders }) => setOrders(nextOrders)).catch(() => undefined);
    }, [authUser]);
    useEffect(() => {
        if (!authUser) {
            setProfile({ name: '', email: '', phone: '' });
            return;
        }
        let active = true;
        void fetch('/api/customer/profile', { credentials: 'include' })
            .then((response) => response.ok ? response.json() : Promise.reject())
            .then(({ profile: customerProfile }) => { if (active)
            setProfile(customerProfile); })
            .catch(() => { if (active)
            showNotice('Could not load your profile'); });
        return () => { active = false; };
    }, [authUser]);
    useEffect(() => { window.localStorage.setItem('threadline-wishlist', JSON.stringify(wishlist)); }, [wishlist]);
    useEffect(() => { window.localStorage.setItem('threadline-cart', JSON.stringify(cart)); }, [cart]);
    useEffect(() => { window.localStorage.setItem('threadline-addresses', JSON.stringify(addresses)); }, [addresses]);
    useEffect(() => { window.localStorage.setItem('threadline-selected-address', JSON.stringify(selectedAddressId)); }, [selectedAddressId]);
    const cartLoaded = useRef(false);
    const [cartReady, setCartReady] = useState(false);
    useEffect(() => {
        if (!authUser || !products.length || cartLoaded.current)
            return;
        cartLoaded.current = true;
        const load = async (path, fallback) => {
            const result = await fetch(path, { credentials: 'include' }).catch(() => null);
            return result?.ok ? await result.json() : fallback;
        };
        void Promise.all([
            load('/api/customer/cart', { cart: [] }),
            load('/api/customer/wishlist', { wishlist: [] }),
            load('/api/customer/reservations', { reservations: [] }),
        ]).then(([savedCart, savedWishlist, savedReservations]) => {
            const active = new Map(savedReservations.reservations.map((reservation) => [`${reservation.product}:${reservation.size}`, reservation.expiresAt]));
            setCart(savedCart.cart.flatMap((saved) => {
                const product = products.find((entry) => productId(entry) === saved.productId);
                const reservedUntil = active.get(`${saved.productId}:${saved.size || ''}`);
                return product && reservedUntil ? [{ ...product, quantity: saved.quantity, size: saved.size || '', reservedUntil }] : [];
            }));
            setWishlist(savedWishlist.wishlist);
            setCartReady(true);
        });
    }, [authUser, products]);
    useEffect(() => {
        if (!authUser || !cartReady)
            return;
        void fetch('/api/customer/cart', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ cart: cart.map((item) => ({ productId: productId(item), size: item.size || '', quantity: item.quantity })) }) });
    }, [cart, cartReady]);
    useEffect(() => {
        if (!authUser || !cartReady)
            return;
        void fetch('/api/customer/wishlist', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ wishlist }) });
    }, [wishlist, cartReady]);
    useEffect(() => {
        const timer = window.setInterval(() => {
            const alive = cart.filter((item) => !item.reservedUntil || new Date(item.reservedUntil).getTime() > Date.now());
            if (alive.length !== cart.length) {
                setCart(alive);
                showNotice('Some bag items were released after their 30-minute reservation ended');
            }
        }, 15000);
        return () => window.clearInterval(timer);
    }, [cart]);
    useEffect(() => {
        const handlePopState = () => setPathname(window.location.pathname);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);
    const navigateTo = (path) => {
        window.history.pushState({}, '', path);
        setPathname(path);
        setActiveMenu('');
        setActiveSubcategory('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const categoryPage = Object.entries(categoryRoutes).find(([, path]) => path === pathname)?.[0] || '';
    const pageCopy = categoryPageCopy[categoryPage];
    const catalog = products;
    const menuGroups = activeMenu && ['Men', 'Women', 'Home', 'Beauty'].includes(activeMenu)
        ? [{ title: 'Shop by category', items: [...new Set(catalog.filter((product) => product.category === activeMenu).map((product) => product.subcategory))].sort() }].filter((group) => group.items.length)
        : [];
    const visibleProducts = catalog.filter((product) => {
        const selectedCategory = categoryPage || activeCategory;
        const matchesCategory = selectedCategory === 'All' || product.category.toLowerCase() === selectedCategory.toLowerCase();
        const matchesSubcategory = !activeSubcategory || product.subcategory.toLowerCase() === activeSubcategory.toLowerCase();
        const haystack = `${product.name} ${product.catalogData?.brand || ''} ${(product.catalogData?.tags || []).join(' ')} ${product.tagline || ''} ${product.category} ${product.subcategory}`.toLowerCase();
        return matchesCategory && matchesSubcategory && haystack.includes(searchTerm.toLowerCase());
    });
    const showNotice = (message) => {
        setNotice(message);
        window.setTimeout(() => setNotice(''), 2400);
    };
    const productId = (product) => product.id || product._id || product.name;
    const bagCount = cart.reduce((total, item) => total + item.quantity, 0);
    const cartTotal = cart.reduce((total, item) => total + (item.salePrice ?? item.sellingPrice ?? item.cost) * item.quantity, 0);
    const deliveryFee = cartTotal >= 1499 ? 0 : 99;
    const gstAmount = Number(((cartTotal + deliveryFee) * 0.18).toFixed(2));
    const finalTotal = Number((cartTotal + deliveryFee + gstAmount).toFixed(2));
    const cartKey = (item) => `${productId(item)}::${item.size || ''}`;
    const reserveItem = async (id, size, quantity) => {
        if (!size)
            return quantity > 0 ? '' : null;
        const reservationResponse = await fetch('/api/customer/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ productId: id, size, quantity }) });
        const result = await reservationResponse.json().catch(() => ({}));
        if (!reservationResponse.ok) {
            showNotice(result.message || 'Could not reserve this item');
            return undefined;
        }
        return result.reservation?.expiresAt ?? null;
    };
    const addToCart = async (product, requestedSize) => {
        if (!authUser) {
            navigateTo('/login');
            showNotice('Please sign in before buying');
            return;
        }
        if (product.outOfStock || product.stockTotal === 0) {
            showNotice('This product is out of stock');
            return;
        }
        const sizeStock = Object.entries(product.stock || {});
        const size = requestedSize || sizeStock.find(([, count]) => Number(count) > 0)?.[0] || '';
        if (sizeStock.length && !(Number(product.stock?.[size]) > 0)) {
            showNotice('Select an available size');
            return;
        }
        const id = productId(product);
        const existing = cart.find((item) => productId(item) === id && (item.size || '') === size);
        const quantity = (existing?.quantity || 0) + 1;
        const reservedUntil = await reserveItem(id, size, quantity);
        if (reservedUntil === undefined)
            return;
        setCart((current) => {
            const found = current.find((item) => productId(item) === id && (item.size || '') === size);
            if (found)
                return current.map((item) => item === found ? { ...item, quantity, reservedUntil: reservedUntil || undefined } : item);
            return [...current, { ...product, quantity: 1, size, reservedUntil: reservedUntil || undefined }];
        });
        showNotice(`${product.name}${size ? ` (${size})` : ''} reserved in your bag for 30 minutes`);
    };
    const updateCartQuantity = async (key, change) => {
        const item = cart.find((entry) => cartKey(entry) === key);
        if (!item)
            return;
        const quantity = item.quantity + change;
        const reservedUntil = await reserveItem(productId(item), item.size || '', Math.max(0, quantity));
        if (reservedUntil === undefined)
            return;
        setCart((current) => current.flatMap((entry) => cartKey(entry) === key ? (quantity > 0 ? [{ ...entry, quantity, reservedUntil: reservedUntil || undefined }] : []) : [entry]));
    };
    const removeFromCart = async (key) => {
        const item = cart.find((entry) => cartKey(entry) === key);
        if (item)
            await reserveItem(productId(item), item.size || '', 0);
        setCart((current) => current.filter((entry) => cartKey(entry) !== key));
    };
    const toggleWishlist = (product) => {
        const id = productId(product);
        setWishlist((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
        showNotice(wishlist.includes(id) ? 'Removed from your wishlist' : 'Added to your wishlist');
    };
    const savedProducts = catalog.filter((product) => wishlist.includes(productId(product)));
    const selectedProduct = pathname.startsWith('/product/') ? catalog.find((product) => productId(product) === decodeURIComponent(pathname.replace('/product/', ''))) : undefined;
    const productImages = selectedProduct ? [...new Set([...(selectedProduct.catalogData?.images || []), selectedProduct.imageUrl].filter(Boolean))] : [];
    const selectedStock = selectedProduct ? Object.entries(selectedProduct.stock || { 'One size': selectedProduct.stockTotal || 0 }) : [];
    const productPrice = selectedProduct ? selectedProduct.salePrice ?? selectedProduct.sellingPrice ?? selectedProduct.cost : 0;
    const originalPrice = selectedProduct ? selectedProduct.sellingPrice ?? selectedProduct.cost : 0;
    const discountPercent = selectedProduct?.salePercent || (originalPrice > productPrice && originalPrice > 0 ? Math.round((originalPrice - productPrice) / originalPrice * 100) : 0);
    const selectedSizeStock = Number(selectedStock.find(([size]) => size === selectedSize)?.[1] || 0);
    const reviewList = selectedProduct ? (Array.isArray(selectedProduct.reviews) && selectedProduct.reviews.length ? selectedProduct.reviews : selectedProduct.catalogData?.reviews || []) : [];
    const [reviewDraft, setReviewDraft] = useState({ rating: '5', comment: '' });
    const submitReview = async (event) => {
        event.preventDefault();
        if (!selectedProduct)
            return;
        const reviewResponse = await fetch(`/api/customer/products/${productId(selectedProduct)}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ rating: Number(reviewDraft.rating), comment: reviewDraft.comment }) });
        const result = await reviewResponse.json().catch(() => ({}));
        if (!reviewResponse.ok) {
            showNotice(result.message || 'Could not submit review');
            return;
        }
        setProducts((current) => current.map((product) => productId(product) === productId(selectedProduct) ? { ...product, ratingAverage: result.ratingAverage, reviewCount: result.reviewCount, reviews: result.reviews } : product));
        setReviewDraft({ rating: '5', comment: '' });
        showNotice('Thanks for your review');
    };
    useEffect(() => {
        setSelectedSize(selectedStock[0]?.[0] || '');
        setSelectedImageUrl(productImages[0] || '');
    }, [selectedProduct?.id, selectedProduct?._id]);
    const accountPage = ['/login', '/profile', '/address', '/wishlist', '/cart', '/checkout', '/orders'].includes(pathname);
    const placeOrder = async () => {
        const shippingAddress = addresses.find((address) => address.id === selectedAddressId);
        if (!authUser || !shippingAddress || !cart.length)
            return;
        const response = await fetch('/api/customer/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ shippingAddress, items: cart.map((item) => ({ productId: productId(item), size: item.size, quantity: item.quantity })) }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            showNotice(result.message || 'Could not place order');
            return;
        }
        setCart([]);
        void fetch('/api/products').then((refreshed) => refreshed.ok ? refreshed.json() : Promise.reject()).then((result) => { if (Array.isArray(result.products))
            setProducts(result.products); }).catch(() => undefined);
        showNotice('Order placed successfully');
        navigateTo('/');
    };
    const checkDelivery = (event) => {
        event.preventDefault();
        setDeliveryMessage(!/^\d{6}$/.test(deliveryPincode) ? 'Enter a valid 6-digit PIN code.' : /^560\d{3}$/.test(deliveryPincode) ? 'Delivery is available to this Bangalore PIN code.' : 'Delivery is currently unavailable outside Bangalore.');
    };
    useEffect(() => {
        const interceptPlaceOrder = (event) => {
            const button = event.target.closest('button');
            if (!button || !button.textContent?.includes('Place order'))
                return;
            event.preventDefault();
            event.stopPropagation();
            void placeOrder();
        };
        document.addEventListener('click', interceptPlaceOrder, true);
        return () => document.removeEventListener('click', interceptPlaceOrder, true);
    }, [authUser, addresses, selectedAddressId, cart]);
    const submitAuth = async (event) => {
        event.preventDefault();
        const validEmail = /^[^\s@]+@gmail\.com$/i.test(authEmail);
        const validPhone = authMode === 'login' || /^[6-9]\d{9}$/.test(authPhone);
        if (!validEmail || !validPhone) {
            showNotice('Use a Gmail address and valid 10-digit mobile number');
            return;
        }
        const path = authMode === 'login' ? '/api/customer-auth/login' : '/api/customer-auth/register';
        const body = authMode === 'login' ? { email: authEmail, password: authPassword } : { name: authName, email: authEmail, phone: authPhone, password: authPassword };
        const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            showNotice(result.message || 'Could not sign in');
            return;
        }
        setAuthUser(result.user);
        setProfile({ name: result.user.profile?.name || '', email: result.user.email, phone: result.user.phone || '' });
        navigateTo('/profile');
    };
    const logoutUser = async () => {
        await fetch('/api/customer-auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
        setAuthUser(null);
        setProfile({ name: '', email: '', phone: '' });
        cartLoaded.current = false;
        setCartReady(false);
        setCart([]);
        setWishlist([]);
        navigateTo('/');
    };
    const renderAccountPage = () => {
        if (pathname === '/checkout' && !authUser)
            return _jsx("section", { className: "account-page page-width", children: _jsxs("div", { className: "account-empty large", children: [_jsx(UserRound, { size: 30 }), _jsx("h2", { children: "Sign in to checkout" }), _jsx("p", { children: "You need a customer account before placing an order." }), _jsxs("button", { className: "account-button", type: "button", onClick: () => navigateTo('/login'), children: ["Sign in ", _jsx(ArrowRight, { size: 16 })] })] }) });
        if (pathname === '/login')
            return _jsx("section", { className: "account-page page-width", children: _jsxs("div", { className: "auth-panel", children: [_jsx("span", { className: "eyebrow", children: "THREADLINE ACCOUNT" }), _jsx("h1", { children: authMode === 'login' ? 'Welcome back.' : 'Join the edit.' }), _jsx("p", { children: authMode === 'login' ? 'Sign in to save your bag and place orders.' : 'Create an account to start shopping.' }), _jsxs("form", { className: "account-card", onSubmit: submitAuth, children: [authMode === 'register' && _jsxs("label", { className: "account-field", children: [_jsx("span", { children: "Full name" }), _jsx("input", { value: authName, onChange: (event) => setAuthName(event.target.value), required: true })] }), _jsxs("label", { className: "account-field", children: [_jsx("span", { children: "Gmail address" }), _jsx("input", { type: "email", value: authEmail, onChange: (event) => setAuthEmail(event.target.value), placeholder: "you@gmail.com", required: true })] }), authMode === 'register' && _jsxs("label", { className: "account-field", children: [_jsx("span", { children: "10-digit mobile number" }), _jsx("input", { value: authPhone, onChange: (event) => setAuthPhone(event.target.value.replace(/\D/g, '').slice(0, 10)), required: true })] }), _jsxs("label", { className: "account-field", children: [_jsx("span", { children: "Password" }), _jsx("input", { type: "password", value: authPassword, onChange: (event) => setAuthPassword(event.target.value), minLength: 8, required: true })] }), _jsxs("button", { className: "account-button", type: "submit", children: [authMode === 'login' ? 'Sign in' : 'Create account', " ", _jsx(ArrowRight, { size: 16 })] })] }), _jsx("button", { className: "text-link auth-switch", type: "button", onClick: () => setAuthMode(authMode === 'login' ? 'register' : 'login'), children: authMode === 'login' ? 'Create a new account' : 'Already have an account? Sign in' })] }) });
        if (pathname === '/orders')
            return _jsxs("section", { className: "account-page page-width", children: [_jsxs("div", { className: "account-heading", children: [_jsx("span", { className: "eyebrow", children: "YOUR THREADLINE" }), _jsx("h1", { children: "Orders" }), _jsx("p", { children: "Track every order from packed to delivered." })] }), orders.length ? _jsx("div", { className: "orders-list", children: orders.map((order) => { const statuses = ['placed', 'packed', 'shipped', 'out_for_delivery', 'delivered']; const current = statuses.indexOf(order.status); return _jsxs("article", { className: "order-card", children: [_jsxs("div", { className: "order-card-head", children: [_jsxs("div", { children: [_jsxs("strong", { children: ["Order ", order._id.slice(-8).toUpperCase()] }), _jsxs("small", { children: [new Date(order.createdAt).toLocaleDateString('en-IN'), " \u00B7 ", order.items.reduce((sum, item) => sum + item.quantity, 0), " items"] })] }), _jsx("b", { children: formatPrice(order.total) })] }), _jsx("div", { className: "order-timeline", children: statuses.map((status, index) => _jsxs("span", { className: index <= current ? 'complete' : '', children: [_jsx("i", {}), status.replaceAll('_', ' ')] }, status)) }), _jsx("div", { className: "order-card-items", children: order.items.map((item, index) => _jsxs("span", { children: [item.name, item.size ? ` (${item.size})` : '', " \u00D7 ", item.quantity] }, `${item.name}-${item.size || ''}-${index}`)) })] }, order._id); }) }) : _jsxs("div", { className: "account-empty large", children: [_jsx(PackageCheck, { size: 30 }), _jsx("h2", { children: "No orders yet" }), _jsx("p", { children: "Your placed orders will appear here." }), _jsxs("button", { className: "account-button", type: "button", onClick: () => navigateTo('/'), children: ["Start shopping ", _jsx(ArrowRight, { size: 16 })] })] })] });
        if (pathname === '/profile')
            return _jsxs("section", { className: "account-page page-width", children: [_jsxs("div", { className: "account-heading", children: [_jsx("span", { className: "eyebrow", children: "YOUR THREADLINE" }), _jsx("h1", { children: "Profile" }), _jsx("p", { children: "Keep your details and shopping preferences close." })] }), _jsxs("div", { className: "account-layout", children: [_jsxs("form", { className: "account-card", onSubmit: async (event) => { event.preventDefault(); const response = await fetch('/api/customer/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ name: profile.name, phone: profile.phone }) }); const result = await response.json().catch(() => ({})); if (!response.ok || !result.profile) {
                                    showNotice(result.message || 'Could not save your profile');
                                    return;
                                } setProfile(result.profile); showNotice('Profile saved'); }, children: [_jsx("h2", { children: "Personal details" }), _jsxs("label", { className: "account-field", children: [_jsx("span", { children: "Full name" }), _jsx("input", { value: profile.name, onChange: (event) => setProfile({ ...profile, name: event.target.value }), placeholder: "Your name", required: true })] }), _jsxs("label", { className: "account-field", children: [_jsx("span", { children: "Email address" }), _jsx("input", { type: "email", value: profile.email, placeholder: "you@gmail.com", readOnly: true })] }), _jsxs("label", { className: "account-field", children: [_jsx("span", { children: "Phone number" }), _jsx("input", { value: profile.phone, onChange: (event) => setProfile({ ...profile, phone: event.target.value.replace(/\\D/g, '').slice(0, 10) }), placeholder: "10-digit mobile number" })] }), _jsxs("button", { className: "account-button", type: "submit", children: ["Save details ", _jsx(Check, { size: 16 })] }), _jsxs("button", { className: "account-button", type: "button", onClick: () => navigateTo('/orders'), children: ["View orders ", _jsx(PackageCheck, { size: 16 })] }), _jsx("button", { className: "detail-wishlist", type: "button", onClick: () => void logoutUser(), children: "Sign out" })] }), _jsxs("div", { className: "account-card account-summary", children: [_jsx("span", { className: "account-icon", children: _jsx(MapPin, { size: 19 }) }), _jsxs("div", { children: [_jsx("h2", { children: "Saved addresses" }), _jsx("p", { children: addresses.length ? `${addresses.length} address${addresses.length === 1 ? '' : 'es'} saved` : 'No addresses saved yet.' })] }), _jsxs("button", { className: "text-link", type: "button", onClick: () => navigateTo('/address'), children: ["Manage addresses ", _jsx(ArrowRight, { size: 15 })] })] })] })] });
        if (pathname === '/address')
            return _jsxs("section", { className: "account-page page-width", children: [_jsxs("button", { className: "back-link", type: "button", onClick: () => navigateTo('/profile'), children: [_jsx(ArrowLeft, { size: 15 }), " Back to profile"] }), _jsxs("div", { className: "account-heading", children: [_jsx("span", { className: "eyebrow", children: "DELIVERY DETAILS" }), _jsx("h1", { children: "Address book" }), _jsx("p", { children: "Save an address for a faster checkout." })] }), _jsxs("div", { className: "account-layout", children: [_jsxs("form", { className: "account-card", onSubmit: (event) => { event.preventDefault(); if (!/^560\d{3}$/.test(addressDraft.pincode.trim())) {
                                    showNotice('Delivery is currently unavailable outside Bangalore');
                                    return;
                                } if (!/^[6-9]\d{9}$/.test(addressDraft.phone.replace(/\D/g, ''))) {
                                    showNotice('Enter a valid 10-digit phone number');
                                    return;
                                } const address = { ...addressDraft, id: `address-${Date.now()}` }; setAddresses((current) => [...current, address]); setSelectedAddressId(address.id); setAddressDraft({ name: '', phone: '', line: '', city: '', state: '', pincode: '', type: 'Home' }); showNotice('Address saved'); }, children: [_jsx("h2", { children: "Add a new address" }), [['name', 'Full name'], ['phone', 'Phone number'], ['line', 'Address'], ['city', 'City'], ['state', 'State'], ['pincode', 'PIN code']].map(([field, label]) => _jsxs("label", { className: "account-field", children: [_jsx("span", { children: label }), _jsx("input", { value: addressDraft[field], onChange: (event) => setAddressDraft({ ...addressDraft, [field]: event.target.value }), required: true })] }, field)), _jsxs("button", { className: "account-button", type: "submit", children: ["Save address ", _jsx(MapPin, { size: 16 })] })] }), _jsx("div", { className: "address-list", children: addresses.length ? addresses.map((address) => _jsxs("article", { className: `address-card ${selectedAddressId === address.id ? 'selected' : ''}`, children: [_jsxs("div", { children: [_jsx("strong", { children: address.name }), _jsxs("span", { children: [address.line, ", ", address.city, ", ", address.state, " - ", address.pincode] }), _jsxs("small", { children: [address.phone, " \u00B7 ", address.type] })] }), _jsx("button", { type: "button", onClick: () => setSelectedAddressId(address.id), children: selectedAddressId === address.id ? _jsxs(_Fragment, { children: [_jsx(Check, { size: 14 }), " Selected"] }) : 'Use this address' })] }, address.id)) : _jsxs("div", { className: "account-empty", children: [_jsx(MapPin, { size: 24 }), _jsx("p", { children: "Your saved addresses will appear here." })] }) })] })] });
        if (pathname === '/wishlist')
            return _jsxs("section", { className: "account-page page-width", children: [_jsxs("div", { className: "account-heading", children: [_jsx("span", { className: "eyebrow", children: "SAVED FOR LATER" }), _jsx("h1", { children: "Wishlist" }), _jsxs("p", { children: [savedProducts.length, " saved piece", savedProducts.length === 1 ? '' : 's'] })] }), savedProducts.length ? _jsx("div", { className: "saved-grid", children: savedProducts.map((product) => _jsxs("article", { className: "saved-card", children: [_jsx("img", { src: product.imageUrl, alt: product.name }), _jsxs("div", { children: [_jsx("h3", { children: product.name }), _jsx("strong", { children: formatPrice(product.sellingPrice ?? product.cost) }), _jsxs("div", { children: [_jsx("button", { type: "button", onClick: () => addToCart(product), children: "Add to bag" }), _jsx("button", { type: "button", "aria-label": `Remove ${product.name} from wishlist`, onClick: () => toggleWishlist(product), children: _jsx(Trash2, { size: 15 }) })] })] })] }, productId(product))) }) : _jsxs("div", { className: "account-empty large", children: [_jsx(Heart, { size: 30 }), _jsx("h2", { children: "Your wishlist is empty" }), _jsx("p", { children: "Save pieces you love and come back to them anytime." }), _jsxs("button", { className: "account-button", type: "button", onClick: () => navigateTo('/'), children: ["Browse the edit ", _jsx(ArrowRight, { size: 16 })] })] })] });
        if (pathname === '/cart')
            return _jsxs("section", { className: "account-page page-width", children: [_jsxs("div", { className: "account-heading", children: [_jsx("span", { className: "eyebrow", children: "YOUR BAG" }), _jsx("h1", { children: "Shopping bag" }), _jsxs("p", { children: [bagCount, " item", bagCount === 1 ? '' : 's', " ready when you are."] })] }), cart.length ? _jsxs("div", { className: "cart-layout", children: [_jsx("div", { className: "cart-items", children: cart.map((item) => _jsxs("article", { className: "cart-item", children: [_jsx("img", { src: item.imageUrl, alt: item.name }), _jsxs("div", { className: "cart-item-copy", children: [_jsx("h3", { children: item.name }), _jsxs("p", { children: [item.category, " / ", item.subcategory, item.size ? ` / Size ${item.size}` : ''] }), _jsx("strong", { children: formatPrice(item.salePrice ?? item.sellingPrice ?? item.cost) }), _jsxs("div", { className: "quantity-control", children: [_jsx("button", { type: "button", onClick: () => updateCartQuantity(cartKey(item), -1), children: _jsx(Minus, { size: 13 }) }), _jsx("span", { children: item.quantity }), _jsx("button", { type: "button", onClick: () => updateCartQuantity(cartKey(item), 1), children: _jsx(Plus, { size: 13 }) })] })] }), _jsx("button", { className: "remove-item", type: "button", onClick: () => removeFromCart(cartKey(item)), "aria-label": `Remove ${item.name}`, children: _jsx(Trash2, { size: 16 }) })] }, cartKey(item))) }), _jsxs("aside", { className: "cart-summary", children: [_jsx("span", { className: "eyebrow", children: "ORDER SUMMARY" }), _jsx("h2", { children: "Almost yours." }), _jsxs("div", { children: [_jsx("span", { children: "Subtotal" }), _jsx("strong", { children: formatPrice(cartTotal) })] }), _jsxs("div", { children: [_jsx("span", { children: "Delivery" }), _jsx("strong", { children: cartTotal >= 1499 ? 'FREE' : '₹99' })] }), _jsx("hr", {}), _jsxs("div", { children: [_jsx("span", { children: "GST (18%)" }), _jsx("strong", { children: formatPrice(gstAmount) })] }), _jsxs("div", { className: "summary-total", children: [_jsx("span", { children: "Total (incl. GST)" }), _jsx("strong", { children: formatPrice(finalTotal) })] }), _jsxs("button", { className: "account-button", type: "button", onClick: () => navigateTo('/checkout'), children: ["Continue to checkout ", _jsx(ArrowRight, { size: 16 })] })] })] }) : _jsxs("div", { className: "account-empty large", children: [_jsx(ShoppingBag, { size: 30 }), _jsx("h2", { children: "Your bag is empty" }), _jsx("p", { children: "Find something that feels like you." }), _jsxs("button", { className: "account-button", type: "button", onClick: () => navigateTo('/'), children: ["Continue shopping ", _jsx(ArrowRight, { size: 16 })] })] })] });
        return _jsxs("section", { className: "account-page page-width", children: [_jsxs("button", { className: "back-link", type: "button", onClick: () => navigateTo('/cart'), children: [_jsx(ArrowLeft, { size: 15 }), " Back to bag"] }), _jsxs("div", { className: "account-heading", children: [_jsx("span", { className: "eyebrow", children: "SECURE CHECKOUT" }), _jsx("h1", { children: "Checkout" }), _jsx("p", { children: "Almost there. Choose where we should deliver your order." })] }), _jsxs("div", { className: "checkout-layout", children: [_jsxs("div", { children: [_jsxs("div", { className: "account-card checkout-block", children: [_jsxs("div", { className: "checkout-title", children: [_jsx("span", { children: _jsx(MapPin, { size: 17 }) }), _jsx("h2", { children: "Delivery address" }), _jsx("button", { className: "text-link", type: "button", onClick: () => navigateTo('/address'), children: "Add address" })] }), addresses.length ? addresses.map((address) => _jsxs("button", { className: `checkout-address ${selectedAddressId === address.id ? 'selected' : ''}`, type: "button", onClick: () => setSelectedAddressId(address.id), children: [_jsx("span", { children: selectedAddressId === address.id ? _jsx(Check, { size: 15 }) : null }), _jsx("strong", { children: address.name }), _jsxs("small", { children: [address.line, ", ", address.city, ", ", address.state, " - ", address.pincode] })] }, address.id)) : _jsx("p", { className: "checkout-empty", children: "Add an address before placing your order." })] }), _jsxs("div", { className: "account-card checkout-block", children: [_jsxs("div", { className: "checkout-title", children: [_jsx("span", { children: _jsx(CreditCard, { size: 17 }) }), _jsx("h2", { children: "Payment method" })] }), _jsxs("div", { className: "payment-option", children: [_jsx("span", { children: "COD" }), _jsxs("div", { children: [_jsx("strong", { children: "Cash on delivery" }), _jsx("small", { children: "Pay when your order arrives" })] }), _jsx(Check, { size: 16 })] })] })] }), _jsxs("aside", { className: "cart-summary", children: [_jsx("span", { className: "eyebrow", children: "YOUR ORDER" }), _jsxs("h2", { children: [bagCount, " item", bagCount === 1 ? '' : 's'] }), cart.map((item) => _jsxs("div", { className: "checkout-line", children: [_jsxs("span", { children: [item.name, item.size ? ` (${item.size})` : '', " \u00D7 ", item.quantity] }), _jsx("strong", { children: formatPrice((item.salePrice ?? item.sellingPrice ?? item.cost) * item.quantity) })] }, cartKey(item))), _jsx("hr", {}), _jsxs("div", { children: [_jsx("span", { children: "Subtotal" }), _jsx("strong", { children: formatPrice(cartTotal) })] }), _jsxs("div", { children: [_jsx("span", { children: "Delivery" }), _jsx("strong", { children: deliveryFee ? formatPrice(deliveryFee) : 'FREE' })] }), _jsxs("div", { children: [_jsx("span", { children: "GST (18%)" }), _jsx("strong", { children: formatPrice(gstAmount) })] }), _jsxs("div", { className: "summary-total", children: [_jsx("span", { children: "Total (incl. GST)" }), _jsx("strong", { children: formatPrice(finalTotal) })] }), _jsxs("button", { className: "account-button", type: "button", disabled: !cart.length || !selectedAddressId, onClick: () => { setCart([]); showNotice('Order placed successfully'); navigateTo('/'); }, children: ["Place order ", _jsx(Check, { size: 16 })] })] })] })] });
    };
    return (_jsxs("div", { className: "storefront", children: [_jsxs("div", { className: "announcement", children: [_jsx(Sparkles, { size: 13 }), " Free delivery on orders over \u20B91,499 ", _jsx("span", { children: "\u2022" }), " 7 day easy returns"] }), _jsxs("header", { className: "site-header", children: [_jsx("button", { className: "mobile-menu", type: "button", onClick: () => setMenuOpen(true), "aria-label": "Open menu", children: _jsx(Menu, { size: 21 }) }), _jsxs("button", { className: "brand brand-button", type: "button", onClick: () => navigateTo('/'), "aria-label": "Threadline home", children: [_jsx("span", { className: "brand-mark", children: "t" }), _jsx("span", { children: "threadline" })] }), _jsxs("nav", { className: `main-nav ${menuOpen ? 'is-open' : ''}`, "aria-label": "Main navigation", children: [_jsx("button", { className: "mobile-close", type: "button", onClick: () => setMenuOpen(false), "aria-label": "Close menu", children: _jsx(X, { size: 20 }) }), navItems.map((item) => _jsxs("button", { type: "button", className: activeMenu === item ? 'nav-active' : '', onMouseEnter: () => setActiveMenu(item), onClick: () => { setMenuOpen(false); if (categoryRoutes[item])
                                    navigateTo(categoryRoutes[item]);
                                else {
                                    setActiveMenu(item);
                                    setActiveSubcategory('');
                                    setActiveCategory('All');
                                } }, children: [item, item === 'Studio' && _jsx("sup", { children: "new" })] }, item))] }), (activeMenu || menuOpen) && _jsx("button", { className: "menu-backdrop", type: "button", "aria-label": "Close category menu", onClick: () => { setActiveMenu(''); setMenuOpen(false); } }), _jsx("div", { className: `mega-menu ${activeMenu && menuGroups.length ? 'is-visible' : ''}`, onMouseLeave: () => setActiveMenu(''), children: _jsx("div", { className: "mega-menu-inner", children: menuGroups.map((group) => _jsxs("section", { className: "mega-group", children: [_jsx("h3", { children: group.title }), group.items.map((item) => _jsx("button", { type: "button", onClick: () => { if (categoryRoutes[activeMenu])
                                            navigateTo(categoryRoutes[activeMenu]); setActiveCategory(activeMenu === 'Women' || activeMenu === 'Men' ? activeMenu : 'All'); setActiveSubcategory(item); setActiveMenu(''); }, children: item }, item))] }, group.title)) }) }), _jsxs("div", { className: "header-actions", children: [_jsxs("label", { className: "search-field", children: [_jsx(Search, { size: 18 }), _jsx("input", { value: searchTerm, onChange: (event) => setSearchTerm(event.target.value), placeholder: "Search products, brands and more", "aria-label": "Search products" })] }), _jsxs("button", { type: "button", className: "header-icon", onClick: () => navigateTo('/profile'), children: [_jsx(UserRound, { size: 20 }), _jsx("span", { children: "Profile" })] }), _jsxs("button", { type: "button", className: "header-icon", onClick: () => navigateTo('/wishlist'), children: [_jsx(Heart, { size: 20, fill: wishlist.length ? 'currentColor' : 'none' }), _jsx("span", { children: "Wishlist" }), wishlist.length > 0 && _jsx("b", { children: wishlist.length })] }), _jsxs("button", { type: "button", className: "header-icon bag-icon", onClick: () => navigateTo('/cart'), children: [_jsx(ShoppingBag, { size: 20 }), _jsx("span", { children: "Bag" }), bagCount > 0 && _jsx("b", { children: bagCount })] })] })] }), accountPage && renderAccountPage(), selectedProduct && !accountPage && _jsxs("section", { className: "product-detail-page page-width", children: [_jsxs("nav", { className: "product-breadcrumbs", "aria-label": "Breadcrumb", children: [_jsx("button", { type: "button", onClick: () => navigateTo('/'), children: "Home" }), _jsx("span", { children: "/" }), _jsx("button", { type: "button", onClick: () => navigateTo(categoryRoutes[selectedProduct.category] || '/'), children: selectedProduct.category }), _jsx("span", { children: "/" }), _jsx("span", { children: selectedProduct.subcategory })] }), _jsxs("div", { className: "product-detail-layout", children: [_jsxs("div", { className: `product-gallery ${productImages.length > 1 ? 'has-thumbnails' : ''}`, children: [productImages.length > 1 && _jsx("div", { className: "product-gallery-thumbnails", "aria-label": "Product images", children: productImages.map((image, index) => _jsx("button", { type: "button", className: selectedImageUrl === image ? 'selected' : '', onClick: () => setSelectedImageUrl(image), "aria-label": `View product image ${index + 1}`, children: _jsx("img", { src: image, alt: "", loading: "lazy" }) }, image)) }), _jsxs("div", { className: "product-gallery-main", children: [_jsx("img", { src: selectedImageUrl || selectedProduct.imageUrl, alt: selectedProduct.name }), selectedProduct.outOfStock ? _jsx("span", { className: "new-badge out-of-stock-badge", children: "Out of stock" }) : null] })] }), _jsxs("section", { className: "product-purchase-panel", "aria-label": "Product purchase details", children: [_jsx("span", { className: "product-brand-name", children: selectedProduct.catalogData?.brand || selectedProduct.seller?.application?.businessName || 'Threadline' }), _jsxs("p", { className: "product-subtitle", children: [selectedProduct.category, " \u00B7 ", selectedProduct.subcategory] }), _jsx("h1", { children: selectedProduct.name }), Number(selectedProduct.ratingAverage) > 0 && _jsxs("div", { className: "product-rating", children: [_jsxs("span", { children: [Number(selectedProduct.ratingAverage).toFixed(1), " ", _jsx(Star, { size: 13, fill: "currentColor" })] }), _jsxs("b", { children: [Number(selectedProduct.reviewCount || 0).toLocaleString('en-IN'), " Ratings"] })] }), _jsxs("div", { className: "product-price-line", children: [_jsx("strong", { children: formatPrice(productPrice) }), originalPrice > productPrice && _jsxs(_Fragment, { children: [_jsx("del", { children: formatPrice(originalPrice) }), discountPercent > 0 && _jsxs("span", { children: ["(", discountPercent, "% OFF)"] })] })] }), _jsx("p", { className: "product-tax-note", children: "Inclusive of all taxes" }), _jsxs("section", { className: "product-size-section", children: [_jsxs("div", { className: "product-subsection-heading", children: [_jsx("h2", { children: "Select size" }), _jsxs("button", { type: "button", onClick: () => showNotice('Size guidance is not available for this product yet'), children: ["Size guide ", _jsx(ArrowRight, { size: 13 })] })] }), _jsx("div", { className: "product-size-options", children: selectedStock.map(([size, stock]) => _jsxs("button", { type: "button", className: selectedSize === size ? 'selected' : '', disabled: stock < 1, onClick: () => setSelectedSize(size), children: [_jsx("strong", { children: size }), _jsx("small", { children: formatPrice(productPrice) })] }, size)) }), selectedSizeStock > 0 && selectedSizeStock < 5 && _jsxs("p", { className: "product-stock-note", children: ["Only ", selectedSizeStock, " left in this size"] })] }), _jsxs("div", { className: "product-purchase-actions", children: [_jsxs("button", { className: "product-add-button", type: "button", disabled: selectedSizeStock < 1, onClick: () => addToCart(selectedProduct, selectedSize), children: [_jsx(ShoppingBag, { size: 17 }), " Add to bag"] }), _jsxs("button", { className: "product-wishlist-button", type: "button", onClick: () => toggleWishlist(selectedProduct), children: [_jsx(Heart, { size: 17, fill: wishlist.includes(productId(selectedProduct)) ? 'currentColor' : 'none' }), " ", wishlist.includes(productId(selectedProduct)) ? 'Wishlisted' : 'Wishlist'] })] }), _jsxs("div", { className: "product-service-notes", children: [_jsxs("span", { children: [_jsx(Truck, { size: 17 }), " ", selectedProduct.catalogData?.shippingInformation || 'Free delivery on qualifying orders'] }), _jsxs("span", { children: [_jsx(RotateCcw, { size: 17 }), " ", selectedProduct.catalogData?.returnPolicy || 'Easy returns'] }), _jsxs("span", { children: [_jsx(ShieldCheck, { size: 17 }), " Secure checkout"] })] }), _jsxs("section", { className: "product-delivery-section", children: [_jsx("h2", { children: "Delivery options" }), _jsxs("form", { className: "product-pincode-form", onSubmit: checkDelivery, children: [_jsx("label", { className: "sr-only", htmlFor: "product-pincode", children: "Enter PIN code" }), _jsx("input", { id: "product-pincode", inputMode: "numeric", autoComplete: "postal-code", maxLength: 6, placeholder: "Enter PIN code", value: deliveryPincode, onChange: (event) => setDeliveryPincode(event.target.value.replace(/\D/g, '').slice(0, 6)) }), _jsx("button", { type: "submit", children: "Check" })] }), _jsx("p", { children: deliveryMessage || 'Enter your PIN code to check delivery timing and payment options.' })] }), _jsxs("section", { className: "product-offer-note", children: [_jsxs("div", { children: [_jsx(Tag, { size: 17 }), _jsx("h2", { children: "Offers & benefits" })] }), _jsx("p", { children: "Free delivery is available on qualifying orders. Final delivery charges are shown at checkout." })] }), _jsxs("div", { className: "product-information", children: [_jsxs("details", { open: true, children: [_jsx("summary", { children: "Product details" }), _jsx("p", { children: selectedProduct.description || selectedProduct.tagline || `${selectedProduct.category} ${selectedProduct.subcategory}.` }), _jsxs("p", { className: "product-code", children: ["Brand: ", selectedProduct.catalogData?.brand || 'Not listed', " \u00B7 SKU: ", selectedProduct.catalogData?.sku || productId(selectedProduct)] }), Boolean(selectedProduct.catalogData?.tags?.length) && _jsx("div", { className: "product-tag-list", children: selectedProduct.catalogData?.tags?.map((tag) => _jsx("span", { children: tag }, tag)) })] }), _jsxs("details", { children: [_jsx("summary", { children: "Specifications" }), _jsxs("dl", { className: "product-spec-list", children: [_jsxs("div", { children: [_jsx("dt", { children: "Category" }), _jsx("dd", { children: selectedProduct.catalogData?.category || selectedProduct.category })] }), _jsxs("div", { children: [_jsx("dt", { children: "Availability" }), _jsx("dd", { children: selectedProduct.catalogData?.availabilityStatus || (selectedSizeStock ? 'In stock' : 'Out of stock') })] }), selectedProduct.catalogData?.weight !== undefined && _jsxs("div", { children: [_jsx("dt", { children: "Weight" }), _jsxs("dd", { children: [selectedProduct.catalogData.weight, " g"] })] }), selectedProduct.catalogData?.dimensions && _jsxs("div", { children: [_jsx("dt", { children: "Dimensions" }), _jsx("dd", { children: ['width', 'height', 'depth'].map((dimension) => selectedProduct.catalogData?.dimensions?.[dimension]).filter((value) => value !== undefined).join(' × ') })] }), selectedProduct.catalogData?.minimumOrderQuantity !== undefined && _jsxs("div", { children: [_jsx("dt", { children: "Minimum order" }), _jsx("dd", { children: selectedProduct.catalogData.minimumOrderQuantity })] }), selectedProduct.catalogData?.meta?.barcode && _jsxs("div", { children: [_jsx("dt", { children: "Barcode" }), _jsx("dd", { children: selectedProduct.catalogData.meta.barcode })] }), selectedProduct.catalogData?.meta?.createdAt && _jsxs("div", { children: [_jsx("dt", { children: "Listed" }), _jsx("dd", { children: new Date(selectedProduct.catalogData.meta.createdAt).toLocaleDateString('en-IN') })] }), selectedProduct.catalogData?.warrantyInformation && _jsxs("div", { children: [_jsx("dt", { children: "Warranty" }), _jsx("dd", { children: selectedProduct.catalogData.warrantyInformation })] })] }), selectedProduct.catalogData?.meta?.qrCode && _jsxs("a", { className: "product-qr-link", href: selectedProduct.catalogData.meta.qrCode, target: "_blank", rel: "noreferrer", children: ["View product QR code ", _jsx(ArrowRight, { size: 13 })] })] }), _jsxs("details", { open: true, children: [_jsxs("summary", { children: ["Customer reviews (", reviewList.length, ")"] }), reviewList.length ? _jsx("div", { className: "product-reviews", children: reviewList.map((review, index) => _jsxs("article", { children: [_jsxs("span", { children: [_jsx(Star, { size: 12, fill: "currentColor" }), " ", review.rating, "/5"] }), _jsx("p", { children: review.comment }), _jsxs("small", { children: [review.customerName || review.reviewerName, (review.createdAt || review.date) ? ` · ${new Date(review.createdAt || review.date || '').toLocaleDateString('en-IN')}` : ''] })] }, `${review.createdAt || review.date}-${index}`)) }) : _jsx("p", { children: "No reviews yet. Be the first to review this product." }), authUser ? _jsxs("form", { className: "product-review-form", onSubmit: submitReview, children: [_jsxs("label", { children: ["Your rating ", _jsx("select", { value: reviewDraft.rating, onChange: (event) => setReviewDraft({ ...reviewDraft, rating: event.target.value }), children: [5, 4, 3, 2, 1].map((value) => _jsxs("option", { value: value, children: [value, " / 5"] }, value)) })] }), _jsx("textarea", { value: reviewDraft.comment, onChange: (event) => setReviewDraft({ ...reviewDraft, comment: event.target.value }), placeholder: "Write your review", minLength: 3, required: true }), _jsx("button", { className: "account-button", type: "submit", children: "Submit review" })] }) : _jsx("p", { children: "Sign in to write a review." })] }), _jsxs("details", { children: [_jsx("summary", { children: "Delivery, returns & seller" }), _jsx("p", { children: selectedProduct.catalogData?.shippingInformation || 'Delivery timing is confirmed at checkout.' }), _jsxs("p", { children: ["Returns: ", selectedProduct.catalogData?.returnPolicy || 'Check return eligibility at checkout.'] }), _jsxs("p", { children: ["Seller: ", selectedProduct.seller?.application?.businessName || 'Threadline marketplace seller'] })] })] })] })] })] }), _jsxs("main", { id: "top", className: accountPage || selectedProduct ? 'content-hidden' : '', children: [!categoryPage && _jsxs("section", { className: "hero", "aria-label": "Seasonal campaign", children: [_jsxs("div", { className: "hero-content", children: [_jsx("span", { className: "hero-kicker", children: "THE NEW SEASON EDIT" }), _jsxs("h1", { children: ["Your style,", _jsx("br", {}), _jsx("i", { children: "your way." })] }), _jsx("p", { children: "New-season fashion, everyday essentials, and the little things that make a look yours." }), _jsxs("button", { className: "hero-button", type: "button", onClick: () => document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth' }), children: ["Shop new arrivals ", _jsx(ArrowRight, { size: 17 })] })] }), _jsxs("div", { className: "hero-note", children: [_jsx("span", { children: "NEW SEASON" }), _jsx("span", { children: "\u00B7" }), _jsx("span", { children: "NEW YOU" })] })] }), !categoryPage && _jsxs("section", { className: "category-section page-width", children: [_jsxs("div", { className: "section-heading", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "A LITTLE SOMETHING FOR EVERYONE" }), _jsx("h2", { children: "Shop by category" })] }), _jsxs("button", { type: "button", className: "text-link", onClick: () => { setActiveCategory('All'); setActiveSubcategory(''); }, children: ["View all ", _jsx(ArrowRight, { size: 15 })] })] }), _jsx("div", { className: "category-grid", children: categories.map((category) => _jsxs("button", { className: `category-card ${category.tone}`, type: "button", onClick: () => { const route = categoryRoutes[category.label]; if (route)
                                        navigateTo(route);
                                    else {
                                        setActiveCategory('All');
                                        setActiveSubcategory('');
                                        document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth' });
                                    } }, children: [_jsx("img", { src: category.image, alt: "" }), _jsx("span", { children: category.label }), _jsxs("small", { children: ["Explore ", _jsx(ArrowRight, { size: 13 })] })] }, category.label)) })] }), categoryPage && pageCopy && _jsxs("section", { className: "category-hero page-width", children: [_jsxs("div", { className: "category-hero-copy", children: [_jsx("span", { className: "eyebrow", children: pageCopy.eyebrow }), _jsx("h1", { children: pageCopy.title }), _jsx("p", { children: pageCopy.description })] }), _jsx("div", { className: "category-hero-image", style: { backgroundImage: `url(${pageCopy.image})` } })] }), _jsxs("section", { className: `discover page-width ${categoryPage ? 'category-discover' : ''}`, id: "discover", children: [_jsxs("div", { className: "section-heading discover-heading", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: categoryPage ? `${categoryPage.toUpperCase()} COLLECTION` : 'JUST LANDED' }), _jsx("h2", { children: categoryPage ? `${categoryPage} picks` : 'New in, now' })] }), _jsxs("div", { className: "filter-actions", children: [_jsx("div", { className: "category-tabs", children: ['All', 'Women', 'Men', 'Accessories'].map((item) => _jsx("button", { type: "button", className: activeCategory === item && !activeSubcategory && !categoryPage ? 'selected' : '', onClick: () => { setActiveCategory(item); setActiveSubcategory(''); if (categoryPage)
                                                        navigateTo('/'); }, children: item }, item)) }), _jsxs("button", { className: "filter-button", type: "button", onClick: () => showNotice('More filters are coming soon'), children: [_jsx(SlidersHorizontal, { size: 15 }), " Filter"] })] })] }), loading && _jsx("p", { className: "loading-copy", children: "Loading all products..." }), !loading && visibleProducts.length === 0 && _jsx("p", { className: "empty-copy", children: "No products match that search yet. Try another category or search." }), _jsx("div", { className: "product-grid", children: visibleProducts.map((product) => {
                                    const id = productId(product);
                                    const saved = wishlist.includes(id);
                                    const listedPrice = product.salePrice ?? product.sellingPrice ?? product.cost;
                                    return _jsxs("article", { className: "product-card", children: [_jsxs("div", { className: "product-image", children: [_jsx("img", { src: product.imageUrl, alt: product.name, loading: "lazy" }), product.salePercent ? _jsxs("span", { className: "new-badge", children: [Math.round(product.salePercent), "% OFF"] }) : null, product.outOfStock ? _jsx("span", { className: "new-badge out-of-stock-badge", children: "Out of stock" }) : null, _jsxs("div", { className: "product-actions", children: [_jsx("button", { type: "button", "aria-label": `View details for ${product.name}`, onClick: () => navigateTo(`/product/${encodeURIComponent(id)}`), children: _jsx(Eye, { size: 17 }) }), _jsx("button", { type: "button", className: saved ? 'saved' : '', "aria-label": `${saved ? 'Remove' : 'Add'} ${product.name} ${saved ? 'from' : 'to'} wishlist`, onClick: () => toggleWishlist(product), children: _jsx(Heart, { size: 17, fill: saved ? 'currentColor' : 'none' }) }), _jsx("button", { type: "button", "aria-label": `Add ${product.name} to cart`, onClick: () => addToCart(product), children: _jsx(ShoppingBag, { size: 17 }) })] })] }), _jsxs("div", { className: "product-meta", children: [_jsxs("div", { children: [_jsx("h3", { children: product.catalogData?.brand || product.name }), _jsx("p", { children: product.catalogData?.brand ? product.name : product.tagline || `${product.category} / ${product.subcategory}` })] }), _jsxs("div", { className: "product-card-pricing", children: [_jsx("strong", { children: formatPrice(listedPrice) }), (product.sellingPrice ?? product.cost) > listedPrice && _jsx("del", { children: formatPrice(product.sellingPrice ?? product.cost) })] })] })] }, id);
                                }) })] }), _jsxs("section", { className: "editorial page-width", children: [_jsx("div", { className: "editorial-image" }), _jsxs("div", { className: "editorial-copy", children: [_jsx("span", { className: "eyebrow", children: "YOUR NEXT FAVOURITE LOOK" }), _jsxs("h2", { children: ["Good finds.", _jsx("br", {}), _jsx("i", { children: "Great outfits." })] }), _jsx("p", { children: "From everyday staples to plans-after-dark pieces, find a little more to love." }), _jsxs("button", { className: "text-link", type: "button", onClick: () => document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth' }), children: ["Explore new arrivals ", _jsx(ArrowRight, { size: 15 })] })] })] })] }), _jsxs("footer", { className: "site-footer page-width", children: [_jsxs("a", { className: "brand", href: "#top", children: [_jsx("span", { className: "brand-mark", children: "t" }), _jsx("span", { children: "threadline" })] }), _jsx("span", { children: "Independent style, thoughtfully gathered." }), _jsx("span", { children: "\u00A9 2026 Threadline" })] }), notice && _jsx("div", { className: "toast", role: "status", children: notice })] }));
}
export default App;
