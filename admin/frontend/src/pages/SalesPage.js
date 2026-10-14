import { useEffect, useState } from "react";
import { BarChart3, Package, PackageCheck, TrendingUp } from "lucide-react";
import * as adminApi from "../api/admin";
import { errorMessage } from "../api/client";
import EmptyState from "../components/EmptyState";
import PanelTitle from "../components/PanelTitle";
import { useAdmin } from "../context/AdminContext";
import { periodLabel, plural, rupees } from "../utils/format";

const periodNames = { day: "Day", month: "Month", year: "Year" };
const periodAdjectives = { day: "Daily", month: "Monthly", year: "Yearly" };

// Sales per category, grouped by day, month or year.
function SalesPage() {
  const { setPageError } = useAdmin();
  const [salesPeriod, setSalesPeriod] = useState("day");
  const [salesReport, setSalesReport] = useState(null);

  useEffect(() => {
    let active = true;
    void adminApi.fetchSales(salesPeriod).then((report) => { if (active) setSalesReport(report); }).catch((error) => setPageError(errorMessage(error, "Could not load sales.")));
    return () => { active = false; };
  }, [salesPeriod]);

  // Pivot the report into periods (rows) × categories (columns), plus per-category totals with their sub-categories.
  const salesRows = salesReport?.period === salesPeriod ? salesReport.rows : [];
  const categoryTotals = Object.values(salesRows.reduce((totals, row) => {
    const entry = totals[row.category] ??= { category: row.category, sales: 0, units: 0, returnedUnits: 0, subcategories: {} };
    entry.sales += row.sales; entry.units += row.units; entry.returnedUnits += row.returnedUnits;
    const sub = entry.subcategories[row.subcategory] ??= { sales: 0, units: 0 };
    sub.sales += row.sales; sub.units += row.units;
    return totals;
  }, {})).sort((a, b) => b.sales - a.sales);
  const salesPeriodKeys = [...new Set(salesRows.map((row) => row.period))].sort((a, b) => b.localeCompare(a));
  const salesCell = (periodKey, category) => salesRows.filter((row) => row.period === periodKey && row.category === category).reduce((cell, row) => ({ sales: cell.sales + row.sales, units: cell.units + row.units }), { sales: 0, units: 0 });
  const totalSales = categoryTotals.reduce((total, entry) => total + entry.sales, 0);
  const totalUnits = categoryTotals.reduce((total, entry) => total + entry.units, 0);
  const totalReturnedUnits = categoryTotals.reduce((total, entry) => total + entry.returnedUnits, 0);
  const totalSalesOrders = salesPeriodKeys.reduce((total, key) => total + (salesReport?.periods[key] || 0), 0);
  const units = (count) => `${count} ${plural(count, "unit")}`;

  return (
    <div className="admin-page">
      <div className="admin-page-heading"><div><span className="admin-eyebrow">ORDER MANAGEMENT</span><h1>Category Sales</h1><p>Sales for each category by {salesPeriod}. Amounts are item value before GST and delivery; cancelled orders and accepted returns are not counted.</p></div>
        <div className="admin-segmented" role="group" aria-label="Group sales by">{["day", "month", "year"].map((option) => <button className={salesPeriod === option ? "active" : ""} type="button" aria-pressed={salesPeriod === option} onClick={() => setSalesPeriod(option)} key={option}>{periodNames[option]}</button>)}</div>
      </div>
      <div className="admin-metrics">
        <div><span>SALES <TrendingUp size={16} /></span><strong className="admin-metric-money">{rupees(Math.round(totalSales))}</strong><small>{salesReport?.sinceDays ? `Last ${salesReport.sinceDays === 730 ? "24 months" : `${salesReport.sinceDays} days`}` : "All time"}</small></div>
        <div><span>UNITS SOLD <Package size={16} /></span><strong>{totalUnits.toString().padStart(2, "0")}</strong><small>{totalReturnedUnits ? `${totalReturnedUnits} returned and excluded` : "Net of returns"}</small></div>
        <div><span>ORDERS <PackageCheck size={16} /></span><strong>{totalSalesOrders.toString().padStart(2, "0")}</strong><small>Across {salesPeriodKeys.length} {plural(salesPeriodKeys.length, salesPeriod)}</small></div>
        <div><span>TOP CATEGORY <BarChart3 size={16} /></span><strong className="admin-metric-text">{categoryTotals[0]?.category || "—"}</strong><small>{categoryTotals[0] ? `${Math.round(categoryTotals[0].sales / (totalSales || 1) * 100)}% of sales` : "No sales yet"}</small></div>
      </div>
      {!salesReport || salesReport.period !== salesPeriod ? <div className="admin-loading-strip">Loading sales…</div> : !salesRows.length ? <section className="admin-panel"><EmptyState icon={<BarChart3 size={23} />} title="No sales in this range" text="Category sales appear here once customers place orders." /></section> : <>
        <section className="admin-panel admin-sales-panel"><PanelTitle eyebrow="BY CATEGORY" title="Category share" />
          <div className="admin-category-bars">{categoryTotals.map((entry) => <details className="admin-category-bar" key={entry.category}>
            <summary><span className="admin-category-name">{entry.category}</span><span className="admin-bar-track"><span style={{ width: `${Math.max(2, entry.sales / (categoryTotals[0].sales || 1) * 100)}%` }} /></span><b>{rupees(entry.sales)}</b><small>{units(entry.units)} · {Math.round(entry.sales / (totalSales || 1) * 100)}%</small></summary>
            <div className="admin-subcategories">{Object.entries(entry.subcategories).sort((a, b) => b[1].sales - a[1].sales).map(([name, sub]) => <span key={name}><strong>{name}</strong>{rupees(sub.sales)} · {units(sub.units)}</span>)}</div>
          </details>)}</div>
        </section>
        <section className="admin-panel admin-sales-panel"><PanelTitle eyebrow={`BY ${salesPeriod.toUpperCase()}`} title={`${periodAdjectives[salesPeriod]} sales by category`} />
          <div className="registry-table-wrap"><table className="admin-table admin-sales-table"><thead><tr><th>{salesPeriod.toUpperCase()}</th>{categoryTotals.map((entry) => <th key={entry.category}>{entry.category.toUpperCase()}</th>)}<th>TOTAL</th><th>ORDERS</th></tr></thead>
            <tbody>{salesPeriodKeys.map((key) => {
              const cells = categoryTotals.map((entry) => salesCell(key, entry.category));
              const rowTotal = cells.reduce((total, cell) => total + cell.sales, 0);
              return <tr key={key}><td><strong>{periodLabel(key, salesPeriod)}</strong></td>{cells.map((cell, index) => <td key={categoryTotals[index].category}>{cell.units ? <>{rupees(cell.sales)}<small>{units(cell.units)}</small></> : <span className="admin-muted-cell">—</span>}</td>)}<td><strong>{rupees(rowTotal)}</strong></td><td>{salesReport.periods[key] || 0}</td></tr>;
            })}</tbody>
            <tfoot><tr><td><strong>Total</strong></td>{categoryTotals.map((entry) => <td key={entry.category}><strong>{rupees(entry.sales)}</strong><small>{units(entry.units)}</small></td>)}<td><strong>{rupees(totalSales)}</strong></td><td><strong>{totalSalesOrders}</strong></td></tr></tfoot>
          </table></div>
        </section>
      </>}
    </div>
  );
}

export default SalesPage;
