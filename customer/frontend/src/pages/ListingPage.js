import { useEffect, useState } from 'react'
import { ArrowUpDown, Search, SlidersHorizontal, X } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import ProductCard from '../components/ProductCard'
import ProductSkeletons from '../components/ProductSkeletons'
import { useStore } from '../context/StoreContext'
import { discountSteps, emptyFilters, priceBuckets, sortOptions } from '../utils/constants'
import { brandOf, countBy, discountOf, priceOf, productId } from '../utils/product'

// A department page (/men, /women, …) or every product (/shop), with search, filters and sorting.
function ListingPage({ categoryPage }) {
  const { pathname, navigateTo, products: catalog, loading, filters, setFilters, toggleFilter, sortBy, setSortBy, searchTerm, setSearchTerm } = useStore()
  const [filtersOpen, setFiltersOpen] = useState(false)
  useEffect(() => setFiltersOpen(false), [pathname])

  const searchMatches = (product) => `${product.name} ${brandOf(product)} ${(product.catalogData?.tags || []).join(' ')} ${product.tagline || ''} ${product.category} ${product.subcategory}`.toLowerCase().includes(searchTerm.toLowerCase())
  const pageProducts = catalog.filter((product) => (!categoryPage || product.category.toLowerCase() === categoryPage.toLowerCase()) && searchMatches(product))
  const inCategories = (product) => !filters.categories.length || filters.categories.includes(product.category)
  const inPriceRange = (product) => !filters.prices.length || filters.prices.some((id) => {
    const bucket = priceBuckets.find((entry) => entry.id === id)
    return Boolean(bucket) && priceOf(product) >= bucket.min && priceOf(product) < bucket.max
  })
  const visibleProducts = pageProducts
    .filter((product) => inCategories(product)
      && (!filters.types.length || filters.types.includes(product.subcategory))
      && (!filters.brands.length || filters.brands.includes(brandOf(product)))
      && inPriceRange(product)
      && discountOf(product) >= filters.discount)
    .sort((a, b) => {
      if (sortBy === 'popularity') return Number(b.reviewCount || 0) - Number(a.reviewCount || 0)
      if (sortBy === 'discount') return discountOf(b) - discountOf(a)
      if (sortBy === 'price-desc') return priceOf(b) - priceOf(a)
      if (sortBy === 'price-asc') return priceOf(a) - priceOf(b)
      if (sortBy === 'rating') return Number(b.ratingAverage || 0) - Number(a.ratingAverage || 0)
      return 0
    })
  const categoryFacets = countBy(pageProducts, (product) => product.category)
  const typeFacets = countBy(pageProducts.filter(inCategories), (product) => product.subcategory)
  const brandFacets = countBy(pageProducts, brandOf)
  const priceFacets = priceBuckets.map((bucket) => ({ ...bucket, count: pageProducts.filter((product) => priceOf(product) >= bucket.min && priceOf(product) < bucket.max).length })).filter((bucket) => bucket.count)
  const discountFacets = discountSteps.filter((step) => pageProducts.some((product) => discountOf(product) >= step))
  const appliedFilters = [
    ...['categories', 'types', 'brands'].flatMap((key) => filters[key].map((value) => ({ key, value, label: value }))),
    ...filters.prices.map((value) => ({ key: 'prices', value, label: priceBuckets.find((bucket) => bucket.id === value)?.label || value })),
  ]
  const appliedCount = appliedFilters.length + (filters.discount ? 1 : 0)

  const renderFilterOptions = (key, entries, labelFor) => <div className="filter-scroll">{entries.map(([value, count]) => <label className="filter-option" key={value}><input type="checkbox" checked={filters[key].includes(value)} onChange={() => toggleFilter(key, value)} /><span>{labelFor ? labelFor(value) : value}</span><small>({count})</small></label>)}</div>

  return <section className="listing page-width" id="discover">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><button type="button" onClick={() => navigateTo('/')}>Home</button><span>/</span><b>{categoryPage || (searchTerm ? 'Search' : 'Shop')}</b></nav>
    <div className="listing-title"><h1>{categoryPage ? `${categoryPage} Collection` : searchTerm ? `Results for "${searchTerm}"` : 'All Products'}</h1>{!loading && <span>- {visibleProducts.length} item{visibleProducts.length === 1 ? '' : 's'}</span>}</div>
    <div className="listing-layout">
      {filtersOpen && <button className="filter-backdrop" type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)} />}
      <aside className={`filter-panel ${filtersOpen ? 'is-open' : ''}`} aria-label="Filters">
        <div className="filter-panel-head"><strong>Filters</strong>{(appliedFilters.length > 0 || filters.discount > 0) && <button type="button" onClick={() => setFilters(emptyFilters)}>Clear all</button>}<button className="filter-close" type="button" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={18} /></button></div>
        {!categoryPage && categoryFacets.length > 1 && <section className="filter-section"><h3>Categories</h3>{renderFilterOptions('categories', categoryFacets)}</section>}
        {typeFacets.length > 0 && <section className="filter-section"><h3>{categoryPage ? 'Categories' : 'Type'}</h3>{renderFilterOptions('types', typeFacets)}</section>}
        {brandFacets.length > 0 && <section className="filter-section"><h3>Brand</h3>{renderFilterOptions('brands', brandFacets)}</section>}
        {priceFacets.length > 0 && <section className="filter-section"><h3>Price</h3>{renderFilterOptions('prices', priceFacets.map((bucket) => [bucket.id, bucket.count]), (id) => priceBuckets.find((bucket) => bucket.id === id)?.label || id)}</section>}
        {discountFacets.length > 0 && <section className="filter-section"><h3>Discount range</h3>{discountFacets.map((step) => <label className="filter-option" key={step}><input type="radio" name="discount" checked={filters.discount === step} onChange={() => setFilters({ ...filters, discount: step })} /><span>{step}% and above</span></label>)}</section>}
        <button className="primary-button filter-apply" type="button" onClick={() => setFiltersOpen(false)}>Show {visibleProducts.length} products</button>
      </aside>
      <div className="listing-main">
        <div className="listing-toolbar">
          <div className="applied-filters">{appliedFilters.map((filter) => <button type="button" key={`${filter.key}-${filter.value}`} onClick={() => toggleFilter(filter.key, filter.value)}>{filter.label} <X size={12} /></button>)}{filters.discount > 0 && <button type="button" onClick={() => setFilters({ ...filters, discount: 0 })}>{filters.discount}% and above <X size={12} /></button>}</div>
          <label className="sort-select"><span>Sort by :</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>{sortOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
        </div>
        {loading && <ProductSkeletons count={10} />}
        {!loading && visibleProducts.length === 0 && <EmptyState icon={<Search size={42} />} title="We couldn't find any matches" text="Try a different search, or clear some filters."><button className="outline-button" type="button" onClick={() => { setFilters(emptyFilters); setSearchTerm('') }}>Clear search & filters</button></EmptyState>}
        {!loading && visibleProducts.length > 0 && <div className="product-grid">{visibleProducts.map((product) => <ProductCard product={product} key={productId(product)} />)}</div>}
      </div>
    </div>
    <div className="mobile-listing-bar">
      <label><ArrowUpDown size={16} /> Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort products">{sortOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>
      <button type="button" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16} /> Filter{appliedCount > 0 && <b>{appliedCount}</b>}</button>
    </div>
  </section>
}

export default ListingPage
