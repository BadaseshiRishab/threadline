import { Heart, ShoppingBag, Star } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import { formatCount, formatPrice } from '../utils/format'
import { brandOf, discountOf, mrpOf, priceOf, productId, productPath } from '../utils/product'

function ProductCard({ product }) {
  const { wishlist, navigateTo, toggleWishlist, addToCart } = useStore()
  const saved = wishlist.includes(productId(product))
  const brand = brandOf(product)
  const price = priceOf(product)
  const mrp = mrpOf(product)
  const discount = discountOf(product)
  const sizes = Object.entries(product.stock || {}).filter(([, count]) => Number(count) > 0).map(([size]) => size)
  const href = productPath(product)
  return <article className="product-card">
    <a className="product-card-link" href={href} onClick={(event) => { event.preventDefault(); navigateTo(href) }}>
      <div className="product-image">
        <img src={product.imageUrl} alt={product.name} loading="lazy" />
        {Number(product.ratingAverage) > 0 && <span className="rating-pill">{Number(product.ratingAverage).toFixed(1)} <Star size={11} fill="currentColor" />{Number(product.reviewCount) > 0 && <><i>|</i>{formatCount(Number(product.reviewCount))}</>}</span>}
        {product.outOfStock && <span className="stock-pill">OUT OF STOCK</span>}
        {discount > 0 && !product.outOfStock && <span className="new-pill1">SALE</span>}
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

export default ProductCard
