import { RotateCcw, ShieldCheck } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import { categoryRoutes } from '../utils/constants'
import { formatPrice } from '../utils/format'
import { categoryTilesOf } from '../utils/product'

function Footer() {
  const { navigateTo, setSearchTerm, products, shopSettings } = useStore()
  const categoryTiles = categoryTilesOf(products)
  return <footer className="site-footer">
    <div className="page-width footer-grid">
      <div><h4>Online shopping</h4><button type="button" onClick={() => navigateTo('/shop')}>All products</button>{Object.entries(categoryRoutes).map(([label, route]) => <button type="button" key={label} onClick={() => navigateTo(route)}>{label}</button>)}</div>
      <div><h4>Your account</h4><button type="button" onClick={() => navigateTo('/account')}>Account</button><button type="button" onClick={() => navigateTo('/orders')}>Track orders</button><button type="button" onClick={() => navigateTo('/wishlist')}>Wishlist</button><button type="button" onClick={() => navigateTo('/cart')}>Bag</button><button type="button" onClick={() => navigateTo('/address')}>Saved addresses</button></div>
      <div><h4>Good to know</h4><p>Free delivery on orders above {formatPrice(shopSettings.freeDeliveryFrom)}</p><p>Cash on delivery available</p><p>We currently deliver within {shopSettings.deliveryAreaName}</p></div>
      <div className="footer-promises"><div><ShieldCheck size={36} /><p><b>Secure checkout</b> for every order</p></div><div><RotateCcw size={36} /><p><b>Return within {shopSettings.returnWindowDays} days</b> of receiving your order</p></div></div>
    </div>
    {categoryTiles.length > 0 && <div className="page-width footer-popular"><h4>Popular searches</h4><p>{categoryTiles.map((tile, index) => <span key={`${tile.category}-${tile.subcategory}`}>{index > 0 && <i>|</i>}<button type="button" onClick={() => { navigateTo('/shop'); setSearchTerm(tile.subcategory) }}>{tile.subcategory}</button></span>)}</p></div>}
    <div className="page-width footer-bottom"><span>© 2026 Threadline. All rights reserved.</span><span>Independent style, thoughtfully gathered.</span></div>
  </footer>
}

export default Footer
