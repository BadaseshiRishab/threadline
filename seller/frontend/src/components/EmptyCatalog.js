function EmptyCatalog({ icon, title, text, children }) {
  return <div className="empty-catalog"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p>{children}</div>
}

export default EmptyCatalog
