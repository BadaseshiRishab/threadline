import { ChevronRight, Heart, Minus, Plus, RotateCcw, ShoppingBag, Tag, X } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import PriceDetails from '../components/PriceDetails'
import { useStore } from '../context/StoreContext'
import { formatPrice } from '../utils/format'
import { brandOf, discountOf, mrpOf } from '../utils/product'

function CartItem({ item }) {
  const { cartKey, updateCartQuantity, removeFromCart, shopSettings } = useStore()
  const price = item.salePrice ?? item.sellingPrice ?? item.cost
  const mrp = mrpOf(item)
  const brand = brandOf(item)
  return <article className="bag-item">
    <img src={item.imageUrl} alt={item.name} />
    <div className="bag-item-copy">
      <h3>{brand || item.name}</h3>
      <p>{brand ? item.name : `${item.category} / ${item.subcategory}`}</p>
      {item.seller?.application?.businessName && <small>Sold by: {item.seller.application.businessName}</small>}
      <div className="bag-item-controls">
        {item.size && <span className="bag-chip">Size: {item.size}</span>}
        <div className="quantity-control"><button type="button" aria-label="Decrease quantity" onClick={() => updateCartQuantity(cartKey(item), -1)}><Minus size={13} /></button><span>Qty: {item.quantity}</span><button type="button" aria-label="Increase quantity" onClick={() => updateCartQuantity(cartKey(item), 1)}><Plus size={13} /></button></div>
      </div>
      <p className="bag-price"><strong>{formatPrice(price)}</strong>{mrp > price && <><del>{formatPrice(mrp)}</del><span>{discountOf(item)}% OFF</span></>}</p>
      <p className="bag-note"><RotateCcw size={13} /> {shopSettings.returnWindowDays} day easy returns{item.reservedUntil && <> · Reserved until {new Date(item.reservedUntil).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</>}</p>
    </div>
    <button className="bag-remove" type="button" onClick={() => removeFromCart(cartKey(item))} aria-label={`Remove ${item.name}`}><X size={18} /></button>
  </article>
}

function CartPage() {
  const { cart, cartKey, bagCount, cartTotal, addresses, selectedAddressId, navigateTo, shopSettings } = useStore()
  const address = addresses.find((entry) => entry.id === selectedAddressId)
  return <section className="bag-page page-width">
    {cart.length ? <div className="bag-layout">
      <div className="bag-items">
        {address
          ? <div className="bag-strip"><span>Deliver to: <b>{address.name}, {address.pincode}</b><small>{address.line}, {address.city}</small></span><button type="button" onClick={() => navigateTo('/address')}>Change address</button></div>
          : <div className="bag-strip"><span>Check delivery time & services</span><button type="button" onClick={() => navigateTo('/address')}>Enter PIN code</button></div>}
        <div className="bag-offer"><Tag size={16} /><span>{cartTotal >= shopSettings.freeDeliveryFrom ? 'Yay! You get FREE delivery on this order.' : `Add items worth ${formatPrice(Number((shopSettings.freeDeliveryFrom - cartTotal).toFixed(2)))} more for FREE delivery.`}</span></div>
        <h2 className="bag-count">{bagCount} item{bagCount === 1 ? '' : 's'} in your bag</h2>
        {cart.map((item) => <CartItem item={item} key={cartKey(item)} />)}
        <button className="bag-wishlist-link" type="button" onClick={() => navigateTo('/wishlist')}><Heart size={16} /> Add more from wishlist <ChevronRight size={16} /></button>
      </div>
      <PriceDetails><button className="primary-button" type="button" onClick={() => navigateTo('/checkout')}>Place order</button></PriceDetails>
    </div> : <EmptyState icon={<ShoppingBag size={46} />} title="Hey, it feels so light!" text="There is nothing in your bag. Let's add some items."><button className="outline-button" type="button" onClick={() => navigateTo('/wishlist')}>Add items from wishlist</button><button className="text-button" type="button" onClick={() => navigateTo('/')}>Continue shopping</button></EmptyState>}
  </section>
}

export default CartPage
