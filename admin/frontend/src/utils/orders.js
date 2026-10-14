// Only approved, active partners can be given orders.
export const assignable = (partner) => partner.status === "approved" && partner.active;
// Orders a partner can be given: packed by the seller and not yet delivered, and UPI orders only once their payment is confirmed.
export const canAssignPartner = (order) => !["placed", "delivered", "cancelled"].includes(order.status) && !(order.paymentMethod === "upi" && order.paymentStatus !== "paid");

// Every order item a customer asked to return, newest request first.
export const returnEntriesOf = (orders) => orders
  .flatMap((order) => order.items.filter((item) => item.returnRequest).map((item) => ({ order, item, request: item.returnRequest })))
  .sort((a, b) => b.request.requestedAt.localeCompare(a.request.requestedAt));
