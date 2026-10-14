export const rupees = (value) => { const amount = Number(value || 0); return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`; };

// Turns the sales report's period keys (2026-10-03, 2026-10, 2026) into readable labels.
export const periodLabel = (key, period) => {
  if (period === "year") return key;
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day || 1);
  return period === "month" ? date.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

// A text field from a seller's application, or the fallback when it is empty.
export function text(value, fallback = "Not provided") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export const orderNumber = (order) => order._id.slice(-8).toUpperCase();
export const plural = (count, word) => `${word}${count === 1 ? "" : "s"}`;
export const stockTotal = (product) => Object.values(product.stock ?? {}).reduce((total, count) => total + Number(count || 0), 0);
// "S: 3, M: 5"; sign "+" gives "S: +3, M: +5".
export const stockSummary = (stock, sign = "") => Object.entries(stock ?? {}).map(([size, count]) => `${size}: ${sign}${count}`).join(", ");
