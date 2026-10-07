import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  Boxes,
  Building2,
  Check,
  BarChart3,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Package,
  PackageCheck,
  RotateCcw,
  Search,
  ShieldCheck,
  Store,
  Star,
  TrendingUp,
  Truck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { api } from "./api";
import "./AdminApp.css";

type SellerProfile = Record<string, string | boolean>;
type AdminSeller = {
  _id: string;
  email: string;
  phone: string;
  sellerStatus: string;
  application: SellerProfile;
  approvedProductCount?: number;
  createdAt?: string;
  // Top sellers only: sales and review figures behind the ranking (see topSellers in the admin API).
  metrics?: { unitsSold: number; orderCount: number; revenue: number; reviewCount: number; averageRating: number; weightedRating: number; score: number };
};
type Product = {
  id: string;
  name: string;
  tagline: string;
  category: string;
  subcategory: string;
  cost: number;
  marginPercent?: number;
  marginAmount?: number;
  sellingPrice?: number | null;
  salePercent?: number;
  description: string;
  imageUrl: string;
  stock: Record<string, number>;
  status: "pending" | "approved" | "rejected";
  seller?: AdminSeller | string;
};
type ReturnPickup = { status: "awaiting_partner" | "assigned" | "picked_up" | "returned"; partner: { name: string; phone: string } | null; pickedUpAt?: string; returnedAt?: string };
const returnPickupLabels: Record<ReturnPickup["status"], string> = { awaiting_partner: "Pickup: waiting for a partner", assigned: "Pickup: partner on the way to customer", picked_up: "Pickup: on its way to seller", returned: "Returned to seller" };
type ReturnRequest = { status: "requested" | "approved" | "rejected"; reason: string; message: string; sellerMessage?: string; requestedAt: string; resolvedAt?: string; restockedQuantity?: number };
type AdminOrder = { _id: string; customerId: string; total: number; status: string; paymentMethod?: "cod" | "razorpay" | "upi" | "phonepe"; phonepeTransactionId?: string; paymentStatus?: "pending" | "awaiting_verification" | "paid" | "failed"; razorpayPaymentId?: string; upiTransactionId?: string; paidAt?: string; deliveryPartner?: { _id: string; name: string; phone: string; vehicleType?: string; vehicleNumber?: string; active?: boolean } | null; deliveryAssignedAt?: string; shippingAddress?: { name?: string; city?: string; pincode?: string }; createdAt: string; deliveredAt?: string; items: Array<{ _id: string; name: string; imageUrl?: string; size?: string; quantity: number; unitPrice: number; sellerName: string; returnPickup?: ReturnPickup; returnRequest?: ReturnRequest }> };
type AdminCustomer = { _id: string; name: string; email: string; phone: string; joinedAt?: string; orderCount: number; activeOrders: number; unitCount: number; totalSpent: number; returnCount: number; lastOrderAt: string | null; orders: Array<Omit<AdminOrder, "customerId"> & { shippingAddress?: { name?: string; line?: string; city?: string; pincode?: string } }> };
const orderStatusLabels: Record<string, string> = { placed: "Placed", packed: "Packed", shipped: "Shipped", out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled" };
const rupees = (value: number) => { const amount = Number(value || 0); return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`; };
type SalesPeriod = "day" | "month" | "year";
type SalesRow = { period: string; category: string; subcategory: string; units: number; sales: number; returnedUnits: number; returnedSales: number; orders: number };
type SalesReport = { period: SalesPeriod; sinceDays: number; rows: SalesRow[]; periods: Record<string, number> };
// Turns the report's period keys (2026-10-03, 2026-10, 2026) into readable labels.
const periodLabel = (key: string, period: SalesPeriod) => {
  if (period === "year") return key;
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day || 1);
  return period === "month" ? date.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};
const paymentMethodLabels = { cod: "Cash on delivery", razorpay: "Razorpay", upi: "UPI", phonepe: "PhonePe UPI" } as const;
const paymentStatusLabels = { pending: "Not collected", awaiting_verification: "Verify UPI", paid: "Paid", failed: "Rejected" } as const;
const paymentStatusClass = { pending: "status-muted", awaiting_verification: "status-review", paid: "status-active", failed: "status-rejected" } as const;
const returnStatusLabels = { requested: "Awaiting seller", approved: "Accepted", rejected: "Rejected" } as const;
const returnStatusClass = { requested: "status-review", approved: "status-active", rejected: "status-rejected" } as const;
type DeliveryPartner = { _id: string; name: string; email: string; phone: string; vehicleType: string; vehicleNumber: string; licenceNumber: string; documents?: { licence: boolean; rc: boolean }; area: string; status: "pending" | "approved" | "rejected"; reviewNote: string; appliedAt: string; reviewedAt?: string; active: boolean; createdAt: string; activeOrders: number; deliveredOrders: number };
const vehicleTypes = ["Bike", "Scooter", "Bicycle", "Van"] as const;
const emptyPartnerDraft = { name: "", email: "", phone: "", vehicleType: "Bike", vehicleNumber: "", licenceNumber: "", area: "", password: "" };
// Only approved, active partners can be given orders.
const assignable = (partner: DeliveryPartner) => partner.status === "approved" && partner.active;
// Orders a partner can be given: packed by the seller and not yet delivered, and UPI orders only once their payment is confirmed.
const canAssignPartner = (order: AdminOrder) => !["placed", "delivered", "cancelled"].includes(order.status) && !(order.paymentMethod === "upi" && order.paymentStatus !== "paid");
type FastSelling = { _id: string; name: string; unitsSold: number; availableStock: Record<string, number> };
type RestockRequest = { _id: string; status: "open" | "fulfilled" | "cancelled"; createdAt: string; fulfilledAt?: string; requestedStock?: Record<string, number>; addedStock?: Record<string, number>; product?: { _id: string; name: string; imageUrl?: string }; seller?: { email: string; application?: SellerProfile } };
type Screen =
  | "overview"
  | "registry"
  | "product-approvals"
  | "inventory"
  | "orders"
  | "returns"
  | "customers"
  | "sales"
  | "delivery"
  | "product-page";
type RegistryTab = "requests" | "approved" | "top";
const SELLER_PORTAL_URL = process.env.SELLER_PORTAL_URL || "http://localhost:5173";
const DELIVERY_APP_URL = process.env.DELIVERY_APP_URL || "http://localhost:5176";

function text(value: string | boolean | undefined, fallback = "Not provided") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function AdminApp() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  // Ticks every minute so the greeting and date roll over while the dashboard stays open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(clock);
  }, []);
  const adminDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", month: "long", day: "2-digit", year: "numeric" }).format(now).toUpperCase();
  const hour = now.getHours();
  const greeting = hour >= 5 && hour < 12 ? "Good morning" : hour >= 12 && hour < 17 ? "Good afternoon" : "Good evening";
  const [loginError, setLoginError] = useState("");
  const [pageError, setPageError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [overview, setOverview] = useState({
    sellerRequests: 0,
    approvedSellers: 0,
    productRequests: 0,
    productInventory: 0,
  });
  const [sellers, setSellers] = useState<AdminSeller[]>([]);
  const [topSellers, setTopSellers] = useState<AdminSeller[]>([]);
  const [screen, setScreen] = useState<Screen>("overview");
  const [registryTab, setRegistryTab] = useState<RegistryTab>("requests");
  const [showRequestDetails, setShowRequestDetails] = useState(false);
  const [activeRegistrySellerId, setActiveRegistrySellerId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [marginByProduct, setMarginByProduct] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("day");
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [fastSelling, setFastSelling] = useState<FastSelling[]>([]);
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([]);
  // The product admin is entering restock quantities for, with the units typed per size.
  const [restockForm, setRestockForm] = useState<{ productId: string; quantities: Record<string, string> } | null>(null);
  const [saleInput, setSaleInput] = useState<Record<string, string>>({});
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [partnerDraft, setPartnerDraft] = useState(emptyPartnerDraft);
  const [editingPartnerId, setEditingPartnerId] = useState("");
  const [partnerFormError, setPartnerFormError] = useState("");
  const [savingPartner, setSavingPartner] = useState(false);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);
  const pendingSellers = sellers.filter(
    (seller) => seller.sellerStatus === "pending",
  );
  const approvedSellers = sellers.filter(
    (seller) => seller.sellerStatus === "approved",
  );
  const pendingProducts = products.filter(
    (product) => product.status === "pending",
  );
  const approvedProducts = products.filter(
    (product) => product.status === "approved",
  );
  const visibleInventory = approvedProducts.filter((product) =>
    `${product.name} ${product.category} ${product.subcategory} ${product.id}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );
  const selectedProduct = products.find(
    (product) => product.id === selectedProductId,
  );
  const selectedSeller =
    sellers.find((seller) => seller._id === activeRegistrySellerId) ??
    pendingSellers[0] ??
    approvedSellers[0];
  const profile = selectedSeller?.application ?? {};
  const identity = {
    email: selectedSeller?.email ?? "",
    phone: selectedSeller?.phone ?? "",
  };
  const sellerName = text(profile.businessName, "New seller");
  const contactName = text(
    profile.primaryName,
    text(profile.ownerName, "Seller contact"),
  );
  const stockTotal = (product: Product) =>
    Object.values(product.stock ?? {}).reduce(
      (total, count) => total + Number(count || 0),
      0,
    );
  const productSellerName = (product: Product) => {
    if (typeof product.seller === "object" && product.seller) {
      return text(product.seller.application?.businessName, product.seller.email);
    }
    const seller = sellers.find((entry) => entry._id === product.seller);
    return seller ? text(seller.application.businessName, seller.email) : "Seller";
  };

  useEffect(() => {
    let active = true;
    void api<{ user: { role: string } }>("/auth/me")
      .then(({ user }) => {
        if (active && user.role === "admin") setIsAdmin(true);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const [
          counts,
          sellerResponse,
          topResponse,
          pendingResponse,
          inventoryResponse,
        ] = await Promise.all([
          api<typeof overview>("/admin/overview"),
          api<{ sellers: AdminSeller[] }>("/admin/sellers"),
          api<{ sellers: AdminSeller[] }>("/admin/sellers?top=true"),
          api<{ products: Array<Product & { _id: string }> }>(
            "/admin/products?status=pending",
          ),
          api<{ products: Array<Product & { _id: string }> }>(
            "/admin/inventory",
          ),
        ]);
        if (!active) return;
        setOverview(counts);
        setSellers(sellerResponse.sellers);
        setTopSellers(topResponse.sellers);
        setProducts(
          [...pendingResponse.products, ...inventoryResponse.products].map(
            (product) => ({ ...product, id: product._id }),
          ),
        );
        setPageError("");
      } catch (error) {
        if (active)
          setPageError(
            error instanceof Error
              ? error.message
              : "Could not load admin data.",
          );
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    const refreshInterval = window.setInterval(() => void load(), 30_000);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
    };
  }, [isAdmin]);

  useEffect(() => {
    // Loaded on every screen change so the sidebar's order and open-return counts stay current.
    if (!isAdmin) return;
    void api<{ orders: AdminOrder[] }>("/admin/orders").then(({ orders: nextOrders }) => setOrders(nextOrders)).catch((error) => setPageError(error instanceof Error ? error.message : "Could not load orders."));
  }, [isAdmin, screen]);

  // Partners feed the delivery screen, the assign menus on the orders screen and the sidebar's application count.
  useEffect(() => {
    if (!isAdmin) return;
    void api<{ partners: DeliveryPartner[] }>("/admin/delivery-partners").then(({ partners: nextPartners }) => setPartners(nextPartners)).catch((error) => setPageError(error instanceof Error ? error.message : "Could not load delivery partners."));
  }, [isAdmin, screen]);

  useEffect(() => {
    if (!isAdmin) return;
    void api<{ customers: AdminCustomer[] }>("/admin/customers").then(({ customers: nextCustomers }) => setCustomers(nextCustomers)).catch((error) => setPageError(error instanceof Error ? error.message : "Could not load customers."));
  }, [isAdmin, screen]);

  useEffect(() => {
    if (!isAdmin || screen !== "sales") return;
    let active = true;
    void api<SalesReport>(`/admin/sales?period=${salesPeriod}`).then((report) => { if (active) setSalesReport(report); }).catch((error) => setPageError(error instanceof Error ? error.message : "Could not load sales."));
    return () => { active = false; };
  }, [isAdmin, screen, salesPeriod]);

  useEffect(() => {
    if (!isAdmin || screen !== "inventory") return;
    void api<{ products: FastSelling[] }>("/admin/fast-selling").then(({ products: nextProducts }) => setFastSelling(nextProducts)).catch(() => undefined);
    void api<{ requests: RestockRequest[] }>("/admin/restock-requests").then(({ requests }) => setRestockRequests(requests)).catch(() => undefined);
  }, [isAdmin, screen, products]);

  const lowStockProducts = approvedProducts.filter((product) => stockTotal(product) < 5);
  const openRequestFor = (product: Product) => restockRequests.find((entry) => entry.status === "open" && entry.product?._id === product.id);
  const requestRestock = async (product: Product, quantities: Record<string, string>) => {
    const stock = Object.fromEntries(Object.entries(quantities).map(([size, count]) => [size, Number(count || 0)]).filter(([, count]) => Number(count) > 0));
    if (!Object.keys(stock).length) { setPageError("Enter how many units to restock for at least one size."); return; }
    try {
      await api(`/admin/inventory/${product.id}/restock-request`, { method: "POST", body: { stock } });
      const { requests } = await api<{ requests: RestockRequest[] }>("/admin/restock-requests");
      setRestockRequests(requests);
      setRestockForm(null);
      setPageError("");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not send restock request.");
    }
  };
  const refreshPartners = async () => {
    const { partners: nextPartners } = await api<{ partners: DeliveryPartner[] }>("/admin/delivery-partners");
    setPartners(nextPartners);
  };
  const editPartner = (partner: DeliveryPartner) => {
    setEditingPartnerId(partner._id);
    setPartnerDraft({ name: partner.name, email: partner.email, phone: partner.phone, vehicleType: partner.vehicleType, vehicleNumber: partner.vehicleNumber, licenceNumber: partner.licenceNumber, area: partner.area, password: "" });
    setPartnerFormError("");
  };
  const resetPartnerForm = () => {
    setEditingPartnerId("");
    setPartnerDraft(emptyPartnerDraft);
    setPartnerFormError("");
  };
  const savePartner = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingPartner(true);
    setPartnerFormError("");
    try {
      // An empty password keeps the current one.
      await api(`/admin/delivery-partners/${editingPartnerId}`, { method: "PATCH", body: { ...partnerDraft, password: partnerDraft.password || undefined } });
      await refreshPartners();
      resetPartnerForm();
    } catch (error) {
      setPartnerFormError(error instanceof Error ? error.message : "Could not save the delivery partner.");
    } finally {
      setSavingPartner(false);
    }
  };
  const reviewApplication = async (partner: DeliveryPartner, decision: "approved" | "rejected", note = "") => {
    try {
      await api(`/admin/delivery-partners/${partner._id}/review`, { method: "PATCH", body: { decision, note } });
      setRejecting(null);
      await refreshPartners();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not review the application.");
    }
  };
  const setPartnerActive = async (partner: DeliveryPartner, active: boolean) => {
    if (!active && !window.confirm(`Deactivate ${partner.name}? They will be signed out and cannot be assigned new orders.`)) return;
    try {
      await api(`/admin/delivery-partners/${partner._id}`, { method: "PATCH", body: { active } });
      await refreshPartners();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not update the delivery partner.");
    }
  };
  const assignPartner = async (order: AdminOrder, partnerId: string) => {
    try {
      const result = await api<{ order: Pick<AdminOrder, "_id" | "status" | "deliveryPartner" | "deliveryAssignedAt"> }>(`/admin/orders/${order._id}/delivery-partner`, { method: "PATCH", body: { partnerId: partnerId || null } });
      setOrders((current) => current.map((entry) => entry._id === order._id ? { ...entry, ...result.order } : entry));
      void refreshPartners().catch(() => undefined);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not assign the delivery partner.");
    }
  };
  // Links open the licence / RC scan in a new tab; the admin session cookie authorises the request.
  const renderPartnerDocuments = (partner: DeliveryPartner) => {
    const kinds = ([["licence", "Licence"], ["rc", "RC"]] as const).filter(([kind]) => partner.documents?.[kind]);
    return kinds.length ? kinds.map(([kind, label], index) => <span key={kind}>{index > 0 && " · "}<a className="admin-inline-link" href={`/api/admin/delivery-partners/${partner._id}/documents/${kind}`} target="_blank" rel="noreferrer">{label}</a></span>) : "Not uploaded";
  };
  const renderPartnerSelect = (order: AdminOrder) => {
    const pickedUp = ["shipped", "out_for_delivery"].includes(order.status);
    const choices = partners.filter((partner) => assignable(partner) || partner._id === order.deliveryPartner?._id);
    return <select className="admin-partner-select" aria-label={`Delivery partner for order ${order._id.slice(-8).toUpperCase()}`} value={order.deliveryPartner?._id || ""} disabled={!canAssignPartner(order)} onChange={(event) => void assignPartner(order, event.target.value)}>
      <option value="" disabled={pickedUp}>{order.deliveryPartner ? "Remove partner" : "Assign partner…"}</option>
      {choices.map((partner) => <option value={partner._id} key={partner._id}>{partner.name}{partner.area ? ` · ${partner.area}` : ""} ({partner.activeOrders} open)</option>)}
    </select>;
  };
  const decideUpiPayment = async (order: AdminOrder, decision: "paid" | "rejected") => {
    if (decision === "rejected" && !window.confirm(`Reject the UPI payment for order ${order._id.slice(-8).toUpperCase()}? The order will be cancelled and its stock returned.`)) return;
    try {
      const result = await api<{ order: AdminOrder }>(`/admin/orders/${order._id}/payment`, { method: "PATCH", body: { decision } });
      setOrders((current) => current.map((entry) => entry._id === order._id ? { ...entry, status: result.order.status, paymentStatus: result.order.paymentStatus, paidAt: result.order.paidAt } : entry));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not update the payment.");
    }
  };
  const cancelRestock = async (id: string) => {
    try {
      await api(`/admin/restock-requests/${id}/cancel`, { method: "PATCH" });
      setRestockRequests((current) => current.map((entry) => entry._id === id ? { ...entry, status: "cancelled" } : entry));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not cancel restock request.");
    }
  };
  const saveSale = async (product: Product) => {
    try {
      await api(`/admin/inventory/${product.id}/sale`, { method: "PATCH", body: { salePercent: Number(saleInput[product.id] ?? product.salePercent ?? 0) } });
      await refreshAdminData();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Could not update sale.");
    }
  };
  const stockChips = (stock: Record<string, number> | undefined) => (
    <span className="stock-chips">
      {Object.entries(stock ?? {}).map(([size, count]) => <span className={`stock-chip ${Number(count) < 1 ? "is-empty" : Number(count) < 3 ? "is-low" : ""}`} key={size}><b>{size}</b>{count}</span>)}
    </span>
  );
  const stockSummary = (stock: Record<string, number> | undefined, sign = "") => Object.entries(stock ?? {}).map(([size, count]) => `${size}: ${sign}${count}`).join(", ");
  const restockAction = (product: Product) => {
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
  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const { user } = await api<{ user: { role: string } }>("/auth/login", {
        method: "POST",
        body: { email: adminId, password },
      });
      if (user.role !== "admin") {
        await api("/auth/logout", { method: "POST" });
        setLoginError("This account does not have administrator access.");
        return;
      }
      setLoginError("");
      setIsAdmin(true);
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Could not sign in.",
      );
    }
  };

  const signOut = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setIsAdmin(false);
    setPassword("");
    setScreen("overview");
  };

  const approveSeller = async (
    sellerId: string,
    status: "approved" | "rejected",
  ) => {
    try {
      await api(`/admin/sellers/${sellerId}/decision`, {
        method: "PATCH",
        body: { status },
      });
      setShowRequestDetails(false);
      await refreshAdminData();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not update seller status.",
      );
    }
  };

  const refreshAdminData = async () => {
    try {
      const [
        counts,
        sellerResponse,
        topResponse,
        pendingResponse,
        inventoryResponse,
      ] = await Promise.all([
        api<typeof overview>("/admin/overview"),
        api<{ sellers: AdminSeller[] }>("/admin/sellers"),
        api<{ sellers: AdminSeller[] }>("/admin/sellers?top=true"),
        api<{ products: Array<Product & { _id: string }> }>(
          "/admin/products?status=pending",
        ),
        api<{ products: Array<Product & { _id: string }> }>("/admin/inventory"),
      ]);
      setOverview(counts);
      setSellers(sellerResponse.sellers);
      setTopSellers(topResponse.sellers);
      setProducts(
        [...pendingResponse.products, ...inventoryResponse.products].map(
          (product) => ({ ...product, id: product._id }),
        ),
      );
      setPageError("");
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not refresh admin data.",
      );
    }
  };

  const reviewProduct = async (id: string, status: Product["status"]) => {
    try {
      await api(`/admin/products/${id}/decision`, {
        method: "PATCH",
        body: { status, marginPercent: Number(marginByProduct[id] ?? 5) },
      });
      await refreshAdminData();
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Could not update product status.",
      );
    }
  };

  const openProduct = (id: string) => {
    setSelectedProductId(id);
    setScreen("product-page");
  };

  // Every order item a customer asked to return, newest request first.
  const returnEntries = orders.flatMap((order) => order.items.filter((item) => item.returnRequest).map((item) => ({ order, item, request: item.returnRequest! }))).sort((a, b) => b.request.requestedAt.localeCompare(a.request.requestedAt));
  const openReturnCount = returnEntries.filter((entry) => entry.request.status === "requested").length;

  const customerNeedle = customerQuery.trim().toLowerCase();
  const visibleCustomers = customers.filter((customer) => !customerNeedle || [customer.name, customer.email, customer.phone, customer._id].some((value) => String(value || "").toLowerCase().includes(customerNeedle)));
  const customerRevenue = customers.reduce((total, customer) => total + customer.totalSpent, 0);

  // Pivot the report into periods (rows) × categories (columns), plus per-category totals with their sub-categories.
  const salesRows = salesReport?.period === salesPeriod ? salesReport.rows : [];
  const categoryTotals = Object.values(salesRows.reduce<Record<string, { category: string; sales: number; units: number; returnedUnits: number; subcategories: Record<string, { sales: number; units: number }> }>>((totals, row) => {
    const entry = totals[row.category] ??= { category: row.category, sales: 0, units: 0, returnedUnits: 0, subcategories: {} };
    entry.sales += row.sales; entry.units += row.units; entry.returnedUnits += row.returnedUnits;
    const sub = entry.subcategories[row.subcategory] ??= { sales: 0, units: 0 };
    sub.sales += row.sales; sub.units += row.units;
    return totals;
  }, {})).sort((a, b) => b.sales - a.sales);
  const salesPeriodKeys = [...new Set(salesRows.map((row) => row.period))].sort((a, b) => b.localeCompare(a));
  const salesCell = (periodKey: string, category: string) => salesRows.filter((row) => row.period === periodKey && row.category === category).reduce((cell, row) => ({ sales: cell.sales + row.sales, units: cell.units + row.units }), { sales: 0, units: 0 });
  const totalSales = categoryTotals.reduce((total, entry) => total + entry.sales, 0);
  const totalUnits = categoryTotals.reduce((total, entry) => total + entry.units, 0);
  const totalReturnedUnits = categoryTotals.reduce((total, entry) => total + entry.returnedUnits, 0);
  const totalSalesOrders = salesPeriodKeys.reduce((total, key) => total + (salesReport?.periods[key] || 0), 0);

  const pendingApplications = partners.filter((partner) => partner.status === "pending");
  const reviewedPartners = partners.filter((partner) => partner.status !== "pending");
  const unassignedOrders = orders.filter((order) => !order.deliveryPartner && order.status === "packed" && canAssignPartner(order));

  const heading = {
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
  }[screen];

  if (!authReady)
    return (
      <main className="admin-empty-state">
        <span>
          <ShieldCheck size={23} />
        </span>
        <h3>Connecting to admin services…</h3>
      </main>
    );

  if (!isAdmin) {
    return (
      <main className="admin-login-shell">
        <section className="admin-login-art">
          <a className="admin-wordmark admin-wordmark-light" href={SELLER_PORTAL_URL}>
            <span>t.</span> threadline
          </a>
          <div className="admin-art-copy">
            <span>THREADLINE&nbsp; / &nbsp;OPERATIONS</span>
            <h1>
              Good taste.
              <br />
              Good <em>governance.</em>
            </h1>
            <p>
              The people and products behind every point of view, all in one
              place.
            </p>
          </div>
          <div className="admin-art-index">ADMIN CONSOLE&nbsp; · &nbsp;01</div>
        </section>
        <section className="admin-login-side">
          <a className="admin-back-link" href={SELLER_PORTAL_URL}>
            <ArrowLeft size={15} /> Seller studio
          </a>
          <div className="admin-login-card">
            <span className="admin-eyebrow">
              <ShieldCheck size={15} /> ADMINISTRATOR ACCESS
            </span>
            <h2>
              Welcome to
              <br />
              the back office.
            </h2>
            <p className="admin-login-description">
              Sign in to review seller applications and product submissions.
            </p>
            <form className="admin-login-form" onSubmit={signIn}>
              <label className="admin-field">
                <span>Admin ID</span>
                <input
                  autoComplete="username"
                  placeholder="Enter Admin ID"
                  value={adminId}
                  onChange={(event) => setAdminId(event.target.value)}
                  required
                />
              </label>
              <label className="admin-field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              {loginError && (
                <p className="admin-login-error" role="alert">
                  {loginError}
                </p>
              )}
              <button className="admin-primary-button" type="submit">
                Sign in to admin <ArrowRight size={16} />
              </button>
            </form>
            <div className="credential-note">
              <div>
                <span className="admin-eyebrow">ADMIN ACCOUNT</span>
                <strong>
                  Credentials are configured securely by the server
                  administrator.
                </strong>
              </div>
              <BadgeCheck size={17} />
            </div>
            <p className="admin-demo-warning">
              Admin credentials are never stored in this browser. Ask your
              system administrator if you need access.
            </p>
          </div>
          <footer className="admin-login-footer">
            <span>THREADLINE SELLER STUDIO</span>
            <a href="mailto:sellers@threadline.example">Need access help?</a>
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-wordmark admin-wordmark-light" href="/admin">
          <span>t.</span> threadline
        </a>
        <div className="admin-environment">
          <span className="environment-dot" /> ADMIN&nbsp; / &nbsp;CONNECTED
          WORKSPACE
        </div>
        <nav className="admin-navigation" aria-label="Admin workspace">
          <span className="admin-nav-heading">WORKSPACE</span>
          <button
            className={screen === "overview" ? "active" : ""}
            type="button"
            onClick={() => setScreen("overview")}
          >
            <LayoutDashboard size={17} /> Dashboard
          </button>
          <span className="admin-nav-heading">SELLERS</span>
          <button
            className={
              screen === "registry" && registryTab === "requests"
                ? "active"
                : ""
            }
            type="button"
            onClick={() => {
              setScreen("registry");
              setRegistryTab("requests");
            }}
          >
            <ClipboardCheck size={17} /> Requests
            {pendingSellers.length > 0 && <b>{pendingSellers.length}</b>}
          </button>
          <button
            className={
              screen === "registry" && registryTab === "approved"
                ? "active"
                : ""
            }
            type="button"
            onClick={() => {
              setScreen("registry");
              setRegistryTab("approved");
            }}
          >
            <Users size={17} /> Approved sellers
            {approvedSellers.length > 0 && <b>{approvedSellers.length}</b>}
          </button>
          <button
            className={
              screen === "registry" && registryTab === "top" ? "active" : ""
            }
            type="button"
            onClick={() => {
              setScreen("registry");
              setRegistryTab("top");
            }}
          >
            <TrendingUp size={17} /> Top sellers
          </button>
          <span className="admin-nav-heading">CATALOG</span>
          <button
            className={screen === "product-approvals" ? "active" : ""}
            type="button"
            onClick={() => setScreen("product-approvals")}
          >
            <FileCheck2 size={17} /> Product approval
            {pendingProducts.length > 0 && <b>{pendingProducts.length}</b>}
          </button>
          <button
            className={
              screen === "inventory" || screen === "product-page"
                ? "active"
                : ""
            }
            type="button"
            onClick={() => setScreen("inventory")}
          >
            <Boxes size={17} /> Product inventory
            <i>{approvedProducts.length}</i>
          </button>
          <button className={screen === "orders" ? "active" : ""} type="button" onClick={() => setScreen("orders")}>
            <PackageCheck size={17} /> Customer orders
            {orders.length > 0 && <i>{orders.length}</i>}
          </button>
          <button className={screen === "delivery" ? "active" : ""} type="button" onClick={() => setScreen("delivery")}>
            <Truck size={17} /> Delivery partners
            {pendingApplications.length > 0 && <b title="Applications to review">{pendingApplications.length}</b>}
          </button>
          <button className={screen === "sales" ? "active" : ""} type="button" onClick={() => setScreen("sales")}>
            <BarChart3 size={17} /> Category sales
          </button>
          <button className={screen === "customers" ? "active" : ""} type="button" onClick={() => setScreen("customers")}>
            <UserRound size={17} /> Customers
            {customers.length > 0 && <i>{customers.length}</i>}
          </button>
          <button className={screen === "returns" ? "active" : ""} type="button" onClick={() => setScreen("returns")}>
            <RotateCcw size={17} /> Returns
            {openReturnCount > 0 && <i>{openReturnCount}</i>}
          </button>
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-avatar">A</span>
          <span>
            <strong>Threadline Admin</strong>
            <small>Administrator</small>
          </span>
          <button type="button" title="Sign out" onClick={signOut}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            ADMIN <ChevronRight size={13} /> {heading[0]}{" "}
            <ChevronRight size={13} /> <strong>{heading[1]}</strong>
          </div>
          <div className="admin-top-actions">
            <label className="admin-search">
              <Search size={16} />
              <input
                aria-label="Search inventory"
                placeholder="Search inventory"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <button className="admin-icon-button" type="button" title="Help">
              <CircleHelp size={17} />
            </button>
            <button
              className="admin-icon-button notification-button"
              type="button"
              title={lowStockProducts.length ? `${lowStockProducts.length} products low on stock` : `${pendingProducts.length} product approvals`}
              onClick={() => setScreen(lowStockProducts.length ? "inventory" : "product-approvals")}
            >
              <Bell size={17} />
              {(pendingProducts.length > 0 || lowStockProducts.length > 0) && <i />}
            </button>
            <span className="admin-top-avatar">A</span>
          </div>
        </header>
        {pageError && (
          <div className="admin-api-error" role="alert">
            {pageError}
          </div>
        )}
        {isLoading && (
          <div className="admin-loading-strip">
            Refreshing marketplace data…
          </div>
        )}

        {screen === "overview" && (
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
              <div>
                <span>
                  SELLER REQUESTS <ClipboardCheck size={16} />
                </span>
                <strong>
                  {overview.sellerRequests.toString().padStart(2, "0")}
                </strong>
                <small>Waiting for review</small>
              </div>
              <div>
                <span>
                  APPROVED SELLERS <Users size={16} />
                </span>
                <strong>
                  {overview.approvedSellers.toString().padStart(2, "0")}
                </strong>
                <small>Active on Threadline</small>
              </div>
              <div>
                <span>
                  PRODUCT APPROVALS <FileCheck2 size={16} />
                </span>
                <strong>
                  {overview.productRequests.toString().padStart(2, "0")}
                </strong>
                <small>Waiting for review</small>
              </div>
              <div>
                <span>
                  PRODUCT INVENTORY <Boxes size={16} />
                </span>
                <strong>
                  {overview.productInventory.toString().padStart(2, "0")}
                </strong>
                <small>Approved and ready</small>
              </div>
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
                      setScreen("registry");
                      setRegistryTab("requests");
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
                    <span className="admin-status status-review">
                      NEW SELLER
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))}
                {pendingProducts.map((product) => (
                  <button
                    className="attention-row"
                    type="button"
                    key={product.id}
                    onClick={() => setScreen("product-approvals")}
                  >
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
                      <small>
                        New seller and product requests will appear here.
                      </small>
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
                <button
                  className="shortcut-row"
                  type="button"
                  onClick={() => {
                    setScreen("registry");
                    setRegistryTab("requests");
                  }}
                >
                  <span>
                    <ClipboardCheck size={17} />
                  </span>
                  <strong>Seller registry</strong>
                  <small>Applications & seller accounts</small>
                  <ArrowRight size={15} />
                </button>
                <button
                  className="shortcut-row"
                  type="button"
                  onClick={() => setScreen("product-approvals")}
                >
                  <span>
                    <PackageCheck size={17} />
                  </span>
                  <strong>Product approval</strong>
                  <small>Review new catalog entries</small>
                  <ArrowRight size={15} />
                </button>
                <button
                  className="shortcut-row"
                  type="button"
                  onClick={() => setScreen("inventory")}
                >
                  <span>
                    <Boxes size={17} />
                  </span>
                  <strong>Product inventory</strong>
                  <small>Browse the approved catalog</small>
                  <ArrowRight size={15} />
                </button>
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
        )}

        {screen === "registry" && (
          <div className="admin-page">
            <div className="admin-page-heading">
              <div>
                <span className="admin-eyebrow">SELLER MANAGEMENT</span>
                <h1>Seller Registry</h1>
                <p>Review applications and keep track of approved sellers.</p>
              </div>
              <span className="registry-total">
                <Store size={15} /> {sellers.length} seller accounts
              </span>
            </div>
            <div
              className="admin-tabs"
              role="tablist"
              aria-label="Seller registry sections"
            >
              <button
                className={registryTab === "requests" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={registryTab === "requests"}
                onClick={() => setRegistryTab("requests")}
              >
                Requests{pendingSellers.length > 0 && <span>{pendingSellers.length}</span>}
              </button>
              <button
                className={registryTab === "approved" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={registryTab === "approved"}
                onClick={() => setRegistryTab("approved")}
              >
                Approved Sellers{approvedSellers.length > 0 && <span>{approvedSellers.length}</span>}
              </button>
              <button
                className={registryTab === "top" ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={registryTab === "top"}
                onClick={() => setRegistryTab("top")}
              >
                Top Sellers
              </button>
            </div>
            {registryTab === "requests" && (
              <section className="admin-panel">
                <div className="admin-panel-title">
                  <div>
                    <span className="admin-eyebrow">SELLER APPLICATIONS</span>
                    <h2>Requests to join</h2>
                  </div>
                  <span className="admin-queue-count">
                    {pendingSellers.length} REQUESTS
                  </span>
                </div>
                {pendingSellers.length > 0 ? (
                  <>
                    <div className="registry-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>BUSINESS</th>
                            <th>PRIMARY CONTACT</th>
                            <th>GSTIN</th>
                            <th>SUBMITTED</th>
                            <th>STATUS</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingSellers.map((seller) => (
                            <tr key={seller._id}>
                              <td>
                                <strong>{text(seller.application.businessName, "New seller")}</strong>
                                <small>{seller.email}</small>
                              </td>
                              <td>
                                {text(seller.application.primaryName, "Seller contact")}
                                <small>{text(seller.application.primaryPhone, seller.phone)}</small>
                              </td>
                              <td>{text(seller.application.gstin)}</td>
                              <td>{seller.createdAt ? new Date(seller.createdAt).toLocaleDateString() : "—"}</td>
                              <td><span className="admin-status status-review"><Clock3 size={12} /> Under review</span></td>
                              <td>
                                <button className="admin-outline-button" type="button" onClick={() => { setActiveRegistrySellerId(seller._id); setShowRequestDetails(true) }}>Review</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {showRequestDetails && selectedSeller?.sellerStatus === "pending" && (
                      <div className="seller-review-details">
                        <div className="seller-detail-heading">
                          <div>
                            <span className="admin-eyebrow">
                              APPLICATION DETAILS
                            </span>
                            <h3>{text(profile.businessName, "New seller")}</h3>
                          </div>
                          <button
                            className="admin-icon-button"
                            type="button"
                            aria-label="Close application details"
                            onClick={() => setShowRequestDetails(false)}
                          >
                            <X size={17} />
                          </button>
                        </div>
                        <div className="seller-detail-grid">
                          <div>
                            <span>GSTIN</span>
                            <strong>{text(profile.gstin)}</strong>
                          </div>
                          <div>
                            <span>BUSINESS NAME</span>
                            <strong>{sellerName}</strong>
                          </div>
                          <div>
                            <span>PRIMARY CONTACT</span>
                            <strong>
                              {text(profile.primaryName, contactName)}
                            </strong>
                          </div>
                          <div>
                            <span>CONTACT EMAIL</span>
                            <strong>
                              {text(profile.primaryEmail, identity.email)}
                            </strong>
                          </div>
                          <div>
                            <span>CONTACT PHONE</span>
                            <strong>
                              {text(profile.primaryPhone, identity.phone)}
                            </strong>
                          </div>
                          <div>
                            <span>BUSINESS OWNER</span>
                            <strong>
                              {profile.sameOwner
                                ? "Same as primary contact"
                                : text(profile.ownerName)}
                            </strong>
                          </div>
                          {profile.sameOwner !== true && <>
                            <div><span>OWNER EMAIL</span><strong>{text(profile.ownerEmail)}</strong></div>
                            <div><span>OWNER PHONE</span><strong>{text(profile.ownerPhone)}</strong></div>
                          </>}
                          <div className="detail-wide">
                            <span>SELLER ADDRESS</span>
                            <strong>
                              {text(profile.sellerAddress)},{" "}
                              {text(profile.sellerCity)},{" "}
                              {text(profile.sellerState)}{" "}
                              {text(profile.sellerPincode)}
                            </strong>
                          </div>
                          <div className="detail-wide">
                            <span>WAREHOUSE ADDRESS</span>
                            <strong>
                              {profile.sameWarehouse
                                ? "Same as seller address"
                                : `${text(profile.warehouseAddress)}, ${text(profile.warehouseCity)}, ${text(profile.warehouseState)} ${text(profile.warehousePincode)}`}
                            </strong>
                          </div>
                          <div>
                            <span>BUSINESS SIGNATURE</span>
                            {profile.signature ? <a href={`/api/admin/sellers/${selectedSeller._id}/signature`} target="_blank" rel="noreferrer">View signature</a> : <strong>Not uploaded</strong>}
                          </div>
                          <div>
                            <span>SELLING THROUGH</span>
                            <strong>
                              {profile.sellingMode === "independent"
                                ? text(profile.websiteUrl)
                                : text(profile.marketplaceName)}
                            </strong>
                          </div>
                          <div><span>BANK</span><strong>{text(profile.bankName)} · {text(profile.accountType)}</strong></div>
                          <div><span>IFSC</span><strong>{text(profile.ifsc)}</strong></div>
                          <div><span>BANK ACCOUNT</span><strong>•••• {text(profile.accountNumberLast4)}</strong></div>
                          <div>
                            <span>ACCOUNT HOLDER</span>
                            <strong>{text(profile.accountHolder)}</strong>
                          </div>
                          {profile.sellingMode === "marketplace" && <div><span>MARKETPLACE RATING</span><strong>{text(profile.marketplaceRating)}</strong></div>}
                        </div>
                        <div className="review-decision">
                          <span>
                            <ShieldCheck size={15} /> Verify documents before
                            approval.
                          </span>
                          <button
                            className="admin-success-button"
                            type="button"
                            onClick={() => selectedSeller && void approveSeller(selectedSeller._id, "approved")}
                          >
                            <Check size={15} /> Approve seller
                          </button>
                          <button className="admin-decline-button" type="button" onClick={() => selectedSeller && void approveSeller(selectedSeller._id, "rejected")}><X size={14} /> Reject</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="admin-empty-state">
                    <span>
                      <ClipboardCheck size={23} />
                    </span>
                    <h3>No seller requests</h3>
                    <p>
                      New seller applications will appear here when submitted
                      from Seller Studio.
                    </p>
                    <a href={SELLER_PORTAL_URL}>
                      Open seller studio <ArrowRight size={14} />
                    </a>
                  </div>
                )}
              </section>
            )}

            {registryTab === "approved" && (
              <section className="admin-panel">
                <div className="admin-panel-title">
                  <div>
                    <span className="admin-eyebrow">VERIFIED ACCOUNTS</span>
                    <h2>Approved sellers</h2>
                  </div>
                  <span className="admin-queue-count">
                    {approvedSellers.length} ACTIVE
                  </span>
                </div>
                {approvedSellers.length > 0 ? (
                  <div className="registry-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>SELLER</th>
                          <th>CONTACT</th>
                          <th>BUSINESS TYPE</th>
                          <th>LIVE PRODUCTS</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
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
                  <div className="admin-empty-state">
                    <span>
                      <Users size={23} />
                    </span>
                    <h3>No approved sellers yet</h3>
                    <p>
                      Approve a seller request to add their account to the
                      registry.
                    </p>
                    <button
                      type="button"
                      onClick={() => setRegistryTab("requests")}
                    >
                      View requests <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </section>
            )}

            {registryTab === "top" && (
              <section className="admin-panel">
                <div className="admin-panel-title">
                  <div>
                    <span className="admin-eyebrow">SELLER PERFORMANCE</span>
                    <h2>Top sellers</h2>
                  </div>
                  <span className="admin-queue-count">RANKED LIST</span>
                </div>
                {topSellers.length > 0 ? (
                  <>
                    <div className="registry-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>RANK</th>
                            <th>SELLER</th>
                            <th>SALES</th>
                            <th>CUSTOMER RATING</th>
                            <th>LIVE PRODUCTS</th>
                            <th>SCORE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topSellers.map((seller, index) => {
                            const metrics = seller.metrics;
                            return <tr key={seller._id}>
                              <td><span className={`seller-rank${index < 3 ? ` is-top-${index + 1}` : ""}`}>{String(index + 1).padStart(2, "0")}</span></td>
                              <td><strong>{text(seller.application.businessName, "New seller")}</strong><small>{seller.email}</small></td>
                              <td><strong>{rupees(metrics?.revenue ?? 0)}</strong><small>{metrics?.unitsSold ?? 0} units · {metrics?.orderCount ?? 0} order{metrics?.orderCount === 1 ? "" : "s"}</small></td>
                              <td>{metrics?.reviewCount ? <><strong className="seller-rating"><Star size={13} /> {metrics.averageRating.toFixed(1)}</strong><small>{metrics.reviewCount.toLocaleString("en-IN")} review{metrics.reviewCount === 1 ? "" : "s"}</small></> : <small>No reviews yet</small>}</td>
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
                  <div className="admin-empty-state">
                    <span>
                      <TrendingUp size={23} />
                    </span>
                    <h3>Top sellers will show here</h3>
                    <p>Approved seller activity will populate this ranking.</p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {screen === "product-approvals" && (
          <div className="admin-page">
            <div className="admin-page-heading">
              <div>
                <span className="admin-eyebrow">CATALOG MANAGEMENT</span>
                <h1>Product Approval</h1>
                <p>
                  Review seller submissions before they enter the product
                  inventory.
                </p>
              </div>
              <span className="registry-total">
                <Clock3 size={15} /> {pendingProducts.length} awaiting review
              </span>
            </div>
            <section className="admin-panel">
              <div className="admin-panel-title">
                <div>
                  <span className="admin-eyebrow">SUBMISSION QUEUE</span>
                  <h2>Products for review</h2>
                </div>
                <span className="admin-queue-count">
                  {pendingProducts.length.toString().padStart(2, "0")} PENDING
                </span>
              </div>
              {pendingProducts.length ? (
                <div className="approval-list">
                  {pendingProducts.map((product) => (
                    <article className="approval-card" key={product.id}>
                      <button
                        className="approval-image-button"
                        type="button"
                        onClick={() => openProduct(product.id)}
                        title="View product details"
                      >
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" />
                        ) : (
                          <span>
                            <Package size={22} />
                          </span>
                        )}
                      </button>
                      <div className="approval-product-copy">
                        <span className="admin-eyebrow">
                          {product.id}&nbsp; / &nbsp;{product.category} ·{" "}
                          {product.subcategory}
                        </span>
                        <h3>{product.name}</h3>
                        <p>{product.tagline}</p>
                        <span className="approval-price">
                          ₹{Number(product.cost).toLocaleString("en-IN")}{" "}
                          <i>·</i> actual seller price · {stockTotal(product)} units
                        </span>
                      </div>
                      <div className="approval-actions">
                        <label className="margin-field">
                          <span>ADMIN MARGIN (%)</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={marginByProduct[product.id] ?? "5"}
                            onChange={(event) => setMarginByProduct((current) => ({ ...current, [product.id]: event.target.value }))}
                            aria-label={`Admin margin for ${product.name}`}
                          />
                        </label>
                        <button
                          className="admin-outline-button"
                          type="button"
                          onClick={() => openProduct(product.id)}
                        >
                          Review details
                        </button>
                        <button
                          className="admin-success-button"
                          type="button"
                          onClick={() => reviewProduct(product.id, "approved")}
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          className="admin-decline-button"
                          type="button"
                          onClick={() => reviewProduct(product.id, "rejected")}
                        >
                          <X size={14} /> Decline
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="admin-empty-state">
                  <span>
                    <FileCheck2 size={23} />
                  </span>
                  <h3>No products waiting for approval</h3>
                  <p>New seller submissions will appear in this queue.</p>
                  <button type="button" onClick={() => setScreen("inventory")}>
                    View product inventory <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {screen === "sales" && (
          <div className="admin-page">
            <div className="admin-page-heading"><div><span className="admin-eyebrow">ORDER MANAGEMENT</span><h1>Category Sales</h1><p>Sales for each category by {salesPeriod}. Amounts are item value before GST and delivery; cancelled orders and accepted returns are not counted.</p></div>
              <div className="admin-segmented" role="group" aria-label="Group sales by">{(["day", "month", "year"] as const).map((option) => <button className={salesPeriod === option ? "active" : ""} type="button" aria-pressed={salesPeriod === option} onClick={() => setSalesPeriod(option)} key={option}>{option === "day" ? "Day" : option === "month" ? "Month" : "Year"}</button>)}</div>
            </div>
            <div className="admin-metrics">
              <div><span>SALES <TrendingUp size={16} /></span><strong className="admin-metric-money">{rupees(Math.round(totalSales))}</strong><small>{salesReport?.sinceDays ? `Last ${salesReport.sinceDays === 730 ? "24 months" : `${salesReport.sinceDays} days`}` : "All time"}</small></div>
              <div><span>UNITS SOLD <Package size={16} /></span><strong>{totalUnits.toString().padStart(2, "0")}</strong><small>{totalReturnedUnits ? `${totalReturnedUnits} returned and excluded` : "Net of returns"}</small></div>
              <div><span>ORDERS <PackageCheck size={16} /></span><strong>{totalSalesOrders.toString().padStart(2, "0")}</strong><small>Across {salesPeriodKeys.length} {salesPeriod}{salesPeriodKeys.length === 1 ? "" : "s"}</small></div>
              <div><span>TOP CATEGORY <BarChart3 size={16} /></span><strong className="admin-metric-text">{categoryTotals[0]?.category || "—"}</strong><small>{categoryTotals[0] ? `${Math.round(categoryTotals[0].sales / (totalSales || 1) * 100)}% of sales` : "No sales yet"}</small></div>
            </div>
            {!salesReport || salesReport.period !== salesPeriod ? <div className="admin-loading-strip">Loading sales…</div> : !salesRows.length ? <section className="admin-panel"><div className="admin-empty-state"><span><BarChart3 size={23} /></span><h3>No sales in this range</h3><p>Category sales appear here once customers place orders.</p></div></section> : <>
              <section className="admin-panel admin-sales-panel"><div className="admin-panel-title"><div><span className="admin-eyebrow">BY CATEGORY</span><h2>Category share</h2></div></div>
                <div className="admin-category-bars">{categoryTotals.map((entry) => <details className="admin-category-bar" key={entry.category}>
                  <summary><span className="admin-category-name">{entry.category}</span><span className="admin-bar-track"><span style={{ width: `${Math.max(2, entry.sales / (categoryTotals[0].sales || 1) * 100)}%` }} /></span><b>{rupees(entry.sales)}</b><small>{entry.units} unit{entry.units === 1 ? "" : "s"} · {Math.round(entry.sales / (totalSales || 1) * 100)}%</small></summary>
                  <div className="admin-subcategories">{Object.entries(entry.subcategories).sort((a, b) => b[1].sales - a[1].sales).map(([name, sub]) => <span key={name}><strong>{name}</strong>{rupees(sub.sales)} · {sub.units} unit{sub.units === 1 ? "" : "s"}</span>)}</div>
                </details>)}</div>
              </section>
              <section className="admin-panel admin-sales-panel"><div className="admin-panel-title"><div><span className="admin-eyebrow">BY {salesPeriod.toUpperCase()}</span><h2>{salesPeriod === "day" ? "Daily" : salesPeriod === "month" ? "Monthly" : "Yearly"} sales by category</h2></div></div>
                <div className="registry-table-wrap"><table className="admin-table admin-sales-table"><thead><tr><th>{salesPeriod.toUpperCase()}</th>{categoryTotals.map((entry) => <th key={entry.category}>{entry.category.toUpperCase()}</th>)}<th>TOTAL</th><th>ORDERS</th></tr></thead>
                  <tbody>{salesPeriodKeys.map((key) => { const cells = categoryTotals.map((entry) => salesCell(key, entry.category)); const rowTotal = cells.reduce((total, cell) => total + cell.sales, 0); return <tr key={key}><td><strong>{periodLabel(key, salesPeriod)}</strong></td>{cells.map((cell, index) => <td key={categoryTotals[index].category}>{cell.units ? <>{rupees(cell.sales)}<small>{cell.units} unit{cell.units === 1 ? "" : "s"}</small></> : <span className="admin-muted-cell">—</span>}</td>)}<td><strong>{rupees(rowTotal)}</strong></td><td>{salesReport.periods[key] || 0}</td></tr> })}</tbody>
                  <tfoot><tr><td><strong>Total</strong></td>{categoryTotals.map((entry) => <td key={entry.category}><strong>{rupees(entry.sales)}</strong><small>{entry.units} unit{entry.units === 1 ? "" : "s"}</small></td>)}<td><strong>{rupees(totalSales)}</strong></td><td><strong>{totalSalesOrders}</strong></td></tr></tfoot>
                </table></div>
              </section>
            </>}
          </div>
        )}
        {screen === "customers" && (
          <div className="admin-page">
            <div className="admin-page-heading"><div><span className="admin-eyebrow">ORDER MANAGEMENT</span><h1>Customers</h1><p>Order history grouped by customer. Open a customer to see each of their orders.</p></div><span className="registry-total"><UserRound size={15} /> {customers.length} customers</span></div>
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
                  <span><b>{customer.orderCount}</b><small>order{customer.orderCount === 1 ? "" : "s"}{customer.activeOrders ? ` · ${customer.activeOrders} active` : ""}</small></span>
                  <span><b>{customer.unitCount}</b><small>units</small></span>
                  <span><b>{rupees(customer.totalSpent)}</b><small>order value</small></span>
                  <span><b>{customer.returnCount}</b><small>return{customer.returnCount === 1 ? "" : "s"}</small></span>
                  <span><b>{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</b><small>last order</small></span>
                  <ChevronRight className="admin-customer-chevron" size={16} />
                </summary>
                {customer.orders.length ? <div className="admin-customer-orders">{customer.orders.map((order) => <article className="admin-customer-order" key={order._id}>
                  <header><span><strong>Order {order._id.slice(-8).toUpperCase()}</strong><small>{new Date(order.createdAt).toLocaleString("en-IN")}{order.shippingAddress?.city ? ` · ${order.shippingAddress.city} ${order.shippingAddress.pincode || ""}` : ""}</small></span><span className={`admin-status ${order.status === "delivered" ? "status-active" : order.status === "cancelled" ? "status-rejected" : "status-review"}`}>{orderStatusLabels[order.status] || order.status}</span><b>{rupees(order.total)}</b></header>
                  <div className="registry-table-wrap"><table><thead><tr><th>PRODUCT</th><th>SELLER</th><th>SIZE</th><th>QTY</th><th>UNIT PRICE</th><th>RETURN</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={item._id || index}><td>{item.name}</td><td>{item.sellerName}</td><td>{item.size || "—"}</td><td>{item.quantity}</td><td>{rupees(item.unitPrice)}</td><td>{item.returnRequest ? <span className={`admin-status ${returnStatusClass[item.returnRequest.status]}`}>{returnStatusLabels[item.returnRequest.status]}</span> : "—"}</td></tr>)}</tbody></table></div>
                </article>)}</div> : <p className="admin-customer-empty">This customer hasn’t placed an order yet.</p>}
              </details>)}</div> : <div className="admin-empty-state"><span><UserRound size={23} /></span><h3>{customers.length ? "No matching customers" : "No customers yet"}</h3><p>{customers.length ? "Try a different name, email, mobile number or customer ID." : "Customer accounts will appear here once people sign up on the store."}</p></div>}
            </section>
          </div>
        )}
        {screen === "returns" && (
          <div className="admin-page">
            <div className="admin-page-heading"><div><span className="admin-eyebrow">ORDER MANAGEMENT</span><h1>Returns</h1><p>Return requests from customers after delivery. Each request is answered by the item’s seller. A delivery partner collects each accepted return and brings it back to the seller, and it goes back into stock then.</p></div><span className="registry-total"><RotateCcw size={15} /> {openReturnCount} awaiting seller</span></div>
            <section className="admin-panel"><div className="admin-panel-title"><div><span className="admin-eyebrow">RETURN REQUESTS</span><h2>All returns</h2></div><span className="admin-return-summary">{returnEntries.filter((entry) => entry.request.status === "approved").length} accepted · {returnEntries.filter((entry) => entry.request.status === "rejected").length} rejected</span></div>
              {returnEntries.length ? <div className="registry-table-wrap"><table className="admin-table admin-returns-table"><thead><tr><th>PRODUCT / SELLER</th><th>ORDER / CUSTOMER</th><th>CUSTOMER REASON</th><th>STATUS</th><th>SELLER MESSAGE</th></tr></thead><tbody>{returnEntries.map(({ order, item, request }) => <tr key={item._id}>
                <td className="admin-wrap-cell admin-return-product"><strong>{item.name}</strong><small>{item.size && item.size !== "One size" ? `Size ${item.size} · ` : ""}Qty {item.quantity} · ₹{Number((item.unitPrice || 0) * item.quantity).toLocaleString("en-IN")}</small><small>Seller: {item.sellerName}</small></td>
                <td><strong>{order._id.slice(-8).toUpperCase()}</strong><small>{order.customerId}</small></td>
                <td className="admin-wrap-cell"><strong>{request.reason}</strong><small>“{request.message}”</small><small>Requested {new Date(request.requestedAt).toLocaleString("en-IN")}</small></td>
                <td><span className={`admin-status ${returnStatusClass[request.status]}`}>{returnStatusLabels[request.status]}</span>{request.resolvedAt && <small>{new Date(request.resolvedAt).toLocaleDateString("en-IN")}{request.restockedQuantity ? ` · +${request.restockedQuantity} restocked` : ""}</small>}{item.returnPickup && <small>{returnPickupLabels[item.returnPickup.status]}{item.returnPickup.partner && item.returnPickup.status !== "returned" ? ` · ${item.returnPickup.partner.name} (${item.returnPickup.partner.phone})` : ""}</small>}</td>
                <td className="admin-wrap-cell">{request.sellerMessage ? `“${request.sellerMessage}”` : "—"}</td>
              </tr>)}</tbody></table></div> : <div className="admin-empty-state"><span><RotateCcw size={23} /></span><h3>No return requests yet</h3><p>When a customer asks to return a delivered item, it will appear here with the seller’s decision.</p></div>}
            </section>
          </div>
        )}
        {screen === "orders" && (
          <div className="admin-page">
            <div className="admin-page-heading"><div><span className="admin-eyebrow">ORDER MANAGEMENT</span><h1>Customer Orders</h1><p>Orders are identified by customer ID and routed to the relevant sellers.</p></div><span className="registry-total"><PackageCheck size={15} /> {orders.length} orders</span></div>
            <section className="admin-panel"><div className="admin-panel-title"><div><span className="admin-eyebrow">ORDER QUEUE</span><h2>Recent orders</h2></div></div>
              {orders.length ? <div className="registry-table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>CUSTOMER ID</th><th>ITEMS</th><th>TOTAL</th><th>PAYMENT</th><th>STATUS</th></tr></thead><tbody>{orders.map((order) => <tr key={order._id}><td colSpan={6}><details className="admin-order-details"><summary><span><strong>{order._id.slice(-8).toUpperCase()}</strong><small>{new Date(order.createdAt).toLocaleString('en-IN')}</small></span><span>{order.customerId}</span><span>{order.items.reduce((total, item) => total + Number(item.quantity || 0), 0)} products</span><span>₹{Number(order.total || 0).toLocaleString('en-IN')}</span><span>{paymentMethodLabels[order.paymentMethod || "cod"]} <span className={`admin-status ${paymentStatusClass[order.paymentStatus || "pending"]}`}>{paymentStatusLabels[order.paymentStatus || "pending"]}</span></span><span className="admin-status status-review">{order.status}</span></summary><div className="admin-order-payment"><span><Truck size={14} /> Delivery partner: {order.deliveryPartner ? <strong className="admin-partner-name">{order.deliveryPartner.name} · {order.deliveryPartner.phone}</strong> : <span>{order.status === "placed" ? "available to partners once the seller packs it" : canAssignPartner(order) ? "not assigned yet" : "—"}</span>}</span>{canAssignPartner(order) && <span className="admin-order-payment-actions">{renderPartnerSelect(order)}</span>}</div>{order.paymentMethod && order.paymentMethod !== "cod" && <div className="admin-order-payment"><span>{order.paymentMethod === "upi" ? <>UPI transaction ID (UTR): <strong>{order.upiTransactionId || "—"}</strong></> : order.paymentMethod === "phonepe" ? <>PhonePe transaction ID: <strong>{order.phonepeTransactionId || "—"}</strong></> : <>Razorpay payment ID: <strong>{order.razorpayPaymentId || "—"}</strong></>}{order.paidAt && <small> · Paid {new Date(order.paidAt).toLocaleString("en-IN")}</small>}</span>{order.paymentStatus === "awaiting_verification" && <span className="admin-order-payment-actions"><small>Check that {rupees(order.total)} arrived with this UTR before confirming.</small><button className="admin-button-confirm" type="button" onClick={() => void decideUpiPayment(order, "paid")}>Confirm payment</button><button className="admin-button-reject" type="button" onClick={() => void decideUpiPayment(order, "rejected")}>Reject</button></span>}</div>}<div className="admin-order-items"><table><thead><tr><th>PRODUCT</th><th>SELLER</th><th>QUANTITY</th><th>UNIT COST</th><th>RETURN</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={`${order._id}-${index}`}><td>{item.name}</td><td>{item.sellerName}</td><td>{item.quantity}</td><td>₹{Number(item.unitPrice || 0).toLocaleString('en-IN')}</td><td>{item.returnRequest ? <button className={`admin-status admin-status-link ${returnStatusClass[item.returnRequest.status]}`} type="button" onClick={() => setScreen("returns")}>{returnStatusLabels[item.returnRequest.status]}</button> : "—"}</td></tr>)}</tbody></table></div></details></td></tr>)}</tbody></table></div> : <div className="admin-empty-state"><span><PackageCheck size={23} /></span><h3>No customer orders yet</h3><p>Placed orders will appear here with their customer IDs.</p></div>}
            </section>
          </div>
        )}

        {screen === "delivery" && (
          <div className="admin-page">
            <div className="admin-page-heading"><div><span className="admin-eyebrow">ORDER MANAGEMENT</span><h1>Delivery Partners</h1><p>People apply to deliver from the partner app at <a className="admin-inline-link" href={DELIVERY_APP_URL} target="_blank" rel="noreferrer">{DELIVERY_APP_URL.replace(/^https?:\/\//, "")}</a>. Once you approve them, they accept orders from the open pool themselves.</p></div><span className="registry-total"><Truck size={15} /> {partners.filter(assignable).length} active partners</span></div>

            <section className="admin-panel delivery-panel"><div className="admin-panel-title"><div><span className="admin-eyebrow">APPLICATIONS</span><h2>Waiting for review</h2></div><span className={`admin-status ${pendingApplications.length ? "status-review" : "status-muted"}`}>{pendingApplications.length}</span></div>
              {pendingApplications.length ? <div className="application-list">{pendingApplications.map((partner) => <article className="application-card" key={partner._id}>
                <div className="application-main">
                  <strong>{partner.name}</strong>
                  <small>Applied {new Date(partner.appliedAt).toLocaleString("en-IN")}</small>
                  <dl>
                    <div><dt>Mobile</dt><dd>{partner.phone}</dd></div>
                    <div><dt>Email</dt><dd>{partner.email}</dd></div>
                    <div><dt>Vehicle</dt><dd>{partner.vehicleType}{partner.vehicleNumber ? ` · ${partner.vehicleNumber}` : ""}</dd></div>
                    <div><dt>Driving licence</dt><dd>{partner.licenceNumber || "— (bicycle)"}</dd></div>
                    <div><dt>Documents</dt><dd>{renderPartnerDocuments(partner)}</dd></div>
                    <div><dt>Area</dt><dd>{partner.area}</dd></div>
                  </dl>
                </div>
                {rejecting?.id === partner._id
                  ? <form className="application-reject" onSubmit={(event) => { event.preventDefault(); void reviewApplication(partner, "rejected", rejecting.note); }}>
                    <label className="admin-field"><span>Reason the applicant will see</span><textarea rows={3} maxLength={300} placeholder="e.g. The licence number doesn’t match a valid licence. Please check it and resubmit." value={rejecting.note} onChange={(event) => setRejecting({ id: partner._id, note: event.target.value })} autoFocus required minLength={5} /></label>
                    <div className="application-actions"><button className="admin-outline-button" type="button" onClick={() => setRejecting(null)}>Cancel</button><button className="admin-decline-button" type="submit" disabled={rejecting.note.trim().length < 5}>Reject application</button></div>
                  </form>
                  : <div className="application-actions"><button className="admin-decline-button" type="button" onClick={() => setRejecting({ id: partner._id, note: "" })}>Reject</button><button className="admin-success-button" type="button" onClick={() => void reviewApplication(partner, "approved")}><Check size={15} /> Approve</button></div>}
              </article>)}</div> : <div className="admin-empty-state compact-empty"><span><ClipboardCheck size={21} /></span><h3>No applications to review</h3><p>New delivery partner applications appear here.</p></div>}
            </section>

            <section className="admin-panel delivery-panel"><div className="admin-panel-title"><div><span className="admin-eyebrow">OPEN POOL</span><h2>Packed orders not yet accepted</h2></div><span className="admin-status status-review">{unassignedOrders.length}</span></div>
              <p className="panel-hint">An order appears here, and in the partners’ app, once its seller marks it packed. Partners accept the ones they want; you can also assign one directly.</p>
              {unassignedOrders.length ? <div className="registry-table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>DELIVER TO</th><th>STATUS</th><th>PAYMENT</th><th>ASSIGN</th></tr></thead><tbody>{unassignedOrders.map((order) => <tr key={order._id}><td><strong>{order._id.slice(-8).toUpperCase()}</strong><small>{new Date(order.createdAt).toLocaleString("en-IN")}</small></td><td><strong>{order.shippingAddress?.name || "Customer"}</strong><small>{[order.shippingAddress?.city, order.shippingAddress?.pincode].filter(Boolean).join(" ") || "—"}</small></td><td><span className={`admin-status ${order.status === "packed" ? "status-active" : "status-muted"}`}>{orderStatusLabels[order.status] || order.status}</span></td><td>{paymentMethodLabels[order.paymentMethod || "cod"]}<small>{rupees(order.total)}</small></td><td>{partners.some(assignable) ? renderPartnerSelect(order) : <small>No approved partners yet</small>}</td></tr>)}</tbody></table></div> : <div className="admin-empty-state compact-empty"><span><PackageCheck size={21} /></span><h3>No packed orders waiting</h3><p>Orders show up here once their seller packs them, until a partner accepts them.</p></div>}
            </section>

            <div className={editingPartnerId ? "delivery-grid" : ""}>
              {editingPartnerId && <section className="admin-panel"><div className="admin-panel-title"><div><span className="admin-eyebrow">EDIT PARTNER</span><h2>{partnerDraft.name || "Edit partner"}</h2></div><button className="admin-outline-button" type="button" onClick={resetPartnerForm}>Cancel</button></div>
                <form className="partner-form" onSubmit={savePartner}>
                  <label className="admin-field"><span>Full name</span><input value={partnerDraft.name} maxLength={80} onChange={(event) => setPartnerDraft({ ...partnerDraft, name: event.target.value })} required /></label>
                  <label className="admin-field"><span>Mobile number</span><input inputMode="numeric" maxLength={10} value={partnerDraft.phone} onChange={(event) => setPartnerDraft({ ...partnerDraft, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })} required /></label>
                  <label className="admin-field partner-wide"><span>Email</span><input type="email" autoComplete="off" value={partnerDraft.email} onChange={(event) => setPartnerDraft({ ...partnerDraft, email: event.target.value })} required /></label>
                  <label className="admin-field"><span>Vehicle</span><select value={partnerDraft.vehicleType} onChange={(event) => setPartnerDraft({ ...partnerDraft, vehicleType: event.target.value })}>{vehicleTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
                  <label className="admin-field"><span>Vehicle number</span><input placeholder="KA01AB1234" maxLength={14} value={partnerDraft.vehicleNumber} onChange={(event) => setPartnerDraft({ ...partnerDraft, vehicleNumber: event.target.value.toUpperCase() })} /></label>
                  <label className="admin-field partner-wide"><span>Driving licence</span><input placeholder="KA0120190001234" maxLength={20} value={partnerDraft.licenceNumber} onChange={(event) => setPartnerDraft({ ...partnerDraft, licenceNumber: event.target.value.toUpperCase() })} /></label>
                  <label className="admin-field partner-wide"><span>Delivery area</span><input maxLength={80} value={partnerDraft.area} onChange={(event) => setPartnerDraft({ ...partnerDraft, area: event.target.value })} required /></label>
                  <label className="admin-field partner-wide"><span>Reset password (leave blank to keep the current one)</span><input type="text" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" value={partnerDraft.password} onChange={(event) => setPartnerDraft({ ...partnerDraft, password: event.target.value })} /></label>
                  {partnerFormError && <p className="admin-login-error partner-wide" role="alert">{partnerFormError}</p>}
                  <p className="partner-note partner-wide">Partners have no “forgot password” option; reset it here and share the new one with them.</p>
                  <button className="admin-success-button partner-wide" type="submit" disabled={savingPartner}>{savingPartner ? "Saving…" : "Save changes"}</button>
                </form>
              </section>}

              <section className="admin-panel"><div className="admin-panel-title"><div><span className="admin-eyebrow">TEAM</span><h2>Partners</h2></div><span className="registry-total">{reviewedPartners.length}</span></div>
                {reviewedPartners.length ? <div className="registry-table-wrap"><table className="admin-table"><thead><tr><th>PARTNER</th><th>VEHICLE</th><th>ORDERS</th><th>STATUS</th><th /></tr></thead><tbody>{reviewedPartners.map((partner) => <tr key={partner._id} className={assignable(partner) ? "" : "is-inactive"}><td><strong>{partner.name}</strong><small>{partner.phone} · {partner.email}</small>{partner.area && <small>{partner.area}</small>}</td><td>{partner.vehicleType}<small>{partner.vehicleNumber || "—"}</small></td><td>{partner.activeOrders} open<small>{partner.deliveredOrders} delivered</small></td><td><span className={`admin-status ${partner.status === "rejected" ? "status-rejected" : partner.active ? "status-active" : "status-muted"}`}>{partner.status === "rejected" ? "Rejected" : partner.active ? "Active" : "Inactive"}</span>{partner.status === "rejected" && <small className="partner-reason" title={partner.reviewNote}>{partner.reviewNote}</small>}</td><td>{partner.status === "approved" && <div className="partner-actions"><button className="admin-outline-button" type="button" onClick={() => editPartner(partner)}>Edit</button>{partner.active ? <button className="admin-decline-button" type="button" onClick={() => void setPartnerActive(partner, false)}>Deactivate</button> : <button className="admin-outline-button" type="button" onClick={() => void setPartnerActive(partner, true)}>Reactivate</button>}</div>}</td></tr>)}</tbody></table></div> : <div className="admin-empty-state compact-empty"><span><Truck size={21} /></span><h3>No delivery partners yet</h3><p>Approved applicants appear here.</p></div>}
              </section>
            </div>
          </div>
        )}

        {screen === "inventory" && (
          <div className="admin-page">
            <div className="admin-page-heading">
              <div>
                <span className="admin-eyebrow">CATALOG MANAGEMENT</span>
                <h1>Product Inventory</h1>
                <p>
                  Approved products are ready to open as customer-facing product
                  pages.
                </p>
              </div>
              <span className="registry-total">
                <Boxes size={15} /> {approvedProducts.length} products
              </span>
            </div>
            {lowStockProducts.length > 0 && (
              <section className="admin-panel low-stock-panel">
                <div className="admin-panel-title"><div><span className="admin-eyebrow">LOW STOCK ALERT</span><h2>{lowStockProducts.length} products below 5 units</h2></div><span className="low-stock-count"><Bell size={15} /> {lowStockProducts.length}</span></div>
                <div className="low-stock-list">
                  {lowStockProducts.map((product) => (
                    <article className="low-stock-row" key={product.id}>
                      <button className="inventory-product-link" type="button" onClick={() => openProduct(product.id)}>
                        {product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="inventory-thumb-placeholder"><Package size={17} /></span>}
                        <span><strong>{product.name}</strong><small>{productSellerName(product)}</small></span>
                      </button>
                      <div className="low-stock-sizes"><small>{stockTotal(product)} units left</small>{stockChips(product.stock)}</div>
                      <div className="low-stock-action">{restockAction(product)}</div>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {restockRequests.length > 0 && (
              <section className="admin-panel">
                <div className="admin-panel-title"><div><span className="admin-eyebrow">SELLER RESTOCKS</span><h2>Restock requests</h2></div><PackageCheck size={17} /></div>
                <div className="registry-table-wrap"><table className="admin-table"><thead><tr><th>PRODUCT</th><th>SELLER</th><th>STATUS</th><th>ASKED FOR</th><th>STOCK ADDED</th><th>REQUESTED</th></tr></thead><tbody>{restockRequests.slice(0, 10).map((entry) => <tr key={entry._id}><td><strong>{entry.product?.name ?? "Product"}</strong></td><td>{text(entry.seller?.application?.businessName, entry.seller?.email ?? "Seller")}</td><td><span className={`admin-status ${entry.status === "fulfilled" ? "status-active" : entry.status === "open" ? "status-review" : "status-muted"}`}>{entry.status === "open" ? "Awaiting seller" : entry.status === "fulfilled" ? "Restocked" : "Cancelled"}</span></td><td>{stockSummary(entry.requestedStock) || "-"}</td><td>{stockSummary(entry.addedStock, "+") || "-"}</td><td>{new Date(entry.createdAt).toLocaleString("en-IN")}</td></tr>)}</tbody></table></div>
              </section>
            )}
            <section className="admin-panel">
              <div className="admin-panel-title"><div><span className="admin-eyebrow">SALES PERFORMANCE</span><h2>Fastest-selling products</h2></div><TrendingUp size={17} /></div>
              {fastSelling.length ? <div className="registry-table-wrap"><table className="admin-table"><thead><tr><th>PRODUCT</th><th>UNITS SOLD</th><th>AVAILABLE BY SIZE</th></tr></thead><tbody>{fastSelling.map((product) => <tr key={product._id}><td><strong>{product.name}</strong></td><td>{product.unitsSold}</td><td>{stockChips(product.availableStock)}</td></tr>)}</tbody></table></div> : <div className="admin-empty-state"><h3>No sales yet</h3><p>Fast-selling products appear here once customers place orders.</p></div>}
            </section>
            <section className="admin-panel">
              <div className="admin-panel-title">
                <div>
                  <span className="admin-eyebrow">APPROVED CATALOG</span>
                  <h2>Inventory</h2>
                </div>
                <span className="admin-status status-active">
                  <BadgeCheck size={12} /> APPROVED
                </span>
              </div>
              {visibleInventory.length ? (
                <div className="registry-table-wrap">
                  <table className="admin-table inventory-table">
                    <thead>
                      <tr>
                        <th>PRODUCT</th>
                        <th>CATEGORY</th>
                        <th>SELLER</th>
                        <th>UNIT COST</th>
                        <th>STOCK</th>
                        <th>RESTOCK</th>
                        <th>SALE %</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleInventory.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <button
                              className="inventory-product-link"
                              type="button"
                              onClick={() => openProduct(product.id)}
                            >
                              {product.imageUrl ? (
                                <img src={product.imageUrl} alt="" />
                              ) : (
                                <span className="inventory-thumb-placeholder">
                                  <Package size={17} />
                                </span>
                              )}
                              <span>
                                <strong>{product.name}</strong>
                                <small>{product.id}</small>
                              </span>
                            </button>
                          </td>
                          <td>
                            {product.category}
                            <small>{product.subcategory}</small>
                          </td>
                          <td>{productSellerName(product)}</td>
                          <td>
                            ₹{Number(product.cost).toLocaleString("en-IN")}
                          </td>
                          <td>
                            {stockTotal(product)} units
                            <small>{Object.entries(product.stock ?? {}).map(([size, count]) => `${size}: ${count}`).join(", ")}</small>
                          </td>
                          <td>{restockAction(product)}</td>
                          <td>
                            <span className="margin-field">
                              <input type="number" min="0" max="100" aria-label={`Sale percent for ${product.name}`} value={saleInput[product.id] ?? String(product.salePercent ?? 0)} onChange={(event) => setSaleInput((current) => ({ ...current, [product.id]: event.target.value }))} />
                              <button type="button" onClick={() => void saveSale(product)}>Save</button>
                            </span>
                          </td>
                          <td>
                            <button
                              className="table-arrow"
                              type="button"
                              aria-label={`Open ${product.name}`}
                              onClick={() => openProduct(product.id)}
                            >
                              <ArrowRight size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="admin-empty-state">
                  <span>
                    <Boxes size={23} />
                  </span>
                  <h3>
                    {approvedProducts.length
                      ? "No matching products"
                      : "Inventory is empty"}
                  </h3>
                  <p>
                    {approvedProducts.length
                      ? "Try another product or category search."
                      : "Approved products will move here from Product Approval."}
                  </p>
                  {approvedProducts.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setScreen("product-approvals")}
                    >
                      View product approvals <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}
            </section>
            <div className="admin-footnote">
              <span>
                <PackageCheck size={14} /> APPROVED ITEMS OPEN AS PRODUCT PAGES.
              </span>
              <span>
                INVENTORY&nbsp; / &nbsp;
                {approvedProducts.length.toString().padStart(2, "0")}
              </span>
            </div>
          </div>
        )}

        {screen === "product-page" && (
          <div className="admin-page product-detail-page">
            <button
              className="admin-back-link"
              type="button"
              onClick={() => setScreen("inventory")}
            >
              <ArrowLeft size={15} /> Back to product inventory
            </button>
            {selectedProduct ? (
              <>
                <div className="admin-page-heading product-detail-heading">
                  <div>
                    <span className="admin-eyebrow">
                      PRODUCT PAGE&nbsp; / &nbsp;{selectedProduct.id}
                    </span>
                    <h1>{selectedProduct.name}</h1>
                    <p>{selectedProduct.tagline}</p>
                  </div>
                  <span className={`admin-status ${selectedProduct.status === "approved" ? "status-active" : "status-review"}`}>
                    {selectedProduct.status === "approved" ? <><BadgeCheck size={12} /> APPROVED</> : <><Clock3 size={12} /> UNDER REVIEW</>}
                  </span>
                </div>
                <div className="product-detail-layout">
                  <div className="product-detail-image">
                    {selectedProduct.imageUrl ? (
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                      />
                    ) : (
                      <span>
                        <Package size={32} />
                      </span>
                    )}
                  </div>
                  <div className="product-detail-info">
                    <span className="admin-eyebrow">
                      {selectedProduct.category}&nbsp; / &nbsp;
                      {selectedProduct.subcategory}
                    </span>
                    <strong className="product-detail-price">
                      ₹{Number(selectedProduct.cost).toLocaleString("en-IN")}
                    </strong>
                    <p className="product-detail-description">
                      {selectedProduct.description}
                    </p>
                    <div className="product-detail-stats">
                      <div>
                        <span>SELLER</span>
                        <strong>{productSellerName(selectedProduct)}</strong>
                      </div>
                      <div>
                        <span>STATUS</span>
                        <strong className={selectedProduct.status === "approved" ? "detail-approved" : ""}>
                          {selectedProduct.status === "approved" ? <><Check size={13} /> Live in inventory</> : "Awaiting admin review"}
                        </strong>
                      </div>
                      <div>
                        <span>TOTAL STOCK</span>
                        <strong>{stockTotal(selectedProduct)} units</strong>
                      </div>
                    </div>
                    <div className="product-detail-sizes">
                      <span>AVAILABLE STOCK BY SIZE</span>
                      <div>
                        {Object.entries(selectedProduct.stock).map(
                          ([size, count]) => (
                            <div key={size}>
                              <strong>{size}</strong>
                              <span>{count} units</span>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                    <button
                      className="admin-outline-button"
                      type="button"
                      onClick={() => setScreen("inventory")}
                    >
                      <Boxes size={15} /> Back to inventory
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="admin-empty-state">
                <span>
                  <Package size={23} />
                </span>
                <h3>Product not found</h3>
                <button type="button" onClick={() => setScreen("inventory")}>
                  Return to inventory <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default AdminApp;
