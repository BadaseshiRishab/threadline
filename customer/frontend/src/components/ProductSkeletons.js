// Placeholder cards shown while the catalogue loads.
function ProductSkeletons({ count }) {
  return <div className="product-grid">{Array.from({ length: count }, (_, index) => <div className="product-skeleton" key={index}><span /><i /><i /></div>)}</div>
}

export default ProductSkeletons
