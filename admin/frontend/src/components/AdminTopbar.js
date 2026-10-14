import { Bell, ChevronRight, CircleHelp, Search } from "lucide-react";
import { useAdmin } from "../context/AdminContext";
import { screenHeadings } from "../utils/constants";
import { stockTotal } from "../utils/format";

function AdminTopbar() {
  const { screen, setScreen, searchTerm, setSearchTerm, pendingProducts, approvedProducts } = useAdmin();
  const heading = screenHeadings[screen];
  const lowStockCount = approvedProducts.filter((product) => stockTotal(product) < 5).length;
  return (
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
          title={lowStockCount ? `${lowStockCount} products low on stock` : `${pendingProducts.length} product approvals`}
          onClick={() => setScreen(lowStockCount ? "inventory" : "product-approvals")}
        >
          <Bell size={17} />
          {(pendingProducts.length > 0 || lowStockCount > 0) && <i />}
        </button>
        <span className="admin-top-avatar">A</span>
      </div>
    </header>
  );
}

export default AdminTopbar;
