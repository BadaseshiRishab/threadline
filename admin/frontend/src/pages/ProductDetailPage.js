import { ArrowLeft, ArrowRight, BadgeCheck, Boxes, Check, Clock3, Package } from "lucide-react";
import EmptyState from "../components/EmptyState";
import { useAdmin } from "../context/AdminContext";
import { stockTotal } from "../utils/format";

// One product as customers would see it, opened from approvals or the inventory.
function ProductDetailPage() {
  const { products, selectedProductId, setScreen, productSellerName } = useAdmin();
  const product = products.find((entry) => entry.id === selectedProductId);
  const approved = product?.status === "approved";
  return (
    <div className="admin-page product-detail-page">
      <button className="admin-back-link" type="button" onClick={() => setScreen("inventory")}>
        <ArrowLeft size={15} /> Back to product inventory
      </button>
      {product ? (
        <>
          <div className="admin-page-heading product-detail-heading">
            <div>
              <span className="admin-eyebrow">PRODUCT PAGE&nbsp; / &nbsp;{product.id}</span>
              <h1>{product.name}</h1>
              <p>{product.tagline}</p>
            </div>
            <span className={`admin-status ${approved ? "status-active" : "status-review"}`}>
              {approved ? <><BadgeCheck size={12} /> APPROVED</> : <><Clock3 size={12} /> UNDER REVIEW</>}
            </span>
          </div>
          <div className="product-detail-layout">
            <div className="product-detail-image">
              {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <span><Package size={32} /></span>}
            </div>
            <div className="product-detail-info">
              <span className="admin-eyebrow">
                {product.category}&nbsp; / &nbsp;
                {product.subcategory}
              </span>
              <strong className="product-detail-price">₹{Number(product.cost).toLocaleString("en-IN")}</strong>
              <p className="product-detail-description">{product.description}</p>
              <div className="product-detail-stats">
                <div><span>SELLER</span><strong>{productSellerName(product)}</strong></div>
                <div><span>STATUS</span><strong className={approved ? "detail-approved" : ""}>{approved ? <><Check size={13} /> Live in inventory</> : "Awaiting admin review"}</strong></div>
                <div><span>TOTAL STOCK</span><strong>{stockTotal(product)} units</strong></div>
              </div>
              <div className="product-detail-sizes">
                <span>AVAILABLE STOCK BY SIZE</span>
                <div>
                  {Object.entries(product.stock).map(([size, count]) => (
                    <div key={size}>
                      <strong>{size}</strong>
                      <span>{count} units</span>
                    </div>
                  ))}
                </div>
              </div>
              <button className="admin-outline-button" type="button" onClick={() => setScreen("inventory")}>
                <Boxes size={15} /> Back to inventory
              </button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState icon={<Package size={23} />} title="Product not found">
          <button type="button" onClick={() => setScreen("inventory")}>Return to inventory <ArrowRight size={14} /></button>
        </EmptyState>
      )}
    </div>
  );
}

export default ProductDetailPage;
