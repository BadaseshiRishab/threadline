import { useState } from 'react'
import { Check, PackageCheck } from 'lucide-react'
import { errorMessage } from '../api/client'
import * as sellerApi from '../api/seller'
import BackendNotice from '../components/BackendNotice'
import EmptyCatalog from '../components/EmptyCatalog'
import { useSeller } from '../context/SellerContext'
import { awaitingUpi, orderNumber, partnerHandling, paymentLabel, without } from '../utils/orders'

function OrderStatusRow({ order, otp, setOtp, cancelOtp, updateOrderStatus, resending, resendPickupCode }) {
  const confirming = otp !== undefined
  const hasReturn = order.items.some((item) => item.returnRequest)
  const partner = order.deliveryPartner
  const statusLocked = hasReturn || order.status === 'cancelled' || awaitingUpi(order) || partnerHandling(order)
  const statusHint = hasReturn ? 'Orders with a return request keep their delivered status' : awaitingUpi(order) ? 'Waiting for admin to verify the UPI payment' : partnerHandling(order) ? 'The delivery partner updates this order from pickup to delivery' : partner ? 'Mark the order packed; the delivery partner takes it from there' : undefined
  return <div className={`seller-order-action${confirming ? ' is-confirming' : ''}`}>
    <span>
      <strong>{orderNumber(order)}</strong><small>{order.customerId}</small>
      {partner && <small className="partner-pickup">Pickup by {partner.name} · {partner.phone}{partner.vehicleNumber ? ` · ${partner.vehicleNumber}` : ''}</small>}
      {order.pickup?.codeSent && <span className="pickup-code"><small>Your pickup code has been sent to you by SMS. Read it to the partner only when you hand over the parcel.</small><button className="text-button" type="button" disabled={resending === order._id} onClick={() => void resendPickupCode(order)}>{resending === order._id ? 'Sending…' : 'Resend code'}</button></span>}
      {order.pickup?.pickedUpAt && <small className="partner-pickup">Handed over {new Date(order.pickup.pickedUpAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small>}
    </span>
    {confirming && <form className="delivery-otp-form" onSubmit={(event) => { event.preventDefault(); void updateOrderStatus(order._id, 'delivered', otp) }}><label><span>Customer's delivery OTP</span><input className="control" inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="4 digits" aria-label={`Delivery OTP for order ${orderNumber(order)}`} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 4))} autoFocus /></label><button className="button button-primary" type="submit" disabled={otp.length !== 4}><Check size={15} /> Confirm delivery</button><button className="button delivery-otp-cancel" type="button" onClick={cancelOtp}>Cancel</button></form>}
    <select className="control" value={order.status} disabled={statusLocked} title={statusHint} onChange={(event) => { if (event.target.value === 'delivered') setOtp(''); else void updateOrderStatus(order._id, event.target.value) }}>
      <option value="placed">Placed</option>
      <option value="packed">Packed</option>
      <option value="shipped" disabled={Boolean(partner) && order.status !== 'shipped'}>Shipped</option>
      <option value="out_for_delivery" disabled={Boolean(partner) && order.status !== 'out_for_delivery'}>Out for delivery</option>
      <option value="delivered" disabled={Boolean(partner) && order.status !== 'delivered'}>Delivered</option>
      {order.status === 'cancelled' && <option value="cancelled">Cancelled</option>}
    </select>
  </div>
}

function OrdersPage() {
  const { orders, setOrders, setBackendNotice } = useSeller()
  // Orders the seller is marking delivered, with the OTP typed so far.
  const [deliveryOtps, setDeliveryOtps] = useState({})
  // Pickup codes are only ever sent by SMS; this asks the API to text one again.
  const [resending, setResending] = useState('')

  const updateOrderStatus = async (orderId, status, otp) => {
    try {
      const order = await sellerApi.updateOrderStatus(orderId, status, otp)
      setOrders((current) => current.map((item) => item._id === orderId ? order : item))
      setDeliveryOtps((current) => without(current, orderId))
      setBackendNotice(status === 'delivered' ? 'OTP verified. Order marked as delivered.' : 'Order status updated.')
    } catch (error) {
      setBackendNotice(errorMessage(error, 'Could not update order status.'))
    }
  }

  const resendPickupCode = async (order) => {
    setResending(order._id)
    try {
      const { message } = await sellerApi.resendPickupCode(order._id)
      setBackendNotice(message)
    } catch (error) {
      setBackendNotice(errorMessage(error, 'Could not send the code. Try again.'))
    } finally {
      setResending('')
    }
  }

  return <>
    <div className="dashboard-page"><div className="dashboard-heading"><div><span className="eyebrow">SELLER ORDERS</span><h1>Orders</h1><p>Orders containing your products, identified by customer ID.</p></div></div>
      <section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Recent orders</strong><span>{orders.length} orders</span></div></div>
        {orders.length ? <div className="product-table-wrap"><table className="product-table"><thead><tr><th>ORDER</th><th>CUSTOMER ID</th><th>PRODUCTS</th><th>PAYMENT</th><th>STATUS</th></tr></thead><tbody>{orders.map((order) => <tr key={order._id}><td>{orderNumber(order)}<small className="table-subtext">{new Date(order.createdAt).toLocaleString('en-IN')}</small></td><td>{order.customerId}</td><td>{order.items.reduce((total, item) => total + Number(item.quantity || 0), 0)} units</td><td>{paymentLabel(order)}</td><td><span className="status-pill approved-pill">{order.status}</span></td></tr>)}</tbody></table></div>
          : <EmptyCatalog icon={<PackageCheck size={23} />} title="No orders yet" text="Orders containing your approved products will appear here." />}
      </section>
    </div>

    {orders.length > 0 && <div className="dashboard-page order-actions-page"><section className="catalog-panel">
      <div className="catalog-toolbar"><div><strong>Update fulfilment status</strong><span>Move each order through your fulfilment workflow. To mark an order delivered, enter the OTP the customer reads out from the SMS we sent them.</span></div></div>
      <BackendNotice className="backend-notice order-action-notice" />
      <div className="seller-order-actions">{orders.map((order) => <OrderStatusRow
        key={order._id}
        order={order}
        otp={deliveryOtps[order._id]}
        setOtp={(otp) => setDeliveryOtps((current) => ({ ...current, [order._id]: otp }))}
        cancelOtp={() => setDeliveryOtps((current) => without(current, order._id))}
        updateOrderStatus={updateOrderStatus}
        resending={resending}
        resendPickupCode={resendPickupCode}
      />)}</div>
    </section></div>}
  </>
}

export default OrdersPage
