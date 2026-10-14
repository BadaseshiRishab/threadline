import { useState } from 'react'
import { Boxes, Plus } from 'lucide-react'
import { errorMessage } from '../api/client'
import * as sellerApi from '../api/seller'
import EmptyCatalog from '../components/EmptyCatalog'
import { useSeller } from '../context/SellerContext'
import { without } from '../utils/orders'

// Products admin has asked the seller to restock.
function RestockPage() {
  const { restockRequests, setRestockRequests, setProducts, setBackendNotice } = useSeller()
  const [restockDrafts, setRestockDrafts] = useState({})
  const openRequests = restockRequests.filter((entry) => entry.status === 'open')
  const fulfilledRequests = restockRequests.filter((entry) => entry.status === 'fulfilled')

  // The inputs start at the quantities admin asked for; the seller can change them before adding.
  const restockValue = (entry, size) => restockDrafts[entry._id]?.[size] ?? (entry.requestedStock?.[size] ? String(entry.requestedStock[size]) : '')
  const addRestockStock = async (requestId) => {
    const entry = restockRequests.find((candidate) => candidate._id === requestId)
    const sizes = new Set([...Object.keys(entry?.product.stock ?? {}), ...Object.keys(entry?.requestedStock ?? {})])
    const stock = Object.fromEntries([...sizes].map((size) => [size, Number(entry ? restockValue(entry, size) || 0 : 0)]).filter(([, count]) => Number(count) > 0))
    try {
      const { request: fulfilled, product } = await sellerApi.fulfilRestock(requestId, stock)
      setRestockRequests((current) => current.map((request) => request._id === requestId ? { ...request, status: 'fulfilled', fulfilledAt: fulfilled.fulfilledAt, addedStock: fulfilled.addedStock, product: { ...request.product, stock: product.stock } } : request))
      setProducts((current) => current.map((existing) => existing.id === (product.id ?? product._id) ? { ...existing, stock: product.stock } : existing))
      setRestockDrafts((current) => without(current, requestId))
      setBackendNotice('Stock added. It is now live on the store.')
    } catch (error) {
      setBackendNotice(errorMessage(error, 'Could not add stock.'))
    }
  }

  return <div className="dashboard-page">
    <div className="dashboard-heading"><div><span className="eyebrow">STOCK</span><h1>Restock requests</h1><p>Admin has asked you to restock these products. Add stock per size and it goes live on the store right away.</p></div></div>
    <section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Awaiting your stock</strong><span>{openRequests.length} open requests</span></div></div>
      {openRequests.length ? <div className="restock-list">{openRequests.map((entry) => <article className="restock-card" key={entry._id}>
        <div className="restock-product">{entry.product.imageUrl ? <img src={entry.product.imageUrl} alt="" /> : null}<span><strong>{entry.product.name}</strong><small>Requested {new Date(entry.createdAt).toLocaleDateString('en-IN')}</small>{Object.keys(entry.requestedStock ?? {}).length > 0 && <small className="restock-asked">Admin asked for {Object.entries(entry.requestedStock ?? {}).map(([size, count]) => `${count} × ${size}`).join(', ')}</small>}</span></div>
        <div className="restock-sizes">{Object.entries(entry.product.stock ?? {}).map(([size, count]) => <label className="restock-size" key={size}><span>{size}</span><small className={Number(count) < 1 ? 'is-empty' : ''}>{count} in stock</small><input className="control" type="number" min="0" inputMode="numeric" placeholder="+ add" aria-label={`Add ${size} stock for ${entry.product.name}`} value={restockValue(entry, size)} onChange={(event) => setRestockDrafts((current) => ({ ...current, [entry._id]: { ...(current[entry._id] ?? {}), [size]: event.target.value } }))} /></label>)}</div>
        <button className="button button-primary" type="button" onClick={() => void addRestockStock(entry._id)}><Plus size={16} /> Add stock</button>
      </article>)}</div> : <EmptyCatalog icon={<Boxes size={23} />} title="No restock requests" text="When admin asks you to restock a product, it will appear here." />}
    </section>
    {fulfilledRequests.length > 0 && <section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Recently restocked</strong><span>Stock you added for admin requests</span></div></div><div className="product-table-wrap"><table className="product-table"><thead><tr><th>PRODUCT</th><th>ASKED FOR</th><th>ADDED</th><th>DATE</th></tr></thead><tbody>{fulfilledRequests.map((entry) => <tr key={entry._id}><td>{entry.product.name}</td><td>{Object.entries(entry.requestedStock ?? {}).map(([size, count]) => `${size}: ${count}`).join(', ') || '—'}</td><td>{Object.entries(entry.addedStock ?? {}).map(([size, count]) => `${size}: +${count}`).join(', ')}</td><td>{entry.fulfilledAt ? new Date(entry.fulfilledAt).toLocaleString('en-IN') : ''}</td></tr>)}</tbody></table></div></section>}
  </div>
}

export default RestockPage
