import { ChevronDown } from 'lucide-react'

export function TextField({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="control" {...props} />
    </label>
  )
}

export function SelectField({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="select-wrap">
        <select className="control" {...props}>{children}</select>
        <ChevronDown size={15} aria-hidden="true" />
      </span>
    </label>
  )
}
