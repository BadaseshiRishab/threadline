import { useState } from "react";
import { ChevronRight, PackageCheck, Search, TrendingUp, UserRound, Users } from "lucide-react";
import EmptyState from "../components/EmptyState";
import PageHeading from "../components/PageHeading";
import { useAdmin } from "../context/AdminContext";
import { orderStatusLabels, returnStatusClass, returnStatusLabels } from "../utils/constants";
import { orderNumber, plural, rupees } from "../utils/format";

function CustomerOrder({ order }) {
  const statusClass = order.status === "delivered" ? "status-active" : order.status === "cancelled" ? "status-rejected" : "status-review";
  return <article className="admin-customer-order">
    <header><span><strong>Order {orderNumber(order)}</strong><small>{new Date(order.createdAt).toLocaleString("en-IN")}{order.shippingAddress?.city ? ` · ${order.shippingAddress.city} ${order.shippingAddress.pincode || ""}` : ""}</small></span><span className={`admin-status ${statusClass}`}>{orderStatusLabels[order.status] || order.status}</span><b>{rupees(order.total)}</b></header>
    <div className="registry-table-wrap"><table><thead><tr><th>PRODUCT</th><th>SELLER</th><th>SIZE</th><th>QTY</th><th>UNIT PRICE</th><th>RETURN</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={item._id || index}><td>{item.name}</td><td>{item.sellerName}</td><td>{item.size || "—"}</td><td>{item.quantity}</td><td>{rupees(item.unitPrice)}</td><td>{item.returnRequest ? <span className={`admin-status ${returnStatusClass[item.returnRequest.status]}`}>{returnStatusLabels[item.returnRequest.status]}</span> : "—"}</td></tr>)}</tbody></table></div>
  </article>;
}

// Order history grouped by customer.
function CustomersPage() {
  const { customers } = useAdmin();
  const [customerQuery, setCustomerQuery] = useState("");
  const customerNeedle = customerQuery.trim().toLowerCase();
  const visibleCustomers = customers.filter((customer) => !customerNeedle || [customer.name, customer.email, customer.phone, customer._id].some((value) => String(value || "").toLowerCase().includes(customerNeedle)));
  const customerRevenue = customers.reduce((total, customer) => total + customer.totalSpent, 0);

  return (
    <div className="admin-page">
      <PageHeading eyebrow="ORDER MANAGEMENT" title="Customers" description="Order history grouped by customer. Open a customer to see each of their orders."><span className="registry-total"><UserRound size={15} /> {customers.length} customers</span></PageHeading>
      <div className="admin-metrics">
        <div><span>CUSTOMERS <Users size={16} /></span><strong>{customers.length.toString().padStart(2, "0")}</strong><small>Registered accounts</small></div>
        <div><span>ORDERING CUSTOMERS <UserRound size={16} /></span><strong>{customers.filter((customer) => customer.orderCount > 0).length.toString().padStart(2, "0")}</strong><small>Placed at least one order</small></div>
        <div><span>ORDERS <PackageCheck size={16} /></span><strong>{customers.reduce((total, customer) => total + customer.orderCount, 0).toString().padStart(2, "0")}</strong><small>{customers.reduce((total, customer) => total + customer.activeOrders, 0)} still in progress</small></div>
        <div><span>ORDER VALUE <TrendingUp size={16} /></span><strong className="admin-metric-money">{rupees(Math.round(customerRevenue))}</strong><small>Excluding cancelled orders</small></div>
      </div>
      <section className="admin-panel admin-customers-panel"><div className="admin-panel-title"><div><span className="admin-eyebrow">CUSTOMER ORDERS</span><h2>All customers</h2></div><label className="admin-search admin-customer-search"><Search size={15} /><input aria-label="Search customers" placeholder="Name, email, mobile or ID" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} /></label></div>
        {visibleCustomers.length ? <div className="admin-customer-list">{visibleCustomers.map((customer) => <details className="admin-customer" key={customer._id}>
          <summary>
            <span className="admin-customer-who"><span className="admin-customer-avatar">{(customer.name || customer.email).slice(0, 1).toUpperCase()}</span><span><strong>{customer.name || "Unnamed customer"}</strong><small>{customer.email}{customer.phone ? ` · +91 ${customer.phone}` : ""}</small><small className="admin-customer-id">ID {customer._id}</small></span></span>
            <span><b>{customer.orderCount}</b><small>{plural(customer.orderCount, "order")}{customer.activeOrders ? ` · ${customer.activeOrders} active` : ""}</small></span>
            <span><b>{customer.unitCount}</b><small>units</small></span>
            <span><b>{rupees(customer.totalSpent)}</b><small>order value</small></span>
            <span><b>{customer.returnCount}</b><small>{plural(customer.returnCount, "return")}</small></span>
            <span><b>{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</b><small>last order</small></span>
            <ChevronRight className="admin-customer-chevron" size={16} />
          </summary>
          {customer.orders.length ? <div className="admin-customer-orders">{customer.orders.map((order) => <CustomerOrder order={order} key={order._id} />)}</div> : <p className="admin-customer-empty">This customer hasn’t placed an order yet.</p>}
        </details>)}</div> : <EmptyState icon={<UserRound size={23} />} title={customers.length ? "No matching customers" : "No customers yet"} text={customers.length ? "Try a different name, email, mobile number or customer ID." : "Customer accounts will appear here once people sign up on the store."} />}
      </section>
    </div>
  );
}

export default CustomersPage;
