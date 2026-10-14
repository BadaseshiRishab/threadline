// A panel's eyebrow and heading, with an optional count or action on the right.
function PanelTitle({ eyebrow, title, children }) {
  return (
    <div className="admin-panel-title">
      <div>
        <span className="admin-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default PanelTitle;
