export const SELLER_PORTAL_URL = process.env.SELLER_PORTAL_URL || "http://localhost:5173";
export const DELIVERY_APP_URL = process.env.DELIVERY_APP_URL || "http://localhost:5176";

export const returnPickupLabels = { awaiting_partner: "Pickup: waiting for a partner", assigned: "Pickup: partner on the way to customer", picked_up: "Pickup: on its way to seller", returned: "Returned to seller" };
export const orderStatusLabels = { placed: "Placed", packed: "Packed", shipped: "Shipped", out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled" };
export const paymentMethodLabels = { cod: "Cash on delivery", razorpay: "Razorpay", upi: "UPI", phonepe: "PhonePe UPI" };
export const paymentStatusLabels = { pending: "Not collected", awaiting_verification: "Verify UPI", paid: "Paid", failed: "Rejected" };
export const paymentStatusClass = { pending: "status-muted", awaiting_verification: "status-review", paid: "status-active", failed: "status-rejected" };
export const returnStatusLabels = { requested: "Awaiting seller", approved: "Accepted", rejected: "Rejected" };
export const returnStatusClass = { requested: "status-review", approved: "status-active", rejected: "status-rejected" };

export const vehicleTypes = ["Bike", "Scooter", "Bicycle", "Van"];
export const emptyPartnerDraft = { name: "", email: "", phone: "", vehicleType: "Bike", vehicleNumber: "", licenceNumber: "", area: "", password: "" };

// The breadcrumb for each screen: [section, page title].
export const screenHeadings = {
  overview: ["ADMIN WORKSPACE", "Dashboard"],
  registry: ["SELLER MANAGEMENT", "Seller Registry"],
  "product-approvals": ["CATALOG MANAGEMENT", "Product Approval"],
  inventory: ["CATALOG MANAGEMENT", "Product Inventory"],
  orders: ["ORDER MANAGEMENT", "Customer Orders"],
  returns: ["ORDER MANAGEMENT", "Returns"],
  customers: ["ORDER MANAGEMENT", "Customers"],
  sales: ["ORDER MANAGEMENT", "Category Sales"],
  delivery: ["ORDER MANAGEMENT", "Delivery Partners"],
  "product-page": ["CATALOG MANAGEMENT", "Product Page"],
};
