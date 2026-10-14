import { useEffect, useState } from "react";
import { ArrowRight, Boxes, Building2, Check, ChevronRight, ClipboardCheck, FileCheck2, Package, PackageCheck, ShieldCheck, Users } from "lucide-react";
import { useAdmin } from "../context/AdminContext";
import { SELLER_PORTAL_URL } from "../utils/constants";
import { text } from "../utils/format";

function OverviewPage() {
  const { overview, pendingSellers, pendingProducts, setScreen, openRegistry, setActiveRegistrySellerId, setShowRequestDetails } = useAdmin();
  // Ticks every minute so the greeting and date roll over while the dashboard stays open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(clock);
  }, []);
  const adminDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", month: "long", day: "2-digit", year: "numeric" }).format(now).toUpperCase();
  const hour = now.getHours();
  const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : "Good evening";
  const metric = (label, icon, value, caption) => (
    <div>
      <span>{label} {icon}</span>
      <strong>{value.toString().padStart(2, "0")}</strong>
      <small>{caption}</small>
    </div>
  );
  const shortcut = (icon, title, caption, onClick) => (
    <button className="shortcut-row" type="button" onClick={onClick}>
      <span>{icon}</span>
      <strong>{title}</strong>
      <small>{caption}</small>
      <ArrowRight size={15} />
    </button>
  );

  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">
            {adminDate}&nbsp; / &nbsp;ADMIN WORKSPACE
          </span>
          <h1>{greeting}, Admin.</h1>
          <p>Here’s what needs your attention today.</p>
        </div>
        <span className="admin-session-pill">
          <ShieldCheck size={14} /> SECURE ADMIN SESSION
        </span>
      </div>
      <div className="admin-metrics">
        {metric("SELLER REQUESTS", <ClipboardCheck size={16} />, overview.sellerRequests, "Waiting for review")}
        {metric("APPROVED SELLERS", <Users size={16} />, overview.approvedSellers, "Active on Threadline")}
        {metric("PRODUCT APPROVALS", <FileCheck2 size={16} />, overview.productRequests, "Waiting for review")}
        {metric("PRODUCT INVENTORY", <Boxes size={16} />, overview.productInventory, "Approved and ready")}
      </div>
      <div className="admin-work-grid">
        <section className="admin-panel">
          <div className="admin-panel-title">
            <div>
              <span className="admin-eyebrow">REVIEW QUEUE</span>
              <h2>Needs your attention</h2>
            </div>
            <span className="admin-queue-count">
              {pendingSellers.length + pendingProducts.length} OPEN
            </span>
          </div>
          {pendingSellers.map((seller) => (
            <button
              className="attention-row"
              type="button"
              key={seller._id}
              onClick={() => {
                openRegistry("requests");
                setActiveRegistrySellerId(seller._id);
                setShowRequestDetails(true);
              }}
            >
              <span className="attention-icon seller-request-icon">
                <Building2 size={18} />
              </span>
              <span>
                <strong>{text(seller.application.businessName, "New seller")}</strong>
                <small>Seller registration · {seller.email}</small>
              </span>
              <span className="admin-status status-review">NEW SELLER</span>
              <ChevronRight size={16} />
            </button>
          ))}
          {pendingProducts.map((product) => (
            <button className="attention-row" type="button" key={product.id} onClick={() => setScreen("product-approvals")}>
              <span className="attention-icon product-request-icon">
                <Package size={18} />
              </span>
              <span>
                <strong>{product.name}</strong>
                <small>Product submission · {product.id}</small>
              </span>
              <span className="admin-status status-review">PRODUCT</span>
              <ChevronRight size={16} />
            </button>
          ))}
          {pendingSellers.length === 0 && pendingProducts.length === 0 && (
            <div className="admin-empty-queue">
              <span>
                <Check size={17} />
              </span>
              <div>
                <strong>All caught up.</strong>
                <small>New seller and product requests will appear here.</small>
              </div>
            </div>
          )}
        </section>
        <section className="admin-panel">
          <div className="admin-panel-title">
            <div>
              <span className="admin-eyebrow">QUICK ACCESS</span>
              <h2>Manage your marketplace</h2>
            </div>
          </div>
          {shortcut(<ClipboardCheck size={17} />, "Seller registry", "Applications & seller accounts", () => openRegistry("requests"))}
          {shortcut(<PackageCheck size={17} />, "Product approval", "Review new catalog entries", () => setScreen("product-approvals"))}
          {shortcut(<Boxes size={17} />, "Product inventory", "Browse the approved catalog", () => setScreen("inventory"))}
        </section>
      </div>
      <div className="admin-footnote">
        <span>
          <ShieldCheck size={14} /> ADMIN ACTIONS ARE RECORDED IN THIS
          SERVER DATABASE.
        </span>
        <a href={SELLER_PORTAL_URL}>
          Open seller studio <ArrowRight size={13} />
        </a>
      </div>
    </div>
  );
}

export default OverviewPage;
