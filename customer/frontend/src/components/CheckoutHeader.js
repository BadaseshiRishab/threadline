import { ShieldCheck } from 'lucide-react'
import { useStore } from '../context/StoreContext'

// The slimmer header shown in the bag and checkout, with the Bag › Address › Payment steps.
function CheckoutHeader() {
  const { pathname, navigateTo } = useStore()
  return <header className="site-header checkout-header">
    <button className="brand" type="button" onClick={() => navigateTo('/')} aria-label="Threadline home"><span className="brand-mark">t</span></button>
    <ol className="checkout-steps">
      <li className={pathname === '/cart' ? 'current' : 'done'}>Bag</li>
      <li className={pathname === '/checkout' ? 'current' : ''}>Address</li>
      <li className={pathname === '/checkout' ? 'current' : ''}>Payment</li>
    </ol>
    <span className="secure-badge"><ShieldCheck size={20} /> 100% Secure</span>
  </header>
}

export default CheckoutHeader
