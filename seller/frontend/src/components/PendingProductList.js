// Products submitted by the seller that admin has not approved yet.
function PendingProductList({ products }) {
  return <div className="queue-list">{products.map((product) => <div className="queue-item" key={product.id}><span className="queue-image" style={{ backgroundImage: `url(${product.imageUrl})` }} /><span className="queue-product"><strong>{product.name}</strong><small>{product.id} · {product.category} / {product.subcategory}</small></span><span className="status-pill pending-pill">In review</span></div>)}</div>
}

export default PendingProductList
