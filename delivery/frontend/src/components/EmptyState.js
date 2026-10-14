function EmptyState({ icon, title, text, children }) {
  return <div className="empty"><span>{icon}</span><h2>{title}</h2><p>{text}</p>{children}</div>
}

export default EmptyState
