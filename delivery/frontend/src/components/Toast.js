import { usePartner } from '../context/PartnerContext'

function Toast() {
  const { notice } = usePartner()
  return notice ? <div className="toast" role="status">{notice}</div> : null
}

export default Toast
