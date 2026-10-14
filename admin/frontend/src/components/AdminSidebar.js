import { BarChart3, Boxes, ClipboardCheck, FileCheck2, LayoutDashboard, LogOut, PackageCheck, RotateCcw, TrendingUp, Truck, UserRound, Users } from "lucide-react";
import { useAdmin } from "../context/AdminContext";

function AdminSidebar() {
  const { screen, setScreen, registryTab, openRegistry, signOut, pendingSellers, approvedSellers, pendingProducts, approvedProducts, orders, partners, customers, openReturnCount } = useAdmin();
  const pendingApplications = partners.filter((partner) => partner.status === "pending").length;
  const registryButton = (tab, icon, label, count) => (
    <button className={screen === "registry" && registryTab === tab ? "active" : ""} type="button" onClick={() => openRegistry(tab)}>
      {icon} {label}
      {count > 0 && <b>{count}</b>}
    </button>
  );
  const screenButton = (id, icon, label, badge, active = screen === id) => (
    <button className={active ? "active" : ""} type="button" onClick={() => setScreen(id)}>
      {icon} {label}
      {badge}
    </button>
  );

  return (
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
        {screenButton("overview", <LayoutDashboard size={17} />, "Dashboard")}
        <span className="admin-nav-heading">SELLERS</span>
        {registryButton("requests", <ClipboardCheck size={17} />, "Requests", pendingSellers.length)}
        {registryButton("approved", <Users size={17} />, "Approved sellers", approvedSellers.length)}
        {registryButton("top", <TrendingUp size={17} />, "Top sellers", 0)}
        <span className="admin-nav-heading">CATALOG</span>
        {screenButton("product-approvals", <FileCheck2 size={17} />, "Product approval", pendingProducts.length > 0 && <b>{pendingProducts.length}</b>)}
        {screenButton("inventory", <Boxes size={17} />, "Product inventory", <i>{approvedProducts.length}</i>, screen === "inventory" || screen === "product-page")}
        {screenButton("orders", <PackageCheck size={17} />, "Customer orders", orders.length > 0 && <i>{orders.length}</i>)}
        {screenButton("delivery", <Truck size={17} />, "Delivery partners", pendingApplications > 0 && <b title="Applications to review">{pendingApplications}</b>)}
        {screenButton("sales", <BarChart3 size={17} />, "Category sales")}
        {screenButton("customers", <UserRound size={17} />, "Customers", customers.length > 0 && <i>{customers.length}</i>)}
        {screenButton("returns", <RotateCcw size={17} />, "Returns", openReturnCount > 0 && <i>{openReturnCount}</i>)}
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
  );
}

export default AdminSidebar;
