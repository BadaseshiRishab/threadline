import { useEffect, useState } from 'react'
import { ChevronRight, Heart, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import { categoryRoutes, departments, navColors, navItems, priceBuckets } from '../utils/constants'
import { brandOf, countBy, priceOf, productId, productPath } from '../utils/product'

function Header() {
  const { pathname, navigateTo, showNotice, products, searchTerm, setSearchTerm, shopWithFilter, authUser, profile, logoutUser, wishlist, bagCount } = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  const closeMenus = () => {
    setActiveMenu('')
    setMenuOpen(false)
    setSearchFocused(false)
  }
  useEffect(closeMenus, [pathname])
  const goTo = (path) => { closeMenus(); navigateTo(path) }
  const shopFor = (category, patch) => { closeMenus(); shopWithFilter(category, patch) }

  const categoryPage = Object.entries(categoryRoutes).find(([, path]) => path === pathname)?.[0] || ''

  // The mega menu for the department under the pointer.
  const menuProducts = activeMenu ? products.filter((product) => product.category.toLowerCase() === activeMenu.toLowerCase()) : []
  const menuGroups = [
    { title: 'Shop by category', kind: 'types', items: countBy(menuProducts, (product) => product.subcategory).map(([name]) => ({ value: name, label: name })) },
    { title: 'Top brands', kind: 'brands', items: countBy(menuProducts, brandOf).slice(0, 12).map(([name]) => ({ value: name, label: name })) },
    { title: 'Shop by price', kind: 'prices', items: priceBuckets.filter((bucket) => menuProducts.some((product) => priceOf(product) >= bucket.min && priceOf(product) < bucket.max)).map((bucket) => ({ value: bucket.id, label: bucket.label })) },
  ].filter((group) => group.items.length)
  const menuDepartment = departments.find((entry) => entry.label === activeMenu)

  // Search suggestions: matching categories, brands and products.
  const query = searchTerm.trim().toLowerCase()
  const suggestions = query ? [
    ...countBy(products, (product) => `${product.category}::${product.subcategory}`).filter(([key]) => key.split('::')[1].toLowerCase().includes(query)).slice(0, 4).map(([key, count]) => { const [category, subcategory] = key.split('::'); return { key: `type-${key}`, label: subcategory, hint: `in ${category} · ${count}`, run: () => { setSearchTerm(''); shopFor(category, { types: [subcategory] }) } } }),
    ...countBy(products, brandOf).filter(([brand]) => brand.toLowerCase().includes(query)).slice(0, 4).map(([brand, count]) => ({ key: `brand-${brand}`, label: brand, hint: `Brand · ${count}`, run: () => { setSearchTerm(''); shopFor('', { brands: [brand] }) } })),
    ...products.filter((product) => product.name.toLowerCase().includes(query)).slice(0, 4).map((product) => ({ key: `product-${productId(product)}`, label: product.name, hint: brandOf(product) || product.subcategory, run: () => goTo(productPath(product)) })),
  ].slice(0, 9) : []
  const highlightMatch = (text) => {
    const index = text.toLowerCase().indexOf(query)
    return index < 0 ? text : <>{text.slice(0, index)}<b>{text.slice(index, index + query.length)}</b>{text.slice(index + query.length)}</>
  }

  return <header className="site-header">
    <button className="mobile-menu" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
    <button className="brand" type="button" onClick={() => goTo('/')} aria-label="Threadline home"><span className="brand-mark">t</span><span className="brand-word">threadline</span></button>
    <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
      <div className="mobile-nav-head"><span>Shop by category</span><button className="mobile-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={20} /></button></div>
      {navItems.map((item) => <button key={item} type="button" style={{ '--nav-color': navColors[item] }} className={activeMenu === item || categoryPage === item ? 'nav-active' : ''} onMouseEnter={() => setActiveMenu(item)} onClick={() => { if (categoryRoutes[item]) goTo(categoryRoutes[item]); else { setMenuOpen(false); showNotice(`${item} is coming soon`) } }}>{item}{item === 'Studio' && <sup>New</sup>}</button>)}
    </nav>
    {menuOpen && <button className="menu-backdrop" type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
    <div className={`mega-menu ${activeMenu && menuGroups.length ? 'is-visible' : ''}`} style={{ '--nav-color': navColors[activeMenu] || '#ff3f6c' }} onMouseLeave={() => setActiveMenu('')}>
      <div className="mega-menu-inner">
        {menuGroups.map((group) => <section className="mega-group" key={group.title}><h3>{group.title}</h3>{group.items.map((item) => <button type="button" key={item.value} onClick={() => shopFor(activeMenu, { [group.kind]: [item.value] })}>{item.label}</button>)}</section>)}
        {menuDepartment && <section className="mega-feature"><button type="button" onClick={() => shopFor(activeMenu, {})}><img src={menuDepartment.image} alt="" /><span>Shop all {activeMenu}</span><small>{menuProducts.length} styles <ChevronRight size={13} /></small></button></section>}
      </div>
    </div>
    <form className="search-field" role="search" onSubmit={(event) => { event.preventDefault(); goTo('/shop') }}>
      <Search size={17} />
      <input value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setSearchFocused(true) }} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} onKeyDown={(event) => { if (event.key === 'Escape') { setSearchFocused(false); event.currentTarget.blur() } }} placeholder="Search for products, brands and more" aria-label="Search products" aria-autocomplete="list" aria-expanded={searchFocused && suggestions.length > 0} aria-controls="search-suggestions" />
      {searchTerm && <button type="button" aria-label="Clear search" onMouseDown={(event) => event.preventDefault()} onClick={() => setSearchTerm('')}><X size={15} /></button>}
      {searchFocused && suggestions.length > 0 && <ul className="search-suggestions" id="search-suggestions" role="listbox">{suggestions.map((suggestion) => <li key={suggestion.key} role="option" aria-selected="false"><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={suggestion.run}><span>{highlightMatch(suggestion.label)}</span><small>{suggestion.hint}</small></button></li>)}<li className="search-all"><button type="submit" onMouseDown={(event) => event.preventDefault()}><Search size={14} /> See all results for "{searchTerm.trim()}"</button></li></ul>}
    </form>
    <div className="header-actions" onMouseEnter={() => setActiveMenu('')}>
      <div className="profile-menu">
        <button type="button" className="header-icon" onClick={() => goTo(authUser ? '/account' : '/login')}><UserRound size={20} /><span>Profile</span></button>
        <div className="profile-dropdown">
          {authUser ? <div className="profile-dropdown-head"><strong>Hello {profile.name || authUser.profile?.name || 'there'}</strong><span>{profile.phone || authUser.email}</span></div> : <div className="profile-dropdown-head"><strong>Welcome</strong><span>To access account and manage orders</span><button className="outline-button small" type="button" onClick={() => goTo('/login')}>Login / Signup</button></div>}
          {authUser && <button type="button" onClick={() => goTo('/account')}>Overview</button>}
          <button type="button" onClick={() => goTo('/orders')}>Orders</button>
          <button type="button" onClick={() => goTo('/wishlist')}>Wishlist</button>
          <button type="button" onClick={() => goTo('/cart')}>Bag</button>
          <button type="button" onClick={() => goTo('/address')}>Saved Addresses</button>
          {authUser && <><button type="button" onClick={() => goTo('/profile')}>Edit Profile</button><button type="button" onClick={() => void logoutUser()}>Logout</button></>}
        </div>
      </div>
      <button type="button" className="header-icon" onClick={() => goTo('/wishlist')}><Heart size={20} /><span>Wishlist</span>{wishlist.length > 0 && <b>{wishlist.length > 9 ? '9+' : wishlist.length}</b>}</button>
      <button type="button" className="header-icon" onClick={() => goTo('/cart')}><ShoppingBag size={20} /><span>Bag</span>{bagCount > 0 && <b>{bagCount > 9 ? '9+' : bagCount}</b>}</button>
    </div>
  </header>
}

export default Header
