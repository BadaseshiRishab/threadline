import { useStore } from '../context/StoreContext'
import { formatPrice } from '../utils/format'

// The bag's price breakdown, with the page's main action (place order / pay) underneath.
function PriceDetails({ children }) {
  const { bagCount, cartMrp, cartTotal, deliveryFee, gstAmount, finalTotal, shopSettings } = useStore()
  return <aside className="price-panel">
    <h3>Price details ({bagCount} item{bagCount === 1 ? '' : 's'})</h3>
    <div><span>Total MRP</span><span>{formatPrice(cartMrp)}</span></div>
    {cartMrp > cartTotal && <div><span>Discount on MRP</span><span className="positive">−{formatPrice(Number((cartMrp - cartTotal).toFixed(2)))}</span></div>}
    <div><span>Delivery fee</span>{deliveryFee ? <span>{formatPrice(deliveryFee)}</span> : <span className="positive">FREE</span>}</div>
    <div><span>GST ({shopSettings.gstPercent}%)</span><span>{formatPrice(gstAmount)}</span></div>
    <div className="price-total"><span>Total Amount</span><span>{formatPrice(finalTotal)}</span></div>
    {children}
  </aside>
}

export default PriceDetails
