import { useState } from 'react'
import { ShoppingBag, X } from 'lucide-react'
import { requestReturn } from '../api/customer'
import { useStore } from '../context/StoreContext'
import { returnReasons } from '../utils/constants'
import { useEscapeKey } from '../utils/useEscapeKey'

// Asks the seller to take back a delivered item. Rendered while returnModal ({ orderId, item }) is set.
function ReturnModal() {
  const { returnModal, setReturnModal, updateOrder, showNotice } = useStore()
  const { orderId, item } = returnModal
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const close = () => setReturnModal(null)
  useEscapeKey(true, close)

  const submit = async (event) => {
    event.preventDefault()
    if (sending) return
    if (!reason) { setError('Choose a reason for the return.'); return }
    if (message.trim().length < 10) { setError('Tell the seller a little more (at least 10 characters).'); return }
    setSending(true)
    setError('')
    const { ok, result } = await requestReturn(orderId, item._id, { reason, message: message.trim() })
    if (!ok || !result.order) { setSending(false); setError(result.message || 'Could not send your return request. Please try again.'); return }
    updateOrder(result.order)
    close()
    showNotice('Return requested. The seller will review it shortly.')
  }

  return <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="return-modal-title">
    <button className="modal-backdrop" type="button" aria-label="Close" onClick={close} />
    <form className="modal-card return-modal" onSubmit={submit}>
      <div className="modal-head"><h2 id="return-modal-title">Return item</h2><button type="button" aria-label="Close" onClick={close}><X size={20} /></button></div>
      <div className="modal-body">
        <div className="return-modal-item">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="order-item-placeholder"><ShoppingBag size={20} /></span>}<div><strong>{item.name}</strong><small>{item.size && item.size !== 'One size' ? `Size: ${item.size} · ` : ''}Qty: {item.quantity}</small></div></div>
        <h3>Reason for return</h3>
        <div className="return-reasons" role="radiogroup" aria-label="Reason for return">{returnReasons.map((option) => <label className={reason === option ? 'selected' : ''} key={option}><input type="radio" name="return-reason" value={option} checked={reason === option} onChange={() => { setReason(option); setError('') }} />{option}</label>)}</div>
        <label className="field return-message"><span>Message to the seller</span><textarea value={message} onChange={(event) => { setMessage(event.target.value.slice(0, 500)); setError('') }} placeholder="Describe the problem, e.g. the stitching on the left sleeve is torn." rows={4} required /><small>{message.trim().length}/500 · at least 10 characters</small></label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <p className="return-note">The seller will review your request. If it is accepted, a pickup will be arranged and your refund processed after the item is collected.</p>
      </div>
      <div className="modal-actions"><button className="outline-button" type="button" onClick={close}>Cancel</button><button className="primary-button" type="submit" disabled={sending}>{sending ? 'Sending…' : 'Request return'}</button></div>
    </form>
  </div>
}

export default ReturnModal
