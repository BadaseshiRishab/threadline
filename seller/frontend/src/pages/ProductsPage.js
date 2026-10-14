import { Check, Clock3, Plus, ShoppingBag } from 'lucide-react'
import EmptyCatalog from '../components/EmptyCatalog'
import PendingProductList from '../components/PendingProductList'
import { useSeller } from '../context/SellerContext'
import { totalStock } from '../utils/product'

function ProductsPage({ searchTerm, setDashboardTab }) {
  const { products } = useSeller()
  const approvedProducts = products.filter((product) => product.status === 'approved')
  const pendingProducts = products.filter((product) => product.status === 'pending')
  const matchingProducts = approvedProducts.filter((product) => `${product.name} ${product.category} ${product.subcategory}`.toLowerCase().includes(searchTerm.toLowerCase()))

  return <div className="dashboard-page">
    <div className="dashboard-heading"><div><span className="eyebrow">YOUR CATALOG</span><h1>Products</h1><p>Only approved products are live in your seller store.</p></div><button className="button button-primary" type="button" onClick={() => setDashboardTab('add-product')}><Plus size={17} /> Add product</button></div>
    <section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Live products</strong><span>{approvedProducts.length} approved</span></div><span className="catalog-filter"><span className="filter-dot" /> APPROVED</span></div>
      {matchingProducts.length > 0 ? <div className="product-table-wrap"><table className="product-table"><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>SELLER PRICE</th><th>STOCK</th><th>STATUS</th></tr></thead><tbody>{matchingProducts.map((product) => <tr key={product.id}><td><div className="product-cell"><img src={product.imageUrl} alt="" /><span><strong>{product.name}</strong><small>{product.id}</small></span></div></td><td>{product.category}<small className="table-subtext">{product.subcategory}</small></td><td>₹{(product.sellingPrice ?? product.cost).toLocaleString('en-IN')}</td><td>{totalStock(product.stock)} units</td><td><span className="status-pill approved-pill"><Check size={12} /> Live</span></td></tr>)}</tbody></table></div>
        : <EmptyCatalog icon={<ShoppingBag size={23} />} title={approvedProducts.length ? 'No matching products' : 'Your first product belongs here.'} text={approvedProducts.length ? 'Try a different search.' : 'Submit a product for review. Once approved, it will appear in this catalog.'}>{!approvedProducts.length && <button className="button button-primary" type="button" onClick={() => setDashboardTab('add-product')}><Plus size={16} /> Add a product</button>}</EmptyCatalog>}
    </section>
    {pendingProducts.length > 0 && <section className="catalog-panel pending-catalog"><div className="catalog-toolbar"><div><strong>Awaiting approval</strong><span>Not yet visible in your live catalog</span></div><Clock3 size={17} /></div><PendingProductList products={pendingProducts} /></section>}
  </div>
}

export default ProductsPage
