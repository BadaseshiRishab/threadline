import AddressModal from './components/AddressModal'
import CheckoutFooter from './components/CheckoutFooter'
import CheckoutHeader from './components/CheckoutHeader'
import Footer from './components/Footer'
import Header from './components/Header'
import PaymentSuccess from './components/PaymentSuccess'
import ReturnModal from './components/ReturnModal'
import SizePickerModal from './components/SizePickerModal'
import UpiPaymentModal from './components/UpiPaymentModal'
import { useStore } from './context/StoreContext'
import AccountPage from './pages/AccountPage'
import AddressesPage from './pages/AddressesPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import HomePage from './pages/HomePage'
import ListingPage from './pages/ListingPage'
import LoginPage from './pages/LoginPage'
import OrdersPage from './pages/OrdersPage'
import PhonePeReturnPage from './pages/PhonePeReturnPage'
import ProductPage from './pages/ProductPage'
import ProfilePage from './pages/ProfilePage'
import WishlistPage from './pages/WishlistPage'
import { categoryRoutes } from './utils/constants'

const pages = {
  '/login': LoginPage,
  '/account': AccountPage,
  '/orders': OrdersPage,
  '/profile': ProfilePage,
  '/address': AddressesPage,
  '/wishlist': WishlistPage,
  '/cart': CartPage,
  '/checkout': CheckoutPage,
  '/payment/phonepe': PhonePeReturnPage,
}

function CurrentPage() {
  const { pathname } = useStore()
  const Page = pages[pathname]
  if (Page) return <Page />
  if (pathname.startsWith('/product/')) {
    const id = decodeURIComponent(pathname.replace('/product/', ''))
    return <ProductPage id={id} key={id} />
  }
  // Department pages (/men, /women, …) and /shop list products; any other path shows the home page.
  const categoryPage = Object.entries(categoryRoutes).find(([, path]) => path === pathname)?.[0] || ''
  return <main id="top">{categoryPage || pathname === '/shop' ? <ListingPage categoryPage={categoryPage} /> : <HomePage />}</main>
}

function App() {
  const { pathname, notice, addressModal, sizePicker, returnModal, upiPayment, paymentSuccess } = useStore()
  const checkoutFlow = pathname === '/cart' || pathname === '/checkout'
  return (
    <div className={`storefront ${checkoutFlow ? 'in-checkout' : ''}`}>
      {checkoutFlow ? <CheckoutHeader /> : <Header />}
      <CurrentPage />
      {checkoutFlow ? <CheckoutFooter /> : <Footer />}
      {addressModal && <AddressModal />}
      {sizePicker && <SizePickerModal />}
      {returnModal && <ReturnModal />}
      {upiPayment && <UpiPaymentModal />}
      {paymentSuccess && <PaymentSuccess />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}

export default App
