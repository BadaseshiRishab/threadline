import { useEffect, useState } from 'react'
import { ChevronRight, CreditCard, Heart, RotateCcw, Search, ShoppingBag, Star, Tag, Truck } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import ProductCard from '../components/ProductCard'
import { useStore } from '../context/StoreContext'
import { formatPrice } from '../utils/format'
import { brandOf, productId } from '../utils/product'

function ProductPage({ id }) {
  const { products: catalog, loading, navigateTo, shopWithFilter, showNotice, authUser, wishlist, toggleWishlist, addToCart, submitReview, shopSettings, inDeliveryArea } = useStore()
  const product = catalog.find((entry) => productId(entry) === id)
  const [selectedSize, setSelectedSize] = useState('')
  const [deliveryPincode, setDeliveryPincode] = useState('')
  const [deliveryMessage, setDeliveryMessage] = useState('')
  const [reviewDraft, setReviewDraft] = useState({ rating: '5', comment: '' })

  const selectedStock = product ? Object.entries(product.stock || { 'One size': product.stockTotal || 0 }) : []
  useEffect(() => {
    setSelectedSize(selectedStock[0]?.[0] || '')
  }, [product?.id, product?._id])

  if (!product) return <section className="product-detail-page page-width">{loading
    ? <div className="product-detail-layout pdp-loading"><div className="product-gallery"><span /><span /></div><div><i /><i /><i /></div></div>
    : <EmptyState icon={<Search size={42} />} title="Product not found" text="This product may have been removed or is no longer available."><button className="primary-button" type="button" onClick={() => navigateTo('/shop')}>Browse all products</button></EmptyState>}</section>

  const catalogData = product.catalogData
  const brand = brandOf(product)
  const saved = wishlist.includes(productId(product))
  const productImages = [...new Set([...(catalogData?.images || []), product.imageUrl].filter(Boolean))]
  const productPrice = product.salePrice ?? product.sellingPrice ?? product.cost
  const originalPrice = product.sellingPrice ?? product.cost
  const discountPercent = product.salePercent || (originalPrice > productPrice && originalPrice > 0 ? Math.round((originalPrice - productPrice) / originalPrice * 100) : 0)
  const selectedSizeStock = Number(selectedStock.find(([size]) => size === selectedSize)?.[1] || 0)
  const similarProducts = catalog.filter((entry) => entry.subcategory === product.subcategory && productId(entry) !== productId(product)).slice(0, 10)
  const reviewList = Array.isArray(product.reviews) && product.reviews.length ? product.reviews : catalogData?.reviews || []

  const checkDelivery = (event) => {
    event.preventDefault()
    setDeliveryMessage(!/^\d{6}$/.test(deliveryPincode) ? 'Enter a valid 6-digit PIN code.' : inDeliveryArea(deliveryPincode) ? `Delivery is available to this ${shopSettings.deliveryAreaName} PIN code.` : `Delivery is currently unavailable outside ${shopSettings.deliveryAreaName}.`)
  }
  const sendReview = async (event) => {
    event.preventDefault()
    if (await submitReview(product, { rating: Number(reviewDraft.rating), comment: reviewDraft.comment })) setReviewDraft({ rating: '5', comment: '' })
  }

  return <section className="product-detail-page page-width">
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <button type="button" onClick={() => navigateTo('/')}>Home</button><span>/</span>
      <button type="button" onClick={() => shopWithFilter(product.category, {})}>{product.category}</button><span>/</span>
      <button type="button" onClick={() => shopWithFilter(product.category, { types: [product.subcategory] })}>{product.subcategory}</button><span>/</span>
      <b>{brand || product.name}</b>
    </nav>
    <div className="product-detail-layout">
      <div className="product-media">
        <div className={`product-gallery ${productImages.length > 1 ? '' : 'single'}`}>
          {(productImages.length ? productImages : [product.imageUrl]).slice(0, 6).map((image, index) => <div className="product-gallery-image" key={image}><img src={image} alt={index === 0 ? product.name : `${product.name}, view ${index + 1}`} loading={index > 1 ? 'lazy' : undefined} /></div>)}
        </div>
        {catalogData?.photoCredit?.photographer && <p className="photo-credit">Photo by <a href={catalogData.photoCredit.photographerUrl} target="_blank" rel="noreferrer">{catalogData.photoCredit.photographer}</a> on <a href={catalogData.photoCredit.photoUrl} target="_blank" rel="noreferrer">{catalogData.photoCredit.source || 'Unsplash'}</a></p>}
      </div>
      <section className="product-purchase-panel" aria-label="Product purchase details">
        <span className="product-brand-name">{brand || 'Threadline'}</span>
        <h1>{product.name}</h1>
        {Number(product.ratingAverage) > 0 && <div className="product-rating"><span>{Number(product.ratingAverage).toFixed(1)} <Star size={14} fill="currentColor" /></span><b>{Number(product.reviewCount || 0).toLocaleString('en-IN')} Ratings</b></div>}
        <div className="product-price-block">
          <div className="product-price-line"><strong>{formatPrice(productPrice)}</strong>{originalPrice > productPrice && <><span className="mrp">MRP <del>{formatPrice(originalPrice)}</del></span>{discountPercent > 0 && <span className="off">({Math.round(discountPercent)}% OFF)</span>}</>}</div>
          <p className="product-tax-note">inclusive of all taxes</p>
        </div>

        <section className="product-size-section">
          <div className="product-subsection-heading"><h2>Select size</h2><button type="button" onClick={() => showNotice('Size guidance is not available for this product yet')}>Size chart <ChevronRight size={14} /></button></div>
          <div className="product-size-options">{selectedStock.map(([size, stock]) => <button type="button" className={selectedSize === size ? 'selected' : ''} disabled={stock < 1} onClick={() => setSelectedSize(size)} key={size}>{size === 'One size' ? 'Onesize' : size}</button>)}</div>
          {selectedSizeStock > 0 && selectedSizeStock < 5 && <p className="product-stock-note">Only {selectedSizeStock} left!</p>}
        </section>

        <div className="product-purchase-actions">
          <button className="product-add-button" type="button" disabled={selectedSizeStock < 1} onClick={() => addToCart(product, selectedSize)}><ShoppingBag size={19} /> {selectedSizeStock < 1 ? 'Out of stock' : 'Add to bag'}</button>
          <button className={`product-wishlist-button ${saved ? 'saved' : ''}`} type="button" onClick={() => toggleWishlist(product)}><Heart size={19} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Wishlisted' : 'Wishlist'}</button>
        </div>

        <section className="product-delivery-section">
          <h2>Delivery options <Truck size={20} /></h2>
          <form className="product-pincode-form" onSubmit={checkDelivery}><label className="sr-only" htmlFor="product-pincode">Enter PIN code</label><input id="product-pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="Enter pincode" value={deliveryPincode} onChange={(event) => setDeliveryPincode(event.target.value.replace(/\D/g, '').slice(0, 6))} /><button type="submit">Check</button></form>
          <p>{deliveryMessage || 'Please enter PIN code to check delivery time & Pay on Delivery availability'}</p>
          <ul className="product-service-notes">
            <li><Truck size={16} /> {catalogData?.shippingInformation || `Free delivery on orders above ${formatPrice(shopSettings.freeDeliveryFrom)}`}</li>
            <li><CreditCard size={16} /> Pay on delivery is available</li>
            <li><RotateCcw size={16} /> {catalogData?.returnPolicy || `Easy ${shopSettings.returnWindowDays} day returns and exchanges`}</li>
          </ul>
        </section>

        <section className="product-offer-note"><h2>Best offers <Tag size={18} /></h2><p><b>Free delivery</b> on orders above {formatPrice(shopSettings.freeDeliveryFrom)}. Final delivery charges are shown at checkout.</p></section>

        <div className="product-information">
          <details open><summary>Product details</summary><p>{product.description || product.tagline || `${product.category} ${product.subcategory}.`}</p><p className="product-code">Brand: {brand || 'Not listed'} · SKU: {catalogData?.sku || productId(product)}</p>{Boolean(catalogData?.tags?.length) && <div className="product-tag-list">{catalogData.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}</details>
          <details open={Boolean(catalogData?.specifications)}><summary>Specifications</summary><dl className="product-spec-list">
            {Object.entries(catalogData?.specifications || {}).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            <div><dt>Category</dt><dd>{product.category} / {product.subcategory}</dd></div>
            <div><dt>Availability</dt><dd>{catalogData?.availabilityStatus || (selectedSizeStock ? 'In stock' : 'Out of stock')}</dd></div>
            {catalogData?.weight !== undefined && <div><dt>Weight</dt><dd>{catalogData.weight} g</dd></div>}
            {catalogData?.dimensions && <div><dt>Dimensions</dt><dd>{['width', 'height', 'depth'].map((dimension) => catalogData.dimensions[dimension]).filter((value) => value !== undefined).join(' × ')}</dd></div>}
            {catalogData?.minimumOrderQuantity !== undefined && <div><dt>Minimum order</dt><dd>{catalogData.minimumOrderQuantity}</dd></div>}
            {catalogData?.meta?.barcode && <div><dt>Barcode</dt><dd>{catalogData.meta.barcode}</dd></div>}
            {catalogData?.meta?.createdAt && <div><dt>Listed</dt><dd>{new Date(catalogData.meta.createdAt).toLocaleDateString('en-IN')}</dd></div>}
            {catalogData?.warrantyInformation && <div><dt>Warranty</dt><dd>{catalogData.warrantyInformation}</dd></div>}
          </dl>{catalogData?.meta?.qrCode && <a className="product-qr-link" href={catalogData.meta.qrCode} target="_blank" rel="noreferrer">View product QR code <ChevronRight size={13} /></a>}</details>
          <details open><summary>Ratings & reviews ({reviewList.length})</summary>
            {reviewList.length ? <div className="product-reviews">{reviewList.map((review, index) => <article key={`${review.createdAt || review.date}-${index}`}><span className={review.rating < 3 ? 'low' : ''}>{review.rating} <Star size={10} fill="currentColor" /></span><div><p>{review.comment}</p><small>{review.customerName || review.reviewerName}{(review.createdAt || review.date) ? ` | ${new Date(review.createdAt || review.date || '').toLocaleDateString('en-IN')}` : ''}</small></div></article>)}</div> : <p>No reviews yet. Be the first to review this product.</p>}
            {authUser ? <form className="product-review-form" onSubmit={sendReview}><label>Your rating <select value={reviewDraft.rating} onChange={(event) => setReviewDraft({ ...reviewDraft, rating: event.target.value })}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label><textarea value={reviewDraft.comment} onChange={(event) => setReviewDraft({ ...reviewDraft, comment: event.target.value })} placeholder="Write your review" minLength={3} required /><button className="outline-button small" type="submit">Submit review</button></form> : <p>Sign in to write a review.</p>}
          </details>
          <details><summary>Delivery, returns & seller</summary><p>{catalogData?.shippingInformation || 'Delivery timing is confirmed at checkout.'}</p><p>Returns: {catalogData?.returnPolicy || 'Check return eligibility at checkout.'}</p><p>Seller: {product.seller?.application?.businessName || 'Threadline marketplace seller'}</p></details>
        </div>
      </section>
    </div>
    {similarProducts.length > 0 && <section className="similar-products"><h2>Similar products</h2><div className="product-grid">{similarProducts.map((entry) => <ProductCard product={entry} key={productId(entry)} />)}</div></section>}
  </section>
}

export default ProductPage
