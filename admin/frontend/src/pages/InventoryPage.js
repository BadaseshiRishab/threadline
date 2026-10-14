import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Bell, Boxes, Clock3, Package, PackageCheck, TrendingUp } from "lucide-react";
import * as adminApi from "../api/admin";
import { errorMessage } from "../api/client";
import EmptyState from "../components/EmptyState";
import PageHeading from "../components/PageHeading";
import PanelTitle from "../components/PanelTitle";
import StockChips from "../components/StockChips";
import { useAdmin } from "../context/AdminContext";
import { stockSummary, stockTotal, text } from "../utils/format";

// The approved catalogue: low-stock alerts and restock requests to sellers, best sellers, and sale percentages.
function InventoryPage() {
  const { products, approvedProducts, searchTerm, openProduct, setScreen, productSellerName, refreshAdminData, setPageError } = useAdmin();
  const [fastSelling, setFastSelling] = useState([]);
  const [restockRequests, setRestockRequests] = useState([]);
  // The product admin is entering restock quantities for, with the units typed per size.
  const [restockForm, setRestockForm] = useState(null);
  const [saleInput, setSaleInput] = useState({});

  useEffect(() => {
    void adminApi.fetchFastSelling().then(setFastSelling).catch(() => undefined);
    void adminApi.fetchRestockRequests().then(setRestockRequests).catch(() => undefined);
  }, [products]);

  const lowStockProducts = approvedProducts.filter((product) => stockTotal(product) < 5);
  const visibleInventory = approvedProducts.filter((product) => `${product.name} ${product.category} ${product.subcategory} ${product.id}`.toLowerCase().includes(searchTerm.toLowerCase()));
  const openRequestFor = (product) => restockRequests.find((entry) => entry.status === "open" && entry.product?._id === product.id);

  const requestRestock = async (product, quantities) => {
    const stock = Object.fromEntries(Object.entries(quantities).map(([size, count]) => [size, Number(count || 0)]).filter(([, count]) => Number(count) > 0));
    if (!Object.keys(stock).length) { setPageError("Enter how many units to restock for at least one size."); return; }
    try {
      await adminApi.requestRestock(product.id, stock);
      setRestockRequests(await adminApi.fetchRestockRequests());
      setRestockForm(null);
      setPageError("");
    } catch (error) {
      setPageError(errorMessage(error, "Could not send restock request."));
    }
  };
  const cancelRestock = async (id) => {
    try {
      await adminApi.cancelRestock(id);
      setRestockRequests((current) => current.map((entry) => entry._id === id ? { ...entry, status: "cancelled" } : entry));
    } catch (error) {
      setPageError(errorMessage(error, "Could not cancel restock request."));
    }
  };
  const saveSale = async (product) => {
    try {
      await adminApi.setSale(product.id, Number(saleInput[product.id] ?? product.salePercent ?? 0));
      await refreshAdminData();
    } catch (error) {
      setPageError(errorMessage(error, "Could not update sale."));
    }
  };

  // The restock column: an open request, the form to send one, or the button that opens the form.
  const restockAction = (product) => {
    const open = openRequestFor(product);
    if (open) return (
      <span className="restock-status">
        <span className="admin-status status-review"><Clock3 size={12} /> Awaiting seller</span>
        {stockSummary(open.requestedStock) && <small className="restock-asked">Asked for {stockSummary(open.requestedStock)}</small>}
        <button className="restock-link" type="button" onClick={() => void cancelRestock(open._id)}>Cancel</button>
      </span>
    );
    if (restockForm?.productId === product.id) return (
      <form className="restock-form" onSubmit={(event) => { event.preventDefault(); void requestRestock(product, restockForm.quantities); }}>
        <span className="restock-form-sizes">{Object.keys(product.stock ?? {}).map((size) => <label key={size}><span>{size}</span><input type="number" min="0" max="10000" step="1" inputMode="numeric" placeholder="0" aria-label={`Units of size ${size} to restock`} value={restockForm.quantities[size] ?? ""} onChange={(event) => setRestockForm({ productId: product.id, quantities: { ...restockForm.quantities, [size]: event.target.value } })} /></label>)}</span>
        <span className="restock-form-actions"><button className="restock-request-button" type="submit">Send request</button><button className="restock-link" type="button" onClick={() => setRestockForm(null)}>Cancel</button></span>
      </form>
    );
    return <button className="restock-request-button" type="button" onClick={() => { setRestockForm({ productId: product.id, quantities: {} }); setPageError(""); }}>Request restock</button>;
  };

  const productLink = (product, subtitle) => (
    <button className="inventory-product-link" type="button" onClick={() => openProduct(product.id)}>
      {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="inventory-thumb-placeholder"><Package size={17} /></span>}
      <span><strong>{product.name}</strong><small>{subtitle}</small></span>
    </button>
  );

  return (
    <div className="admin-page">
      <PageHeading eyebrow="CATALOG MANAGEMENT" title="Product Inventory" description="Approved products are ready to open as customer-facing product pages.">
        <span className="registry-total"><Boxes size={15} /> {approvedProducts.length} products</span>
      </PageHeading>
      {lowStockProducts.length > 0 && (
        <section className="admin-panel low-stock-panel">
          <PanelTitle eyebrow="LOW STOCK ALERT" title={`${lowStockProducts.length} products below 5 units`}><span className="low-stock-count"><Bell size={15} /> {lowStockProducts.length}</span></PanelTitle>
          <div className="low-stock-list">
            {lowStockProducts.map((product) => (
              <article className="low-stock-row" key={product.id}>
                {productLink(product, productSellerName(product))}
                <div className="low-stock-sizes"><small>{stockTotal(product)} units left</small><StockChips stock={product.stock} /></div>
                <div className="low-stock-action">{restockAction(product)}</div>
              </article>
            ))}
          </div>
        </section>
      )}
      {restockRequests.length > 0 && (
        <section className="admin-panel">
          <PanelTitle eyebrow="SELLER RESTOCKS" title="Restock requests"><PackageCheck size={17} /></PanelTitle>
          <div className="registry-table-wrap"><table className="admin-table"><thead><tr><th>PRODUCT</th><th>SELLER</th><th>STATUS</th><th>ASKED FOR</th><th>STOCK ADDED</th><th>REQUESTED</th></tr></thead><tbody>{restockRequests.slice(0, 10).map((entry) => <tr key={entry._id}>
            <td><strong>{entry.product?.name ?? "Product"}</strong></td>
            <td>{text(entry.seller?.application?.businessName, entry.seller?.email ?? "Seller")}</td>
            <td><span className={`admin-status ${entry.status === "fulfilled" ? "status-active" : entry.status === "open" ? "status-review" : "status-muted"}`}>{entry.status === "open" ? "Awaiting seller" : entry.status === "fulfilled" ? "Restocked" : "Cancelled"}</span></td>
            <td>{stockSummary(entry.requestedStock) || "-"}</td>
            <td>{stockSummary(entry.addedStock, "+") || "-"}</td>
            <td>{new Date(entry.createdAt).toLocaleString("en-IN")}</td>
          </tr>)}</tbody></table></div>
        </section>
      )}
      <section className="admin-panel">
        <PanelTitle eyebrow="SALES PERFORMANCE" title="Fastest-selling products"><TrendingUp size={17} /></PanelTitle>
        {fastSelling.length ? <div className="registry-table-wrap"><table className="admin-table"><thead><tr><th>PRODUCT</th><th>UNITS SOLD</th><th>AVAILABLE BY SIZE</th></tr></thead><tbody>{fastSelling.map((product) => <tr key={product._id}><td><strong>{product.name}</strong></td><td>{product.unitsSold}</td><td><StockChips stock={product.availableStock} /></td></tr>)}</tbody></table></div> : <EmptyState title="No sales yet" text="Fast-selling products appear here once customers place orders." />}
      </section>
      <section className="admin-panel">
        <PanelTitle eyebrow="APPROVED CATALOG" title="Inventory"><span className="admin-status status-active"><BadgeCheck size={12} /> APPROVED</span></PanelTitle>
        {visibleInventory.length ? (
          <div className="registry-table-wrap">
            <table className="admin-table inventory-table">
              <thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>SELLER</th><th>UNIT COST</th><th>STOCK</th><th>RESTOCK</th><th>SALE %</th><th></th></tr></thead>
              <tbody>
                {visibleInventory.map((product) => (
                  <tr key={product.id}>
                    <td>{productLink(product, product.id)}</td>
                    <td>{product.category}<small>{product.subcategory}</small></td>
                    <td>{productSellerName(product)}</td>
                    <td>₹{Number(product.cost).toLocaleString("en-IN")}</td>
                    <td>{stockTotal(product)} units<small>{stockSummary(product.stock)}</small></td>
                    <td>{restockAction(product)}</td>
                    <td>
                      <span className="margin-field">
                        <input type="number" min="0" max="100" aria-label={`Sale percent for ${product.name}`} value={saleInput[product.id] ?? String(product.salePercent ?? 0)} onChange={(event) => setSaleInput((current) => ({ ...current, [product.id]: event.target.value }))} />
                        <button type="button" onClick={() => void saveSale(product)}>Save</button>
                      </span>
                    </td>
                    <td><button className="table-arrow" type="button" aria-label={`Open ${product.name}`} onClick={() => openProduct(product.id)}><ArrowRight size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Boxes size={23} />} title={approvedProducts.length ? "No matching products" : "Inventory is empty"} text={approvedProducts.length ? "Try another product or category search." : "Approved products will move here from Product Approval."}>
            {approvedProducts.length === 0 && <button type="button" onClick={() => setScreen("product-approvals")}>View product approvals <ArrowRight size={14} /></button>}
          </EmptyState>
        )}
      </section>
      <div className="admin-footnote">
        <span><PackageCheck size={14} /> APPROVED ITEMS OPEN AS PRODUCT PAGES.</span>
        <span>INVENTORY&nbsp; / &nbsp;{approvedProducts.length.toString().padStart(2, "0")}</span>
      </div>
    </div>
  );
}

export default InventoryPage;
