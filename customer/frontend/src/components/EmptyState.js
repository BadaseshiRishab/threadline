function EmptyState({ icon, title, text, children }) {
  return <div className="empty-state">{icon}<h2>{title}</h2><p>{text}</p><div className="empty-actions">{children}</div></div>
}

export default EmptyState
