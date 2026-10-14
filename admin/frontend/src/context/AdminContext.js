import { createContext, useContext, useEffect, useState } from "react";
import * as adminApi from "../api/admin";
import { errorMessage } from "../api/client";
import { text } from "../utils/format";
import { returnEntriesOf } from "../utils/orders";

const AdminContext = createContext(null);

export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside <AdminProvider>");
  return value;
}

const emptyOverview = { sellerRequests: 0, approvedSellers: 0, productRequests: 0, productInventory: 0 };

// The admin session, the current screen, and the marketplace data the screens and sidebar share.
export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [screen, setScreen] = useState("overview");
  const [registryTab, setRegistryTab] = useState("requests");
  const [activeRegistrySellerId, setActiveRegistrySellerId] = useState("");
  const [showRequestDetails, setShowRequestDetails] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageError, setPageError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [overview, setOverview] = useState(emptyOverview);
  const [sellers, setSellers] = useState([]);
  const [topSellers, setTopSellers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    let active = true;
    void adminApi.fetchCurrentUser()
      .then((user) => { if (active && user.role === "admin") setIsAdmin(true); })
      .catch(() => undefined)
      .finally(() => { if (active) setAuthReady(true); });
    return () => { active = false; };
  }, []);

  const applyMarketplace = (data) => {
    setOverview(data.overview);
    setSellers(data.sellers);
    setTopSellers(data.topSellers);
    setProducts(data.products);
    setPageError("");
  };

  // Sellers, products and counts load on sign-in and refresh every 10 seconds.
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await adminApi.fetchMarketplace();
        if (active) applyMarketplace(data);
      } catch (error) {
        if (active) setPageError(errorMessage(error, "Could not load admin data."));
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void load();
    const refreshInterval = window.setInterval(() => void load(), 10_000);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
    };
  }, [isAdmin]);

  // After a decision: reloads sellers, products and counts.
  const refreshAdminData = async () => {
    try {
      applyMarketplace(await adminApi.fetchMarketplace());
    } catch (error) {
      setPageError(errorMessage(error, "Could not refresh admin data."));
    }
  };

  // Loaded on every screen change so the sidebar's order, partner, customer and open-return counts stay current.
  // Partners also feed the delivery screen and the assign menus on the orders screen.
  useEffect(() => {
    if (!isAdmin) return;
    void adminApi.fetchOrders().then(setOrders).catch((error) => setPageError(errorMessage(error, "Could not load orders.")));
    void adminApi.fetchPartners().then(setPartners).catch((error) => setPageError(errorMessage(error, "Could not load delivery partners.")));
    void adminApi.fetchCustomers().then(setCustomers).catch((error) => setPageError(errorMessage(error, "Could not load customers.")));
  }, [isAdmin, screen]);

  const refreshPartners = async () => setPartners(await adminApi.fetchPartners());

  const signIn = () => setIsAdmin(true);
  const signOut = async () => {
    await adminApi.logout().catch(() => undefined);
    setIsAdmin(false);
    setScreen("overview");
  };

  const openProduct = (id) => {
    setSelectedProductId(id);
    setScreen("product-page");
  };
  const openRegistry = (tab) => {
    setScreen("registry");
    setRegistryTab(tab);
  };

  const pendingSellers = sellers.filter((seller) => seller.sellerStatus === "pending");
  const approvedSellers = sellers.filter((seller) => seller.sellerStatus === "approved");
  const pendingProducts = products.filter((product) => product.status === "pending");
  const approvedProducts = products.filter((product) => product.status === "approved");
  const productSellerName = (product) => {
    if (typeof product.seller === "object" && product.seller) {
      return text(product.seller.application?.businessName, product.seller.email);
    }
    const seller = sellers.find((entry) => entry._id === product.seller);
    return seller ? text(seller.application.businessName, seller.email) : "Seller";
  };
  const openReturnCount = returnEntriesOf(orders).filter((entry) => entry.request.status === "requested").length;

  const value = {
    isAdmin, authReady, signIn, signOut,
    screen, setScreen, registryTab, setRegistryTab, openRegistry, activeRegistrySellerId, setActiveRegistrySellerId, showRequestDetails, setShowRequestDetails,
    selectedProductId, openProduct, searchTerm, setSearchTerm, pageError, setPageError, isLoading,
    overview, sellers, topSellers, products, refreshAdminData, pendingSellers, approvedSellers, pendingProducts, approvedProducts, productSellerName,
    orders, setOrders, openReturnCount, customers, partners, refreshPartners,
  };
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}
