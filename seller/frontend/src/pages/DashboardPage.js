import { useEffect, useState } from 'react'
import { Boxes, ChevronDown, CircleHelp, LayoutDashboard, LogOut, PackageCheck, RotateCcw, Search, Store } from 'lucide-react'
import * as sellerApi from '../api/seller'
import Wordmark from '../components/Wordmark'
import { useSeller } from '../context/SellerContext'
import { dashboardTabLabels, emptyProduct } from '../utils/constants'
import { returnRequestsOf } from '../utils/orders'
import { normalizeProduct } from '../utils/product'
import AddProductPage from './AddProductPage'
import OrdersPage from './OrdersPage'
import OverviewPage from './OverviewPage'
import ProductsPage from './ProductsPage'
import RestockPage from './RestockPage'
import ReturnsPage from './ReturnsPage'

// The approved seller's workspace: a sidebar of tabs around the current tab's page.
function DashboardPage() {
  const { identity, profile, products, setProducts, orders, setOrders, restockRequests, setRestockRequests, signOut } = useSeller()
  const [dashboardTab, setDashboardTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  // Kept here so a half-written product survives switching tabs.
  const [productDraft, setProductDraft] = useState(emptyProduct)

  // Products and restock requests refresh every 20 seconds, so admin decisions show up.
  useEffect(() => {
    let active = true
    const refreshProducts = async () => {
      try {
        const [sellerProducts, requests] = await Promise.all([sellerApi.fetchProducts(), sellerApi.fetchRestockRequests()])
        if (!active) return
        setProducts(sellerProducts.map(normalizeProduct))
        setRestockRequests(requests)
      } catch {
        return
      }
    }
    void refreshProducts()
    const refreshInterval = window.setInterval(() => void refreshProducts(), 20_000)
    return () => {
      active = false
      window.clearInterval(refreshInterval)
    }
  }, [])

  // Orders are re-fetched on opening the orders or returns tab.
  const ordersTab = dashboardTab === 'orders' || dashboardTab === 'returns'
  useEffect(() => {
    void sellerApi.fetchOrders().then(setOrders).catch(() => undefined)
  }, [ordersTab])

  const approvedProducts = products.filter((product) => product.status === 'approved')
  const openReturns = returnRequestsOf(orders).filter((entry) => entry.request.status === 'requested')
  const openRestocks = restockRequests.filter((entry) => entry.status === 'open')
  const initial = (identity.email || 'S').slice(0, 1).toUpperCase()
  const tabButton = (tab, icon, label, count) => <button className={dashboardTab === tab ? 'active' : ''} type="button" onClick={() => setDashboardTab(tab)}>{icon} {label}{count !== undefined && <> <span className="nav-count">{count}</span></>}</button>

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Wordmark className="wordmark wordmark-light dashboard-brand" />
        <div className="store-switcher"><span className="store-avatar"><Store size={17} /></span><span><strong>{String(profile.businessName || 'Your label')}</strong><small>SELLER ACCOUNT</small></span><ChevronDown size={15} /></div>
        <span className="sidebar-label">WORKSPACE</span>
        <nav className="sidebar-nav" aria-label="Seller dashboard">
          {tabButton('overview', <LayoutDashboard size={17} />, 'Overview')}
          {tabButton('products', <Boxes size={17} />, 'Products', approvedProducts.length)}
          {tabButton('orders', <PackageCheck size={17} />, 'Orders', orders.length)}
          {tabButton('returns', <RotateCcw size={17} />, 'Returns', openReturns.length)}
          {tabButton('restock', <Boxes size={17} />, 'Restock requests', openRestocks.length)}
        </nav>
        <div className="sidebar-bottom"><div className="seller-avatar">{initial}</div><span><strong>{identity.email || 'Seller account'}</strong><small>Approved seller</small></span><button type="button" onClick={signOut} aria-label="Sign out"><LogOut size={16} /></button></div>
      </aside>

      <section className="dashboard-main" id="top">
        <header className="dashboard-topbar"><div className="breadcrumb">SELLER STUDIO <span>/</span> {dashboardTabLabels[dashboardTab]}</div><div className="topbar-actions"><label className="search-box"><Search size={16} /><input aria-label="Search products" placeholder="Search products" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></label><button className="help-icon" type="button" title="Seller support"><CircleHelp size={17} /></button><div className="topbar-initial">{initial}</div></div></header>

        {dashboardTab === 'overview' && <OverviewPage setDashboardTab={setDashboardTab} />}
        {dashboardTab === 'products' && <ProductsPage searchTerm={searchTerm} setDashboardTab={setDashboardTab} />}
        {dashboardTab === 'orders' && <OrdersPage />}
        {dashboardTab === 'returns' && <ReturnsPage />}
        {dashboardTab === 'restock' && <RestockPage />}
        {dashboardTab === 'add-product' && <AddProductPage productDraft={productDraft} setProductDraft={setProductDraft} setDashboardTab={setDashboardTab} />}
      </section>
    </main>
  )
}

export default DashboardPage
