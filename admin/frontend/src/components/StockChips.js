// Units left per size, marked when a size is empty or low.
function StockChips({ stock }) {
  return (
    <span className="stock-chips">
      {Object.entries(stock ?? {}).map(([size, count]) => <span className={`stock-chip ${Number(count) < 1 ? "is-empty" : Number(count) < 3 ? "is-low" : ""}`} key={size}><b>{size}</b>{count}</span>)}
    </span>
  );
}

export default StockChips;
