import { Heart, X } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { useStore } from '../context/StoreContext'
import { formatPrice } from '../utils/format'
import { discountOf, mrpOf, priceOf, productId, productPath } from '../utils/product'

function WishlistPage() {
  const { products, wishlist, navigateTo, toggleWishlist, startMoveToBag } = useStore()
  const savedProducts = products.filter((product) => wishlist.includes(productId(product)))
  return <section className="wishlist-page page-width">
    <h1 className="page-title">My Wishlist <span>{savedProducts.length} item{savedProducts.length === 1 ? '' : 's'}</span></h1>
    {savedProducts.length ? <div className="wishlist-grid">{savedProducts.map((product) => {
      const price = priceOf(product)
      const mrp = mrpOf(product)
      const href = productPath(product)
      return <article className="wishlist-card" key={productId(product)}>
        <a href={href} onClick={(event) => { event.preventDefault(); navigateTo(href) }}><img src={product.imageUrl} alt={product.name} loading="lazy" /><div><h3>{product.name}</h3><p><strong>{formatPrice(price)}</strong>{mrp > price && <><del>{formatPrice(mrp)}</del><span>({discountOf(product)}% OFF)</span></>}</p></div></a>
        <button className="wishlist-remove" type="button" aria-label={`Remove ${product.name} from wishlist`} onClick={() => toggleWishlist(product)}><X size={14} /></button>
        <button className="wishlist-move" type="button" onClick={() => startMoveToBag(product)}>Move to bag</button>
      </article>
    })}</div> : <EmptyState icon={<Heart size={46} />} title="Your wishlist is empty" text="Add items that you like to your wishlist. Review them anytime and easily move them to the bag."><button className="outline-button" type="button" onClick={() => navigateTo('/')}>Continue shopping</button></EmptyState>}
  </section>
}

export default WishlistPage
