import { ShieldCheck } from "lucide-react";
import AdminSidebar from "./components/AdminSidebar";
import AdminTopbar from "./components/AdminTopbar";
import { useAdmin } from "./context/AdminContext";
import CustomersPage from "./pages/CustomersPage";
import DeliveryPartnersPage from "./pages/DeliveryPartnersPage";
import InventoryPage from "./pages/InventoryPage";
import LoginPage from "./pages/LoginPage";
import OrdersPage from "./pages/OrdersPage";
import OverviewPage from "./pages/OverviewPage";
import ProductApprovalPage from "./pages/ProductApprovalPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ReturnsPage from "./pages/ReturnsPage";
import SalesPage from "./pages/SalesPage";
import SellerRegistryPage from "./pages/SellerRegistryPage";

const screens = {
  overview: OverviewPage,
  registry: SellerRegistryPage,
  "product-approvals": ProductApprovalPage,
  inventory: InventoryPage,
  "product-page": ProductDetailPage,
  orders: OrdersPage,
  returns: ReturnsPage,
  customers: CustomersPage,
  sales: SalesPage,
  delivery: DeliveryPartnersPage,
};

function App() {
  const { authReady, isAdmin, screen, pageError, isLoading } = useAdmin();

  if (!authReady)
    return (
      <main className="admin-empty-state">
        <span>
          <ShieldCheck size={23} />
        </span>
        <h3>Connecting to admin services…</h3>
      </main>
    );

  if (!isAdmin) return <LoginPage />;

  const Screen = screens[screen];
  return (
    <main className="admin-shell">
      <AdminSidebar />
      <section className="admin-main">
        <AdminTopbar />
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
        <Screen />
      </section>
    </main>
  );
}

export default App;
