import { useSeller } from '../context/SellerContext'

// The message from the last request, if there is one.
function BackendNotice({ className = 'backend-notice' }) {
  const { backendNotice } = useSeller()
  return backendNotice ? <p className={className} role="alert">{backendNotice}</p> : null
}

export default BackendNotice
