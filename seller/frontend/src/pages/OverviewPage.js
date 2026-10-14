import { useState } from 'react'
import { ArrowRight, BadgeCheck, Boxes, Check, Clock3, PackageCheck, PackagePlus, Plus, ShieldCheck, Sparkles, Wallet } from 'lucide-react'
import BackendNotice from '../components/BackendNotice'
import PendingProductList from '../components/PendingProductList'
import { useSeller } from '../context/SellerContext'
import { totalStock } from '../utils/product'

function OverviewPage({ setDashboardTab }) {
  const { profile, products } = useSeller()
  const [dashboardDate] = useState(() => new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: '2-digit', year: 'numeric' }).format(new Date()).toUpperCase())
  const approvedProducts = products.filter((product) => product.status === 'approved')
  const pendingProducts = products.filter((product) => product.status === 'pending')

  return <div className="dashboard-page">
    <div className="dashboard-heading"><div><span className="eyebrow">{dashboardDate}</span><h1>Good morning, {String(profile.primaryName || 'seller').split(' ')[0]}.</h1><p>Your store is ready for its next good thing.</p></div><button className="button button-primary" type="button" onClick={() => setDashboardTab('add-product')}><Plus size={17} /> Add a product</button></div>
    <div className="welcome-banner"><div className="welcome-copy"><span className="welcome-kicker"><BadgeCheck size={15} /> SELLER ACCOUNT ACTIVE</span><h2>Your label has a new home.</h2><p>Start with your first product and build a storefront that feels like you.</p><button type="button" onClick={() => setDashboardTab('add-product')}>Add your first product <ArrowRight size={15} /></button></div><div className="banner-image" role="img" aria-label="Fashion collection on a clothing rack" /></div>
    <div className="metric-grid">
      <div className="metric-card"><span>LIVE PRODUCTS <Boxes size={17} /></span><strong>{approvedProducts.length.toString().padStart(2, '0')}</strong><small>Approved and on your store</small></div>
      <div className="metric-card"><span>UNDER REVIEW <Clock3 size={17} /></span><strong>{pendingProducts.length.toString().padStart(2, '0')}</strong><small>Awaiting product approval</small></div>
      <div className="metric-card"><span>TOTAL STOCK <PackageCheck size={17} /></span><strong>{approvedProducts.reduce((sum, product) => sum + totalStock(product.stock), 0)}</strong><small>Units across live products</small></div>
      <div className="metric-card metric-accent"><span>SELLER STATUS <ShieldCheck size={17} /></span><strong>Active</strong><small>Your seller profile is approved</small></div>
    </div>

    <div className="dashboard-section-heading"><div><span className="eyebrow">NEXT UP</span><h2>Make your store yours.</h2></div><span className="section-caption">A LITTLE AT A TIME</span></div>
    <div className="action-grid">
      <button className="action-tile" type="button" onClick={() => setDashboardTab('add-product')}><span className="action-icon action-coral"><PackagePlus size={19} /></span><span><strong>Add a product</strong><small>Bring your collection to life</small></span><ArrowRight size={16} /></button>
      <button className="action-tile" type="button" onClick={() => setDashboardTab('products')}><span className="action-icon action-green"><Boxes size={19} /></span><span><strong>Manage products</strong><small>Review your approved catalog</small></span><ArrowRight size={16} /></button>
      <div className="action-tile action-static"><span className="action-icon action-yellow"><Wallet size={19} /></span><span><strong>Bank details added</strong><small>Seller settlements are set up</small></span><Check size={16} /></div>
    </div>

    <BackendNotice />
    {pendingProducts.length > 0 && <section className="review-queue"><div className="dashboard-section-heading"><div><span className="eyebrow">AWAITING ADMIN REVIEW</span><h2>Product submissions</h2></div><span className="review-chip"><Clock3 size={13} /> {pendingProducts.length} awaiting review</span></div><PendingProductList products={pendingProducts} /></section>}
    <div className="dashboard-footnote"><span><Sparkles size={14} /> SMALL LABELS, BIG POINTS OF VIEW.</span><span>SELLER STUDIO&nbsp; · &nbsp;01</span></div>
  </div>
}

export default OverviewPage
