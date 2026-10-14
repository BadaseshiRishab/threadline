import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { checkPhonePePayment } from '../api/customer'
import { useStore } from '../context/StoreContext'

// PhonePe sends the customer back to /payment/phonepe?order=<id>. Only PhonePe's answer (asked through the API)
// counts; the return to this page alone says nothing about the payment.
function PhonePeReturnPage() {
  const { navigateTo, setPaymentSuccess } = useStore()
  // state: 'checking' | 'pending' | 'failed'
  const [phonePeReturn, setPhonePeReturn] = useState(null)
  const started = useRef(false)

  // Asks every 3 seconds until the payment is settled.
  const checkPayment = async (orderId) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const { result } = await checkPhonePePayment(orderId)
      if (result.state === 'paid' && result.order) { setPaymentSuccess({ orderId, total: result.order.total, verified: true }); return }
      if (result.state === 'failed') { setPhonePeReturn({ orderId, state: 'failed' }); return }
      setPhonePeReturn({ orderId, state: 'pending' })
      await new Promise((resolve) => window.setTimeout(resolve, 3000))
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    const orderId = new URLSearchParams(window.location.search).get('order') || ''
    if (!/^[0-9a-f]{24}$/i.test(orderId)) { setPhonePeReturn({ orderId: '', state: 'failed' }); return }
    setPhonePeReturn({ orderId, state: 'checking' })
    void checkPayment(orderId)
  }, [])

  const state = phonePeReturn?.state || 'checking'
  if (state === 'failed') return <section className="phonepe-return page-width">
    <div className="phonepe-return-card is-failed">
      <span className="phonepe-return-icon"><X size={30} /></span>
      <h1>Payment not completed</h1>
      <p>The PhonePe payment failed or was cancelled, so your order was not placed. Any amount debited is refunded by your bank automatically.</p>
      <div className="phonepe-return-actions"><button className="primary-button" type="button" onClick={() => navigateTo('/checkout')}>Try again</button><button className="outline-button" type="button" onClick={() => navigateTo('/cart')}>Back to bag</button></div>
    </div>
  </section>
  return <section className="phonepe-return page-width">
    <div className="phonepe-return-card">
      <span className="phonepe-return-spinner" aria-hidden="true" />
      <h1>{state === 'pending' ? 'Waiting for PhonePe to confirm…' : 'Confirming your payment…'}</h1>
      <p>{state === 'pending' ? 'If you approved the payment in your UPI app, this usually takes a few seconds. Please keep this page open.' : 'Checking with PhonePe. Please don’t close or refresh this page.'}</p>
      {state === 'pending' && phonePeReturn?.orderId && <button className="outline-button" type="button" onClick={() => void checkPayment(phonePeReturn.orderId)}>Check again</button>}
    </div>
  </section>
}

export default PhonePeReturnPage
