import { ArrowRight, BadgeCheck, ClipboardCheck, Clock3, Star, Store, TrendingUp, Users } from "lucide-react";
import * as adminApi from "../api/admin";
import { errorMessage } from "../api/client";
import EmptyState from "../components/EmptyState";
import PageHeading from "../components/PageHeading";
import PanelTitle from "../components/PanelTitle";
import SellerApplication from "../components/SellerApplication";
import { useAdmin } from "../context/AdminContext";
import { SELLER_PORTAL_URL } from "../utils/constants";
import { plural, rupees, text } from "../utils/format";

function RequestsTab() {
  const { sellers, pendingSellers, approvedSellers, activeRegistrySellerId, setActiveRegistrySellerId, showRequestDetails, setShowRequestDetails, refreshAdminData, setPageError } = useAdmin();
  const selectedSeller = sellers.find((seller) => seller._id === activeRegistrySellerId) ?? pendingSellers[0] ?? approvedSellers[0];

  const decideSeller = async (status) => {
    try {
      await adminApi.decideSeller(selectedSeller._id, status);
      setShowRequestDetails(false);
      await refreshAdminData();
    } catch (error) {
      setPageError(errorMessage(error, "Could not update seller status."));
    }
  };

  return (
    <section className="admin-panel">
      <PanelTitle eyebrow="SELLER APPLICATIONS" title="Requests to join"><span className="admin-queue-count">{pendingSellers.length} REQUESTS</span></PanelTitle>
      {pendingSellers.length > 0 ? (
        <>
          <div className="registry-table-wrap">
            <table className="admin-table">
              <thead><tr><th>BUSINESS</th><th>PRIMARY CONTACT</th><th>GSTIN</th><th>SUBMITTED</th><th>STATUS</th><th></th></tr></thead>
              <tbody>
                {pendingSellers.map((seller) => (
                  <tr key={seller._id}>
                    <td><strong>{text(seller.application.businessName, "New seller")}</strong><small>{seller.email}</small></td>
                    <td>{text(seller.application.primaryName, "Seller contact")}<small>{text(seller.application.primaryPhone, seller.phone)}</small></td>
                    <td>{text(seller.application.gstin)}</td>
                    <td>{seller.createdAt ? new Date(seller.createdAt).toLocaleDateString() : "—"}</td>
                    <td><span className="admin-status status-review"><Clock3 size={12} /> Under review</span></td>
                    <td><button className="admin-outline-button" type="button" onClick={() => { setActiveRegistrySellerId(seller._id); setShowRequestDetails(true); }}>Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showRequestDetails && selectedSeller?.sellerStatus === "pending" && <SellerApplication seller={selectedSeller} onClose={() => setShowRequestDetails(false)} onDecide={decideSeller} />}
        </>
      ) : (
        <EmptyState icon={<ClipboardCheck size={23} />} title="No seller requests" text="New seller applications will appear here when submitted from Seller Studio.">
          <a href={SELLER_PORTAL_URL}>Open seller studio <ArrowRight size={14} /></a>
        </EmptyState>
      )}
    </section>
  );
}

function ApprovedTab() {
  const { approvedSellers, approvedProducts, setRegistryTab } = useAdmin();
  return (
    <section className="admin-panel">
      <PanelTitle eyebrow="VERIFIED ACCOUNTS" title="Approved sellers"><span className="admin-queue-count">{approvedSellers.length} ACTIVE</span></PanelTitle>
      {approvedSellers.length > 0 ? (
        <div className="registry-table-wrap">
          <table className="admin-table">
            <thead><tr><th>SELLER</th><th>CONTACT</th><th>BUSINESS TYPE</th><th>LIVE PRODUCTS</th><th>STATUS</th></tr></thead>
            <tbody>
              {approvedSellers.map((seller) => <tr key={seller._id}>
                <td><strong>{text(seller.application.businessName, "New seller")}</strong><small>{text(seller.application.gstin)}</small></td>
                <td>{text(seller.application.primaryName, "Seller contact")}<small>{seller.email}</small></td>
                <td>{seller.application.sellingMode === "independent" ? "Independent" : text(seller.application.marketplaceName, "Marketplace seller")}</td>
                <td>{approvedProducts.filter((product) => typeof product.seller === "object" && product.seller?._id === seller._id).length}</td>
                <td><span className="admin-status status-active"><BadgeCheck size={12} /> Approved</span></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={<Users size={23} />} title="No approved sellers yet" text="Approve a seller request to add their account to the registry.">
          <button type="button" onClick={() => setRegistryTab("requests")}>View requests <ArrowRight size={14} /></button>
        </EmptyState>
      )}
    </section>
  );
}

function TopSellersTab() {
  const { topSellers } = useAdmin();
  return (
    <section className="admin-panel">
      <PanelTitle eyebrow="SELLER PERFORMANCE" title="Top sellers"><span className="admin-queue-count">RANKED LIST</span></PanelTitle>
      {topSellers.length > 0 ? (
        <>
          <div className="registry-table-wrap">
            <table className="admin-table">
              <thead><tr><th>RANK</th><th>SELLER</th><th>SALES</th><th>CUSTOMER RATING</th><th>LIVE PRODUCTS</th><th>SCORE</th></tr></thead>
              <tbody>
                {topSellers.map((seller, index) => {
                  const metrics = seller.metrics;
                  return <tr key={seller._id}>
                    <td><span className={`seller-rank${index < 3 ? ` is-top-${index + 1}` : ""}`}>{String(index + 1).padStart(2, "0")}</span></td>
                    <td><strong>{text(seller.application.businessName, "New seller")}</strong><small>{seller.email}</small></td>
                    <td><strong>{rupees(metrics?.revenue ?? 0)}</strong><small>{metrics?.unitsSold ?? 0} units · {metrics?.orderCount ?? 0} {plural(metrics?.orderCount, "order")}</small></td>
                    <td>{metrics?.reviewCount ? <><strong className="seller-rating"><Star size={13} /> {metrics.averageRating.toFixed(1)}</strong><small>{metrics.reviewCount.toLocaleString("en-IN")} {plural(metrics.reviewCount, "review")}</small></> : <small>No reviews yet</small>}</td>
                    <td>{seller.approvedProductCount ?? 0}</td>
                    <td><span className="seller-score"><span style={{ width: `${metrics?.score ?? 0}%` }} /></span><small>{metrics?.score ?? 0} / 100</small></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <p className="admin-table-note">
            Score = 60% sales (revenue compared with the best-selling seller, from orders that are not cancelled or unpaid, minus accepted returns) + 40% customer rating. The rating is weighted towards the store average until a seller has several reviews, so a single 5-star review cannot outrank many good ones.
          </p>
        </>
      ) : (
        <EmptyState icon={<TrendingUp size={23} />} title="Top sellers will show here" text="Approved seller activity will populate this ranking." />
      )}
    </section>
  );
}

// Seller applications, approved sellers and the top-seller ranking.
function SellerRegistryPage() {
  const { sellers, pendingSellers, approvedSellers, registryTab, setRegistryTab } = useAdmin();
  const tab = (id, label, count) => (
    <button className={registryTab === id ? "active" : ""} type="button" role="tab" aria-selected={registryTab === id} onClick={() => setRegistryTab(id)}>
      {label}{count > 0 && <span>{count}</span>}
    </button>
  );
  return (
    <div className="admin-page">
      <PageHeading eyebrow="SELLER MANAGEMENT" title="Seller Registry" description="Review applications and keep track of approved sellers.">
        <span className="registry-total"><Store size={15} /> {sellers.length} seller accounts</span>
      </PageHeading>
      <div className="admin-tabs" role="tablist" aria-label="Seller registry sections">
        {tab("requests", "Requests", pendingSellers.length)}
        {tab("approved", "Approved Sellers", approvedSellers.length)}
        {tab("top", "Top Sellers", 0)}
      </div>
      {registryTab === "requests" && <RequestsTab />}
      {registryTab === "approved" && <ApprovedTab />}
      {registryTab === "top" && <TopSellersTab />}
    </div>
  );
}

export default SellerRegistryPage;
