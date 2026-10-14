import { useEffect, useState } from 'react'
import { ArrowLeft, Banknote, Plus, QrCode, Smartphone, UserRound } from 'lucide-react'
import { fetchPaymentOptions } from '../api/customer'
import EmptyState from '../components/EmptyState'
import PriceDetails from '../components/PriceDetails'
import { useStore } from '../context/StoreContext'
import { formatPrice } from '../utils/format'

function CheckoutPage() {
  const { authUser, navigateTo, cart, cartKey, addresses, selectedAddressId, setSelectedAddressId, openAddressModal, placingOrder, placeOrder } = useStore()
  const [paymentMethod, setPaymentMethod] = useState('cod')
  // { cod, upi, upiId, upiPayeeName, phonepe, paymentWindowMinutes } from the API.
  const [paymentOptions, setPaymentOptions] = useState(null)

  useEffect(() => {
    if (!authUser || paymentOptions) return
    fetchPaymentOptions().then(setPaymentOptions).catch(() => undefined)
  }, [authUser, paymentOptions])

  if (!authUser) return <section className="bag-page page-width"><EmptyState icon={<UserRound size={46} />} title="Sign in to checkout" text="You need a customer account before placing an order."><button className="primary-button" type="button" onClick={() => navigateTo('/login')}>Login / Signup</button></EmptyState></section>

  const paymentChoices = [
    { id: 'phonepe', icon: <Smartphone size={20} />, title: 'UPI with PhonePe', text: 'PhonePe, Google Pay, Paytm or any UPI app, secured by PhonePe', available: paymentOptions?.phonepe },
    { id: 'upi', icon: <QrCode size={20} />, title: 'UPI (scan & pay)', text: `Pay to ${paymentOptions?.upiId || 'our UPI ID'} with any UPI app`, available: paymentOptions?.upi },
    { id: 'cod', icon: <Banknote size={20} />, title: 'Cash on delivery (Cash/UPI)', text: 'Pay when your order arrives', available: true },
  ].filter((choice) => choice.available)

  return <section className="bag-page page-width">
    <div className="bag-layout">
      <div className="bag-items">
        <div className="checkout-heading"><h2>Select delivery address</h2><button className="outline-button small" type="button" onClick={() => openAddressModal()}>Add new address</button></div>
        {addresses.length ? addresses.map((address) => <button className={`checkout-address ${selectedAddressId === address.id ? 'selected' : ''}`} type="button" key={address.id} onClick={() => setSelectedAddressId(address.id)}>
          <span className="radio" />
          <span className="checkout-address-copy"><span className="address-card-top"><strong>{address.name}</strong><span className="address-type">{address.type}</span></span><small>{address.line}, {address.city}, {address.state} - {address.pincode}</small><small>Mobile: <b>{address.phone}</b></small></span>
        </button>) : <button className="add-address-tile" type="button" onClick={() => openAddressModal()}><Plus size={16} /> Add new address</button>}
        <div className="checkout-heading"><h2>Choose payment mode</h2></div>
        <div className="payment-options" role="radiogroup" aria-label="Payment mode">{paymentChoices.map((choice) => <button className={`payment-option ${paymentMethod === choice.id ? 'selected' : ''}`} type="button" role="radio" aria-checked={paymentMethod === choice.id} key={choice.id} onClick={() => setPaymentMethod(choice.id)}><span className={`radio ${paymentMethod === choice.id ? 'checked' : ''}`} />{choice.icon}<div><strong>{choice.title}</strong><small>{choice.text}</small></div></button>)}</div>
        <button className="back-link" type="button" onClick={() => navigateTo('/cart')}><ArrowLeft size={15} /> Back to bag</button>
      </div>
      <div>
        <PriceDetails><button className="primary-button" type="button" disabled={!cart.length || !selectedAddressId || placingOrder} onClick={() => void placeOrder(paymentMethod)}>{placingOrder ? 'Please wait…' : paymentMethod === 'cod' ? 'Place order' : 'Proceed to pay'}</button></PriceDetails>
        <div className="checkout-lines">{cart.map((item) => <div key={cartKey(item)}><span>{item.name}{item.size ? ` (${item.size})` : ''} × {item.quantity}</span><b>{formatPrice((item.salePrice ?? item.sellingPrice ?? item.cost) * item.quantity)}</b></div>)}</div>
      </div>
    </div>
  </section>
}

export default CheckoutPage
