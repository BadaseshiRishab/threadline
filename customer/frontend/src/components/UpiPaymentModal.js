import { Copy, X } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import { formatPrice } from '../utils/format'

// Scan-and-pay UPI: the customer pays from their UPI app, then enters the payment's 12-digit transaction ID (UTR).
function UpiPaymentModal() {
  const { upiPayment, setUpiPayment, submitUpiPayment, closeUpiPayment, showNotice } = useStore()
  const { total, upiId, payeeName, link, qr, expiresAt, transactionId, sending, error } = upiPayment
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="upi-modal-title">
    <button className="modal-backdrop" type="button" aria-label="Close" onClick={closeUpiPayment} />
    <form className="modal-card upi-modal" onSubmit={(event) => { event.preventDefault(); void submitUpiPayment() }}>
      <div className="modal-head"><h2 id="upi-modal-title">Pay with UPI</h2><button type="button" aria-label="Close" onClick={closeUpiPayment}><X size={20} /></button></div>
      <div className="modal-body">
        <div className="upi-pay">
          <p className="upi-amount"><span>Amount to pay</span><strong>{formatPrice(total)}</strong></p>
          {qr && <img className="upi-qr" src={qr} alt={`UPI QR code to pay ${formatPrice(total)} to ${upiId}`} width={220} height={220} />}
          <small>Scan with any UPI app: Google Pay, PhonePe, Paytm or BHIM</small>
          <a className="outline-button upi-app-link" href={link}>Open UPI app</a>
          <p className="upi-id">Or pay to <b>{upiId}</b> ({payeeName})<button type="button" aria-label="Copy UPI ID" onClick={() => void navigator.clipboard?.writeText(upiId).then(() => showNotice('UPI ID copied')).catch(() => undefined)}><Copy size={14} /></button></p>
        </div>
        <label className="field"><span>UPI transaction ID (UTR)</span><input inputMode="numeric" autoComplete="off" maxLength={12} placeholder="12-digit number from your UPI app" value={transactionId} aria-invalid={Boolean(error)} onChange={(event) => setUpiPayment({ ...upiPayment, transactionId: event.target.value.replace(/\D/g, '').slice(0, 12), error: '' })} /></label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <p className="return-note">After paying, open the payment in your UPI app and copy its 12-digit UTR / UPI reference number. Pay by {new Date(expiresAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}, otherwise the items are released. We confirm the order once the payment is verified.</p>
      </div>
      <div className="modal-actions"><button className="outline-button" type="button" disabled={sending} onClick={closeUpiPayment}>Cancel</button><button className="primary-button" type="submit" disabled={sending || transactionId.length !== 12}>{sending ? 'Submitting…' : 'I have paid'}</button></div>
    </form>
  </div>
}

export default UpiPaymentModal
