import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CreditCard, RotateCcw, Truck } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import ProductSkeletons from '../components/ProductSkeletons'
import { useStore } from '../context/StoreContext'
import { formatPrice } from '../utils/format'
import { categoryRoutes, departments, heroSlides, tileTones } from '../utils/constants'
import { brandOf, categoryTilesOf, countBy, discountOf, productId } from '../utils/product'

function ProductRow({ title, items, onViewAll }) {
  if (!items.length) return null
  return <section className="home-section page-width">
    <div className="section-head"><h2>{title}</h2><button className="view-all" type="button" onClick={onViewAll}>View all <ChevronRight size={16} /></button></div>
    <div className="product-row">{items.map((product) => <ProductCard product={product} key={productId(product)} />)}</div>
  </section>
}

function HomePage() {
  const { products: catalog, loading, navigateTo, shopWithFilter, setSortBy, shopSettings } = useStore()
  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setHeroIndex((current) => (current + 1) % heroSlides.length), 5000)
    return () => window.clearInterval(timer)
  }, [heroIndex])

  const categoryTiles = categoryTilesOf(catalog)
  const brandTiles = countBy(catalog, brandOf).slice(0, 8).map(([brand]) => {
    const items = catalog.filter((product) => brandOf(product) === brand)
    return { brand, image: items.find((product) => product.imageUrl)?.imageUrl || '', discount: Math.max(0, ...items.map(discountOf)), count: items.length }
  })
  const maxDiscount = Math.max(0, ...catalog.map(discountOf))
  const dealProducts = [...catalog].filter((product) => !product.outOfStock && discountOf(product) > 0).sort((a, b) => discountOf(b) - discountOf(a)).slice(0, 12)
  const trendingProducts = [...catalog].filter((product) => !product.outOfStock && Number(product.ratingAverage) > 0).sort((a, b) => Number(b.ratingAverage || 0) - Number(a.ratingAverage || 0) || Number(b.reviewCount || 0) - Number(a.reviewCount || 0)).slice(0, 12)
  const departmentTiles = departments.map((entry) => ({ ...entry, count: catalog.filter((product) => product.category.toLowerCase() === entry.label.toLowerCase()).length })).filter((entry) => entry.count > 0)
  const slide = heroSlides[heroIndex]

  return <>
    <section className="hero-carousel" aria-label="Featured collections">
      <div className="hero-slide" style={{ '--slide-bg': slide.background, '--slide-accent': slide.accent }} key={heroIndex}>
        <div className="hero-copy">
          <span>{slide.kicker}</span>
          <h2>{slide.title}</h2>
          {maxDiscount > 0 && <strong>Up to {maxDiscount}% off</strong>}
          <button type="button" onClick={() => navigateTo(slide.route)}>Shop now</button>
        </div>
        <div className="hero-image" style={{ backgroundImage: `url(${slide.image})` }} />
      </div>
      <button className="hero-arrow prev" type="button" aria-label="Previous slide" onClick={() => setHeroIndex((heroIndex - 1 + heroSlides.length) % heroSlides.length)}><ChevronLeft size={22} /></button>
      <button className="hero-arrow next" type="button" aria-label="Next slide" onClick={() => setHeroIndex((heroIndex + 1) % heroSlides.length)}><ChevronRight size={22} /></button>
      <div className="hero-dots">{heroSlides.map((entry, index) => <button type="button" className={index === heroIndex ? 'active' : ''} aria-label={`Show slide ${index + 1}`} onClick={() => setHeroIndex(index)} key={entry.kicker} />)}</div>
    </section>

    <div className="offer-strip page-width"><span><Truck size={18} /> <b>Free delivery</b> on orders above {formatPrice(shopSettings.freeDeliveryFrom)}</span><span><RotateCcw size={18} /> <b>{shopSettings.returnWindowDays} day</b> easy returns</span><span><CreditCard size={18} /> <b>Cash on delivery</b> available</span></div>

    <ProductRow title="Deals of the day" items={dealProducts} onViewAll={() => { navigateTo('/shop'); setSortBy('discount') }} />

    {brandTiles.length > 1 && <section className="home-section page-width"><h2>Top brands to bag</h2><div className="brand-grid">{brandTiles.map((tile) => <button className="brand-tile" type="button" key={tile.brand} onClick={() => shopWithFilter('', { brands: [tile.brand] })}><span className="brand-image">{tile.image && <img src={tile.image} alt="" loading="lazy" />}</span><span className="brand-copy"><b>{tile.brand}</b><strong>{tile.discount > 0 ? `Up to ${tile.discount}% off` : `${tile.count} styles`}</strong><small>Shop now</small></span></button>)}</div></section>}

    {categoryTiles.length > 0 && <section className="home-section page-width"><h2>Shop by category</h2><div className="deal-grid">{categoryTiles.map((tile, index) => <button className="deal-tile" type="button" style={{ '--tile-bg': tileTones[index % tileTones.length] }} key={`${tile.category}-${tile.subcategory}`} onClick={() => shopWithFilter(tile.category, { types: [tile.subcategory] })}><span className="deal-image">{tile.image && <img src={tile.image} alt="" loading="lazy" />}</span><span className="deal-copy"><span>{tile.subcategory}</span><strong>{tile.discount > 0 ? `Up to ${tile.discount}% off` : 'Explore'}</strong><small>Shop now</small></span></button>)}</div></section>}

    {departmentTiles.length > 0 && <section className="home-section page-width"><h2>Shop by department</h2><div className="department-grid">{departmentTiles.map((entry) => <button className="department-tile" type="button" key={entry.label} onClick={() => navigateTo(categoryRoutes[entry.label])}><img src={entry.image} alt="" loading="lazy" /><span><b>{entry.label}</b><small>{entry.count} styles · Shop now</small></span></button>)}</div></section>}

    <ProductRow title="Trending now" items={trendingProducts} onViewAll={() => { navigateTo('/shop'); setSortBy('rating') }} />

    {loading && <div className="page-width home-loading"><ProductSkeletons count={5} /></div>}
    {!loading && catalog.length > 0 && <div className="page-width home-cta"><button className="outline-button" type="button" onClick={() => navigateTo('/shop')}>View all {catalog.length} products</button></div>}
  </>
}

export default HomePage
