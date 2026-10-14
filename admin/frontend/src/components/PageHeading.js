// A screen's eyebrow, title and description, with an optional summary on the right.
function PageHeading({ eyebrow, title, description, className = "admin-page-heading", children }) {
  return (
    <div className={className}>
      <div>
        <span className="admin-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}

export default PageHeading;
