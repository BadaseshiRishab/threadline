import { Check, ShieldCheck, X } from "lucide-react";
import { sellerSignatureUrl } from "../api/admin";
import { text } from "../utils/format";

// Everything a seller entered in their application, with the approve and reject buttons.
function SellerApplication({ seller, onClose, onDecide }) {
  const profile = seller.application ?? {};
  const contactName = text(profile.primaryName, text(profile.ownerName, "Seller contact"));
  const detail = (label, value, className) => <div className={className}><span>{label}</span><strong>{value}</strong></div>;
  return (
    <div className="seller-review-details">
      <div className="seller-detail-heading">
        <div>
          <span className="admin-eyebrow">APPLICATION DETAILS</span>
          <h3>{text(profile.businessName, "New seller")}</h3>
        </div>
        <button className="admin-icon-button" type="button" aria-label="Close application details" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div className="seller-detail-grid">
        {detail("GSTIN", text(profile.gstin))}
        {detail("BUSINESS NAME", text(profile.businessName, "New seller"))}
        {detail("PRIMARY CONTACT", text(profile.primaryName, contactName))}
        {detail("CONTACT EMAIL", text(profile.primaryEmail, seller.email ?? ""))}
        {detail("CONTACT PHONE", text(profile.primaryPhone, seller.phone ?? ""))}
        {detail("BUSINESS OWNER", profile.sameOwner ? "Same as primary contact" : text(profile.ownerName))}
        {profile.sameOwner !== true && <>
          {detail("OWNER EMAIL", text(profile.ownerEmail))}
          {detail("OWNER PHONE", text(profile.ownerPhone))}
        </>}
        {detail("SELLER ADDRESS", `${text(profile.sellerAddress)}, ${text(profile.sellerCity)}, ${text(profile.sellerState)} ${text(profile.sellerPincode)}`, "detail-wide")}
        {detail("WAREHOUSE ADDRESS", profile.sameWarehouse ? "Same as seller address" : `${text(profile.warehouseAddress)}, ${text(profile.warehouseCity)}, ${text(profile.warehouseState)} ${text(profile.warehousePincode)}`, "detail-wide")}
        <div>
          <span>BUSINESS SIGNATURE</span>
          {profile.signature ? <a href={sellerSignatureUrl(seller._id)} target="_blank" rel="noreferrer">View signature</a> : <strong>Not uploaded</strong>}
        </div>
        {detail("SELLING THROUGH", profile.sellingMode === "independent" ? text(profile.websiteUrl) : text(profile.marketplaceName))}
        {detail("BANK", `${text(profile.bankName)} · ${text(profile.accountType)}`)}
        {detail("IFSC", text(profile.ifsc))}
        {detail("BANK ACCOUNT", `•••• ${text(profile.accountNumberLast4)}`)}
        {detail("ACCOUNT HOLDER", text(profile.accountHolder))}
        {profile.sellingMode === "marketplace" && detail("MARKETPLACE RATING", text(profile.marketplaceRating))}
      </div>
      <div className="review-decision">
        <span>
          <ShieldCheck size={15} /> Verify documents before
          approval.
        </span>
        <button className="admin-success-button" type="button" onClick={() => void onDecide("approved")}>
          <Check size={15} /> Approve seller
        </button>
        <button className="admin-decline-button" type="button" onClick={() => void onDecide("rejected")}><X size={14} /> Reject</button>
      </div>
    </div>
  );
}

export default SellerApplication;
