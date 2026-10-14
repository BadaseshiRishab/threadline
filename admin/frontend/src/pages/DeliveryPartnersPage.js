import { useState } from "react";
import { Check, ClipboardCheck, PackageCheck, Truck } from "lucide-react";
import * as adminApi from "../api/admin";
import { errorMessage } from "../api/client";
import EmptyState from "../components/EmptyState";
import PanelTitle from "../components/PanelTitle";
import PartnerSelect from "../components/PartnerSelect";
import { useAdmin } from "../context/AdminContext";
import { DELIVERY_APP_URL, emptyPartnerDraft, orderStatusLabels, paymentMethodLabels, vehicleTypes } from "../utils/constants";
import { orderNumber, rupees } from "../utils/format";
import { assignable, canAssignPartner } from "../utils/orders";

// Links open the licence / RC scan in a new tab; the admin session cookie authorises the request.
function PartnerDocuments({ partner }) {
  const kinds = [["licence", "Licence"], ["rc", "RC"]].filter(([kind]) => partner.documents?.[kind]);
  return kinds.length ? kinds.map(([kind, label], index) => <span key={kind}>{index > 0 && " · "}<a className="admin-inline-link" href={adminApi.partnerDocumentUrl(partner._id, kind)} target="_blank" rel="noreferrer">{label}</a></span>) : "Not uploaded";
}

function ApplicationCard({ partner, rejecting, setRejecting, reviewApplication }) {
  return <article className="application-card">
    <div className="application-main">
      <strong>{partner.name}</strong>
      <small>Applied {new Date(partner.appliedAt).toLocaleString("en-IN")}</small>
      <dl>
        <div><dt>Mobile</dt><dd>{partner.phone}</dd></div>
        <div><dt>Email</dt><dd>{partner.email}</dd></div>
        <div><dt>Vehicle</dt><dd>{partner.vehicleType}{partner.vehicleNumber ? ` · ${partner.vehicleNumber}` : ""}</dd></div>
        <div><dt>Driving licence</dt><dd>{partner.licenceNumber || "— (bicycle)"}</dd></div>
        <div><dt>Documents</dt><dd><PartnerDocuments partner={partner} /></dd></div>
        <div><dt>Area</dt><dd>{partner.area}</dd></div>
      </dl>
    </div>
    {rejecting?.id === partner._id
      ? <form className="application-reject" onSubmit={(event) => { event.preventDefault(); void reviewApplication(partner, "rejected", rejecting.note); }}>
        <label className="admin-field"><span>Reason the applicant will see</span><textarea rows={3} maxLength={300} placeholder="e.g. The licence number doesn’t match a valid licence. Please check it and resubmit." value={rejecting.note} onChange={(event) => setRejecting({ id: partner._id, note: event.target.value })} autoFocus required minLength={5} /></label>
        <div className="application-actions"><button className="admin-outline-button" type="button" onClick={() => setRejecting(null)}>Cancel</button><button className="admin-decline-button" type="submit" disabled={rejecting.note.trim().length < 5}>Reject application</button></div>
      </form>
      : <div className="application-actions"><button className="admin-decline-button" type="button" onClick={() => setRejecting({ id: partner._id, note: "" })}>Reject</button><button className="admin-success-button" type="button" onClick={() => void reviewApplication(partner, "approved")}><Check size={15} /> Approve</button></div>}
  </article>;
}

// Partner applications, packed orders waiting for a partner, and the partner team.
function DeliveryPartnersPage() {
  const { orders, partners, refreshPartners, setPageError } = useAdmin();
  const [partnerDraft, setPartnerDraft] = useState(emptyPartnerDraft);
  const [editingPartnerId, setEditingPartnerId] = useState("");
  const [partnerFormError, setPartnerFormError] = useState("");
  const [savingPartner, setSavingPartner] = useState(false);
  // { id, note } while a rejection reason is being written.
  const [rejecting, setRejecting] = useState(null);

  const pendingApplications = partners.filter((partner) => partner.status === "pending");
  const reviewedPartners = partners.filter((partner) => partner.status !== "pending");
  const unassignedOrders = orders.filter((order) => !order.deliveryPartner && order.status === "packed" && canAssignPartner(order));
  const updateDraft = (patch) => setPartnerDraft({ ...partnerDraft, ...patch });

  const editPartner = (partner) => {
    setEditingPartnerId(partner._id);
    setPartnerDraft({ name: partner.name, email: partner.email, phone: partner.phone, vehicleType: partner.vehicleType, vehicleNumber: partner.vehicleNumber, licenceNumber: partner.licenceNumber, area: partner.area, password: "" });
    setPartnerFormError("");
  };
  const resetPartnerForm = () => {
    setEditingPartnerId("");
    setPartnerDraft(emptyPartnerDraft);
    setPartnerFormError("");
  };
  const savePartner = async (event) => {
    event.preventDefault();
    setSavingPartner(true);
    setPartnerFormError("");
    try {
      // An empty password keeps the current one.
      await adminApi.updatePartner(editingPartnerId, { ...partnerDraft, password: partnerDraft.password || undefined });
      await refreshPartners();
      resetPartnerForm();
    } catch (error) {
      setPartnerFormError(errorMessage(error, "Could not save the delivery partner."));
    } finally {
      setSavingPartner(false);
    }
  };
  const reviewApplication = async (partner, decision, note = "") => {
    try {
      await adminApi.reviewPartner(partner._id, decision, note);
      setRejecting(null);
      await refreshPartners();
    } catch (error) {
      setPageError(errorMessage(error, "Could not review the application."));
    }
  };
  const setPartnerActive = async (partner, active) => {
    if (!active && !window.confirm(`Deactivate ${partner.name}? They will be signed out and cannot be assigned new orders.`)) return;
    try {
      await adminApi.updatePartner(partner._id, { active });
      await refreshPartners();
    } catch (error) {
      setPageError(errorMessage(error, "Could not update the delivery partner."));
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-heading"><div><span className="admin-eyebrow">ORDER MANAGEMENT</span><h1>Delivery Partners</h1><p>People apply to deliver from the partner app at <a className="admin-inline-link" href={DELIVERY_APP_URL} target="_blank" rel="noreferrer">{DELIVERY_APP_URL.replace(/^https?:\/\//, "")}</a>. Once you approve them, they accept orders from the open pool themselves.</p></div><span className="registry-total"><Truck size={15} /> {partners.filter(assignable).length} active partners</span></div>

      <section className="admin-panel delivery-panel"><PanelTitle eyebrow="APPLICATIONS" title="Waiting for review"><span className={`admin-status ${pendingApplications.length ? "status-review" : "status-muted"}`}>{pendingApplications.length}</span></PanelTitle>
        {pendingApplications.length ? <div className="application-list">{pendingApplications.map((partner) => <ApplicationCard partner={partner} rejecting={rejecting} setRejecting={setRejecting} reviewApplication={reviewApplication} key={partner._id} />)}</div>
          : <EmptyState compact icon={<ClipboardCheck size={21} />} title="No applications to review" text="New delivery partner applications appear here." />}
      </section>

      <section className="admin-panel delivery-panel"><PanelTitle eyebrow="OPEN POOL" title="Packed orders not yet accepted"><span className="admin-status status-review">{unassignedOrders.length}</span></PanelTitle>
        <p className="panel-hint">An order appears here, and in the partners’ app, once its seller marks it packed. Partners accept the ones they want; you can also assign one directly.</p>
        {unassignedOrders.length ? <div className="registry-table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>DELIVER TO</th><th>STATUS</th><th>PAYMENT</th><th>ASSIGN</th></tr></thead><tbody>{unassignedOrders.map((order) => <tr key={order._id}>
          <td><strong>{orderNumber(order)}</strong><small>{new Date(order.createdAt).toLocaleString("en-IN")}</small></td>
          <td><strong>{order.shippingAddress?.name || "Customer"}</strong><small>{[order.shippingAddress?.city, order.shippingAddress?.pincode].filter(Boolean).join(" ") || "—"}</small></td>
          <td><span className={`admin-status ${order.status === "packed" ? "status-active" : "status-muted"}`}>{orderStatusLabels[order.status] || order.status}</span></td>
          <td>{paymentMethodLabels[order.paymentMethod || "cod"]}<small>{rupees(order.total)}</small></td>
          <td>{partners.some(assignable) ? <PartnerSelect order={order} /> : <small>No approved partners yet</small>}</td>
        </tr>)}</tbody></table></div> : <EmptyState compact icon={<PackageCheck size={21} />} title="No packed orders waiting" text="Orders show up here once their seller packs them, until a partner accepts them." />}
      </section>

      <div className={editingPartnerId ? "delivery-grid" : ""}>
        {editingPartnerId && <section className="admin-panel"><PanelTitle eyebrow="EDIT PARTNER" title={partnerDraft.name || "Edit partner"}><button className="admin-outline-button" type="button" onClick={resetPartnerForm}>Cancel</button></PanelTitle>
          <form className="partner-form" onSubmit={savePartner}>
            <label className="admin-field"><span>Full name</span><input value={partnerDraft.name} maxLength={80} onChange={(event) => updateDraft({ name: event.target.value })} required /></label>
            <label className="admin-field"><span>Mobile number</span><input inputMode="numeric" maxLength={10} value={partnerDraft.phone} onChange={(event) => updateDraft({ phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} required /></label>
            <label className="admin-field partner-wide"><span>Email</span><input type="email" autoComplete="off" value={partnerDraft.email} onChange={(event) => updateDraft({ email: event.target.value })} required /></label>
            <label className="admin-field"><span>Vehicle</span><select value={partnerDraft.vehicleType} onChange={(event) => updateDraft({ vehicleType: event.target.value })}>{vehicleTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label className="admin-field"><span>Vehicle number</span><input placeholder="KA01AB1234" maxLength={14} value={partnerDraft.vehicleNumber} onChange={(event) => updateDraft({ vehicleNumber: event.target.value.toUpperCase() })} /></label>
            <label className="admin-field partner-wide"><span>Driving licence</span><input placeholder="KA0120190001234" maxLength={20} value={partnerDraft.licenceNumber} onChange={(event) => updateDraft({ licenceNumber: event.target.value.toUpperCase() })} /></label>
            <label className="admin-field partner-wide"><span>Delivery area</span><input maxLength={80} value={partnerDraft.area} onChange={(event) => updateDraft({ area: event.target.value })} required /></label>
            <label className="admin-field partner-wide"><span>Reset password (leave blank to keep the current one)</span><input type="text" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" value={partnerDraft.password} onChange={(event) => updateDraft({ password: event.target.value })} /></label>
            {partnerFormError && <p className="admin-login-error partner-wide" role="alert">{partnerFormError}</p>}
            <p className="partner-note partner-wide">Partners have no “forgot password” option; reset it here and share the new one with them.</p>
            <button className="admin-success-button partner-wide" type="submit" disabled={savingPartner}>{savingPartner ? "Saving…" : "Save changes"}</button>
          </form>
        </section>}

        <section className="admin-panel"><PanelTitle eyebrow="TEAM" title="Partners"><span className="registry-total">{reviewedPartners.length}</span></PanelTitle>
          {reviewedPartners.length ? <div className="registry-table-wrap"><table className="admin-table"><thead><tr><th>PARTNER</th><th>VEHICLE</th><th>ORDERS</th><th>STATUS</th><th /></tr></thead><tbody>{reviewedPartners.map((partner) => <tr key={partner._id} className={assignable(partner) ? "" : "is-inactive"}>
            <td><strong>{partner.name}</strong><small>{partner.phone} · {partner.email}</small>{partner.area && <small>{partner.area}</small>}</td>
            <td>{partner.vehicleType}<small>{partner.vehicleNumber || "—"}</small></td>
            <td>{partner.activeOrders} open<small>{partner.deliveredOrders} delivered</small></td>
            <td><span className={`admin-status ${partner.status === "rejected" ? "status-rejected" : partner.active ? "status-active" : "status-muted"}`}>{partner.status === "rejected" ? "Rejected" : partner.active ? "Active" : "Inactive"}</span>{partner.status === "rejected" && <small className="partner-reason" title={partner.reviewNote}>{partner.reviewNote}</small>}</td>
            <td>{partner.status === "approved" && <div className="partner-actions"><button className="admin-outline-button" type="button" onClick={() => editPartner(partner)}>Edit</button>{partner.active ? <button className="admin-decline-button" type="button" onClick={() => void setPartnerActive(partner, false)}>Deactivate</button> : <button className="admin-outline-button" type="button" onClick={() => void setPartnerActive(partner, true)}>Reactivate</button>}</div>}</td>
          </tr>)}</tbody></table></div> : <EmptyState compact icon={<Truck size={21} />} title="No delivery partners yet" text="Approved applicants appear here." />}
        </section>
      </div>
    </div>
  );
}

export default DeliveryPartnersPage;
