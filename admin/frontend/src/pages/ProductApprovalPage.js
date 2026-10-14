import { useEffect, useState } from "react";
import { ArrowRight, Check, Clock3, FileCheck2, Package, X } from "lucide-react";
import * as adminApi from "../api/admin";
import { errorMessage } from "../api/client";
import EmptyState from "../components/EmptyState";
import PageHeading from "../components/PageHeading";
import PanelTitle from "../components/PanelTitle";
import { useAdmin } from "../context/AdminContext";
import { stockTotal } from "../utils/format";

// Seller submissions waiting for admin; approving sets the margin added to the seller's price.
function ProductApprovalPage() {
  const { pendingProducts, openProduct, setScreen, refreshAdminData, setPageError } = useAdmin();
  const [marginByProduct, setMarginByProduct] = useState({});
  // Pre-filled margin: DEFAULT_MARGIN_PERCENT in admin/backend/.env (5 until it loads).
  const [defaultMargin, setDefaultMargin] = useState(5);
  useEffect(() => {
    adminApi.fetchSettings().then((result) => { if (Number.isFinite(result?.defaultMarginPercent)) setDefaultMargin(result.defaultMarginPercent); }).catch(() => {});
  }, []);

  const reviewProduct = async (id, status) => {
    try {
      await adminApi.decideProduct(id, status, Number(marginByProduct[id] ?? defaultMargin));
      await refreshAdminData();
    } catch (error) {
      setPageError(errorMessage(error, "Could not update product status."));
    }
  };

  return (
    <div className="admin-page">
      <PageHeading eyebrow="CATALOG MANAGEMENT" title="Product Approval" description="Review seller submissions before they enter the product inventory.">
        <span className="registry-total"><Clock3 size={15} /> {pendingProducts.length} awaiting review</span>
      </PageHeading>
      <section className="admin-panel">
        <PanelTitle eyebrow="SUBMISSION QUEUE" title="Products for review"><span className="admin-queue-count">{pendingProducts.length.toString().padStart(2, "0")} PENDING</span></PanelTitle>
        {pendingProducts.length ? (
          <div className="approval-list">
            {pendingProducts.map((product) => (
              <article className="approval-card" key={product.id}>
                <button className="approval-image-button" type="button" onClick={() => openProduct(product.id)} title="View product details">
                  {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span><Package size={22} /></span>}
                </button>
                <div className="approval-product-copy">
                  <span className="admin-eyebrow">
                    {product.id}&nbsp; / &nbsp;{product.category} ·{" "}
                    {product.subcategory}
                  </span>
                  <h3>{product.name}</h3>
                  <p>{product.tagline}</p>
                  <span className="approval-price">
                    ₹{Number(product.cost).toLocaleString("en-IN")}{" "}
                    <i>·</i> actual seller price · {stockTotal(product)} units
                  </span>
                </div>
                <div className="approval-actions">
                  <label className="margin-field">
                    <span>ADMIN MARGIN (%)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={marginByProduct[product.id] ?? String(defaultMargin)}
                      onChange={(event) => setMarginByProduct((current) => ({ ...current, [product.id]: event.target.value }))}
                      aria-label={`Admin margin for ${product.name}`}
                    />
                  </label>
                  <button className="admin-outline-button" type="button" onClick={() => openProduct(product.id)}>Review details</button>
                  <button className="admin-success-button" type="button" onClick={() => reviewProduct(product.id, "approved")}><Check size={14} /> Approve</button>
                  <button className="admin-decline-button" type="button" onClick={() => reviewProduct(product.id, "rejected")}><X size={14} /> Decline</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={<FileCheck2 size={23} />} title="No products waiting for approval" text="New seller submissions will appear in this queue.">
            <button type="button" onClick={() => setScreen("inventory")}>View product inventory <ArrowRight size={14} /></button>
          </EmptyState>
        )}
      </section>
    </div>
  );
}

export default ProductApprovalPage;
