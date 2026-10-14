// An empty panel: an icon, a title, a line of explanation and an optional action.
function EmptyState({ icon, title, text, compact = false, children }) {
  return (
    <div className={`admin-empty-state${compact ? " compact-empty" : ""}`}>
      {icon && <span>{icon}</span>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

export default EmptyState;
