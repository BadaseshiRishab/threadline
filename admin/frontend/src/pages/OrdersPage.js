import { PackageCheck, Truck } from "lucide-react";
import * as adminApi from "../api/admin";
import { errorMessage } from "../api/client";
import EmptyState from "../components/EmptyState";
import PageHeading from "../components/PageHeading";
import PartnerSelect from "../components/PartnerSelect";
import { useAdmin } from "../context/AdminContext";
import { paymentMethodLabels, paymentStatusClass, paymentStatusLabels, returnStatusClass, returnStatusLabels } from "../utils/constants";
import { orderNumber, rupees } from "../utils/format";
import { canAssignPartner } from "../utils/orders";

// The transaction ID the payment gateway gave an online payment.
function PaymentReference({ order }) {
  if (order.paymentMethod === "upi") return <>UPI transaction ID (UTR): <strong>{order.upiTransactionId || "—"}</strong></>;
  if (order.paymentMethod === "phonepe") return <>PhonePe transaction ID: <strong>{order.phonepeTransactionId || "—"}</strong></>;
  return <>Razorpay payment ID: <strong>{order.razorpayPaymentId || "—"}</strong></>;
}

function OrderDetails({ order }) {
  const { setOrders, setScreen, setPageError } = useAdmin();
  const paymentStatus = order.paymentStatus || "pending";

  // UPI payments are checked by hand: admin confirms the money arrived with the customer's UTR, or rejects it.
  const decideUpiPayment = async (decision) => {
    if (decision === "rejected" && !window.confirm(`Reject the UPI payment for order ${orderNumber(order)}? The order will be cancelled and its stock returned.`)) return;
    try {
      const result = await adminApi.decidePayment(order._id, decision);
      setOrders((current) => current.map((entry) => entry._id === order._id ? { ...entry, status: result.order.status, paymentStatus: result.order.paymentStatus, paidAt: result.order.paidAt } : entry));
    } catch (error) {
      setPageError(errorMessage(error, "Could not update the payment."));
    }
  };

  return <details className="admin-order-details">
    <summary>
      <span><strong>{orderNumber(order)}</strong><small>{new Date(order.createdAt).toLocaleString("en-IN")}</small></span>
      <span>{order.customerId}</span>
      <span>{order.items.reduce((total, item) => total + Number(item.quantity || 0), 0)} products</span>
      <span>₹{Number(order.total || 0).toLocaleString("en-IN")}</span>
      <span>{paymentMethodLabels[order.paymentMethod || "cod"]} <span className={`admin-status ${paymentStatusClass[paymentStatus]}`}>{paymentStatusLabels[paymentStatus]}</span></span>
      <span className="admin-status status-review">{order.status}</span>
    </summary>
    <div className="admin-order-payment">
      <span><Truck size={14} /> Delivery partner: {order.deliveryPartner ? <strong className="admin-partner-name">{order.deliveryPartner.name} · {order.deliveryPartner.phone}</strong> : <span>{order.status === "placed" ? "available to partners once the seller packs it" : canAssignPartner(order) ? "not assigned yet" : "—"}</span>}</span>
      {canAssignPartner(order) && <span className="admin-order-payment-actions"><PartnerSelect order={order} /></span>}
    </div>
    {order.paymentMethod && order.paymentMethod !== "cod" && <div className="admin-order-payment">
      <span><PaymentReference order={order} />{order.paidAt && <small> · Paid {new Date(order.paidAt).toLocaleString("en-IN")}</small>}</span>
      {order.paymentStatus === "awaiting_verification" && <span className="admin-order-payment-actions"><small>Check that {rupees(order.total)} arrived with this UTR before confirming.</small><button className="admin-button-confirm" type="button" onClick={() => void decideUpiPayment("paid")}>Confirm payment</button><button className="admin-button-reject" type="button" onClick={() => void decideUpiPayment("rejected")}>Reject</button></span>}
    </div>}
    <div className="admin-order-items"><table><thead><tr><th>PRODUCT</th><th>SELLER</th><th>QUANTITY</th><th>UNIT COST</th><th>RETURN</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={`${order._id}-${index}`}>
      <td>{item.name}</td>
      <td>{item.sellerName}</td>
      <td>{item.quantity}</td>
      <td>₹{Number(item.unitPrice || 0).toLocaleString("en-IN")}</td>
      <td>{item.returnRequest ? <button className={`admin-status admin-status-link ${returnStatusClass[item.returnRequest.status]}`} type="button" onClick={() => setScreen("returns")}>{returnStatusLabels[item.returnRequest.status]}</button> : "—"}</td>
    </tr>)}</tbody></table></div>
  </details>;
}

function OrdersPage() {
  const { orders } = useAdmin();
  return (
    <div className="admin-page">
      <PageHeading eyebrow="ORDER MANAGEMENT" title="Customer Orders" description="Orders are identified by customer ID and routed to the relevant sellers."><span className="registry-total"><PackageCheck size={15} /> {orders.length} orders</span></PageHeading>
      <section className="admin-panel"><div className="admin-panel-title"><div><span className="admin-eyebrow">ORDER QUEUE</span><h2>Recent orders</h2></div></div>
        {orders.length ? <div className="registry-table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>CUSTOMER ID</th><th>ITEMS</th><th>TOTAL</th><th>PAYMENT</th><th>STATUS</th></tr></thead><tbody>{orders.map((order) => <tr key={order._id}><td colSpan={6}><OrderDetails order={order} /></td></tr>)}</tbody></table></div>
          : <EmptyState icon={<PackageCheck size={23} />} title="No customer orders yet" text="Placed orders will appear here with their customer IDs." />}
      </section>
    </div>
  );
}

export default OrdersPage;
