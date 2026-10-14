import { RotateCcw } from "lucide-react";
import EmptyState from "../components/EmptyState";
import PageHeading from "../components/PageHeading";
import { useAdmin } from "../context/AdminContext";
import { returnPickupLabels, returnStatusClass, returnStatusLabels } from "../utils/constants";
import { orderNumber } from "../utils/format";
import { returnEntriesOf } from "../utils/orders";

// Every return request, with the seller's decision and the pickup's progress. Sellers decide; admin only watches.
function ReturnsPage() {
  const { orders, openReturnCount } = useAdmin();
  const returnEntries = returnEntriesOf(orders);
  const countWith = (status) => returnEntries.filter((entry) => entry.request.status === status).length;
  return (
    <div className="admin-page">
      <PageHeading eyebrow="ORDER MANAGEMENT" title="Returns" description="Return requests from customers after delivery. Each request is answered by the item’s seller. A delivery partner collects each accepted return and brings it back to the seller, and it goes back into stock then."><span className="registry-total"><RotateCcw size={15} /> {openReturnCount} awaiting seller</span></PageHeading>
      <section className="admin-panel"><div className="admin-panel-title"><div><span className="admin-eyebrow">RETURN REQUESTS</span><h2>All returns</h2></div><span className="admin-return-summary">{countWith("approved")} accepted · {countWith("rejected")} rejected</span></div>
        {returnEntries.length ? <div className="registry-table-wrap"><table className="admin-table admin-returns-table"><thead><tr><th>PRODUCT / SELLER</th><th>ORDER / CUSTOMER</th><th>CUSTOMER REASON</th><th>STATUS</th><th>SELLER MESSAGE</th></tr></thead><tbody>{returnEntries.map(({ order, item, request }) => <tr key={item._id}>
          <td className="admin-wrap-cell admin-return-product"><strong>{item.name}</strong><small>{item.size && item.size !== "One size" ? `Size ${item.size} · ` : ""}Qty {item.quantity} · ₹{Number((item.unitPrice || 0) * item.quantity).toLocaleString("en-IN")}</small><small>Seller: {item.sellerName}</small></td>
          <td><strong>{orderNumber(order)}</strong><small>{order.customerId}</small></td>
          <td className="admin-wrap-cell"><strong>{request.reason}</strong><small>“{request.message}”</small><small>Requested {new Date(request.requestedAt).toLocaleString("en-IN")}</small></td>
          <td><span className={`admin-status ${returnStatusClass[request.status]}`}>{returnStatusLabels[request.status]}</span>{request.resolvedAt && <small>{new Date(request.resolvedAt).toLocaleDateString("en-IN")}{request.restockedQuantity ? ` · +${request.restockedQuantity} restocked` : ""}</small>}{item.returnPickup && <small>{returnPickupLabels[item.returnPickup.status]}{item.returnPickup.partner && item.returnPickup.status !== "returned" ? ` · ${item.returnPickup.partner.name} (${item.returnPickup.partner.phone})` : ""}</small>}</td>
          <td className="admin-wrap-cell">{request.sellerMessage ? `“${request.sellerMessage}”` : "—"}</td>
        </tr>)}</tbody></table></div> : <EmptyState icon={<RotateCcw size={23} />} title="No return requests yet" text="When a customer asks to return a delivered item, it will appear here with the seller’s decision." />}
      </section>
    </div>
  );
}

export default ReturnsPage;
