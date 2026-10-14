import * as adminApi from "../api/admin";
import { errorMessage } from "../api/client";
import { useAdmin } from "../context/AdminContext";
import { orderNumber } from "../utils/format";
import { assignable, canAssignPartner } from "../utils/orders";

// Assigns an order to a delivery partner, changes the partner, or removes them.
function PartnerSelect({ order }) {
  const { partners, refreshPartners, setOrders, setPageError } = useAdmin();
  const pickedUp = ["shipped", "out_for_delivery"].includes(order.status);
  const choices = partners.filter((partner) => assignable(partner) || partner._id === order.deliveryPartner?._id);

  const assignPartner = async (partnerId) => {
    try {
      const result = await adminApi.assignPartner(order._id, partnerId || null);
      setOrders((current) => current.map((entry) => entry._id === order._id ? { ...entry, ...result.order } : entry));
      void refreshPartners().catch(() => undefined);
    } catch (error) {
      setPageError(errorMessage(error, "Could not assign the delivery partner."));
    }
  };

  return <select className="admin-partner-select" aria-label={`Delivery partner for order ${orderNumber(order)}`} value={order.deliveryPartner?._id || ""} disabled={!canAssignPartner(order)} onChange={(event) => void assignPartner(event.target.value)}>
    <option value="" disabled={pickedUp}>{order.deliveryPartner ? "Remove partner" : "Assign partner…"}</option>
    {choices.map((partner) => <option value={partner._id} key={partner._id}>{partner.name}{partner.area ? ` · ${partner.area}` : ""} ({partner.activeOrders} open)</option>)}
  </select>;
}

export default PartnerSelect;
