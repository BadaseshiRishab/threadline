import { useEffect } from 'react'
import { useStore } from '../context/StoreContext'
import { formatPrice } from '../utils/format'

// The animated tick shown after paying. Moves on to the orders page by itself once the animation has played.
function PaymentSuccess() {
  const { paymentSuccess, finishPaymentSuccess } = useStore()
  useEffect(() => {
    const timer = window.setTimeout(finishPaymentSuccess, 4200)
    return () => window.clearTimeout(timer)
  }, [paymentSuccess])

  return <div className="payment-success" role="alertdialog" aria-modal="true" aria-labelledby="payment-success-title" aria-describedby="payment-success-note">
    <div className="payment-success-card">
      <div className="payment-success-mark" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--angle': `${index * 30}deg`, '--delay': `${0.55 + (index % 3) * 0.05}s` }} />)}
        <svg viewBox="0 0 120 120">
          <circle className="payment-success-ring" cx="60" cy="60" r="52" />
          <path className="payment-success-tick" d="M38 62 L54 77 L84 45" />
        </svg>
      </div>
      <h2 id="payment-success-title">Payment successful</h2>
      <p className="payment-success-amount">{formatPrice(paymentSuccess.total)}</p>
      <p className="payment-success-order">Order #{paymentSuccess.orderId.slice(-8).toUpperCase()} placed</p>
      <small id="payment-success-note">{paymentSuccess.verified ? 'Your payment is confirmed. We’ll let you know when your order ships.' : 'We’ll confirm your UPI payment with your bank shortly.'}</small>
      <button className="primary-button" type="button" onClick={finishPaymentSuccess} autoFocus>View my orders</button>
    </div>
  </div>
}

export default PaymentSuccess
