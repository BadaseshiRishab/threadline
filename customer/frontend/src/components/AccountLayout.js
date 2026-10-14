import { useStore } from '../context/StoreContext'

// The account pages' title and side navigation around the page content.
function AccountLayout({ children }) {
  const { pathname, navigateTo, profile, authUser, logoutUser } = useStore()
  return <section className="account-page page-width">
    <div className="account-title"><h1>Account</h1><p>{profile.name || authUser?.email || ''}</p></div>
    <div className="account-shell">
      <nav className="account-nav" aria-label="Account">
        <button type="button" className={pathname === '/account' ? 'active' : ''} onClick={() => navigateTo('/account')}>Overview</button>
        <small>Orders</small>
        <button type="button" className={pathname === '/orders' ? 'active' : ''} onClick={() => navigateTo('/orders')}>Orders & Returns</button>
        <small>Account</small>
        <button type="button" className={pathname === '/profile' ? 'active' : ''} onClick={() => navigateTo('/profile')}>Profile</button>
        <button type="button" className={pathname === '/address' ? 'active' : ''} onClick={() => navigateTo('/address')}>Saved Addresses</button>
        <button type="button" onClick={() => navigateTo('/wishlist')}>Wishlist</button>
        <button type="button" onClick={() => navigateTo('/cart')}>Bag</button>
        <small />
        <button type="button" onClick={() => void logoutUser()}>Logout</button>
      </nav>
      <div className="account-content">{children}</div>
    </div>
  </section>
}

export default AccountLayout
