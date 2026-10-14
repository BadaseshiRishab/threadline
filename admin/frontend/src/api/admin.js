import { api, apiUrl } from "./client";

// Account
export const fetchCurrentUser = () => api("/auth/me").then(({ user }) => user);
export const login = (email, password) => api("/auth/login", { method: "POST", body: { email, password } }).then(({ user }) => user);
export const logout = () => api("/auth/logout", { method: "POST" });

// Sellers and products. Products come back with id set to their _id.
const withId = (product) => ({ ...product, id: product._id });
export async function fetchMarketplace() {
  const [overview, sellerResponse, topResponse, pendingResponse, inventoryResponse] = await Promise.all([
    api("/admin/overview"),
    api("/admin/sellers"),
    api("/admin/sellers?top=true"),
    api("/admin/products?status=pending"),
    api("/admin/inventory"),
  ]);
  return {
    overview,
    sellers: sellerResponse.sellers,
    topSellers: topResponse.sellers,
    products: [...pendingResponse.products, ...inventoryResponse.products].map(withId),
  };
}
// Settings from admin/backend/.env, e.g. { defaultMarginPercent }.
export const fetchSettings = () => api("/admin/settings");
export const decideSeller = (sellerId, status) => api(`/admin/sellers/${sellerId}/decision`, { method: "PATCH", body: { status } });
export const sellerSignatureUrl = (sellerId) => apiUrl(`/admin/sellers/${sellerId}/signature`);
export const decideProduct = (productId, status, marginPercent) => api(`/admin/products/${productId}/decision`, { method: "PATCH", body: { status, marginPercent } });
export const setSale = (productId, salePercent) => api(`/admin/inventory/${productId}/sale`, { method: "PATCH", body: { salePercent } });

// Stock
export const fetchFastSelling = () => api("/admin/fast-selling").then(({ products }) => products);
export const fetchRestockRequests = () => api("/admin/restock-requests").then(({ requests }) => requests);
export const requestRestock = (productId, stock) => api(`/admin/inventory/${productId}/restock-request`, { method: "POST", body: { stock } });
export const cancelRestock = (requestId) => api(`/admin/restock-requests/${requestId}/cancel`, { method: "PATCH" });

// Orders, customers and sales
export const fetchOrders = () => api("/admin/orders").then(({ orders }) => orders);
export const decidePayment = (orderId, decision) => api(`/admin/orders/${orderId}/payment`, { method: "PATCH", body: { decision } });
export const fetchCustomers = () => api("/admin/customers").then(({ customers }) => customers);
// period is 'day', 'month' or 'year'.
export const fetchSales = (period) => api(`/admin/sales?period=${period}`);

// Delivery partners
export const fetchPartners = () => api("/admin/delivery-partners").then(({ partners }) => partners);
export const updatePartner = (partnerId, changes) => api(`/admin/delivery-partners/${partnerId}`, { method: "PATCH", body: changes });
export const reviewPartner = (partnerId, decision, note) => api(`/admin/delivery-partners/${partnerId}/review`, { method: "PATCH", body: { decision, note } });
export const assignPartner = (orderId, partnerId) => api(`/admin/orders/${orderId}/delivery-partner`, { method: "PATCH", body: { partnerId } });
export const partnerDocumentUrl = (partnerId, kind) => apiUrl(`/admin/delivery-partners/${partnerId}/documents/${kind}`);
