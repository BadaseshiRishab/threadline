import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, PackageCheck, RotateCcw, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Truck, X } from 'lucide-react'
import { resendDeliveryOtp, resendReturnCode } from '../api/customer'
import AccountLayout from '../components/AccountLayout'
import EmptyState from '../components/EmptyState'
import { useStore } from '../context/StoreContext'
import { orderStatusLabels, orderSteps } from '../utils/constants'
import { formatPrice, paymentSummary, shortDate } from '../utils/format'
import { brandOf, productId, productPath } from '../utils/product'

// After the seller accepts a return, a delivery partner collects it; the return code to give them comes by SMS.
function ReturnPickup({ order, item, resending, resendCode }) {
  const pickup = item.returnPickup
  if (!pickup) return <p>A pickup will be arranged and your refund processed after the item is collected.</p>
  if (pickup.status === 'returned') return <p><b>Returned to the seller</b>{pickup.returnedAt ? ` on ${shortDate(pickup.returnedAt)}` : ''}. Your refund will be processed shortly.</p>
  if (pickup.status === 'picked_up') return <p><b>Collected</b>{pickup.pickedUpAt ? ` on ${shortDate(pickup.pickedUpAt)}` : ''} and on its way back to the seller. Your refund is processed once it arrives.</p>
  return <div className="return-pickup">
    <p>{pickup.status === 'assigned' && pickup.partner ? <><b>{pickup.partner.name}</b> ({pickup.partner.phone}{pickup.partner.vehicleNumber ? ` · ${pickup.partner.vehicleNumber}` : ''}) will collect this item from your delivery address.</> : 'We are finding a delivery partner to collect this item from your delivery address.'}</p>
    {pickup.codeSent && <p className="return-pickup-code"><span>Return code sent by SMS{order.smsTo ? ` to ${order.smsTo}` : ''}</span><small>Give it to the partner only when you hand over the item.</small><button className="otp-resend" type="button" disabled={resending === item._id} onClick={() => void resendCode(item._id, () => resendReturnCode(order._id, item._id))}>{resending === item._id ? 'Sending…' : 'Resend code'}</button></p>}
  </div>
}

// The return window, or how a return request is going, for one delivered item.
function ItemReturn({ order, item, deadline, resending, resendCode }) {
  const { setReturnModal } = useStore()
  const request = item.returnRequest
  if (!request) {
    if (Date.now() > deadline.getTime()) return <p className="return-status is-closed">Return window closed on {shortDate(deadline)}</p>
    return <div className="return-status is-open"><span>Return available till {shortDate(deadline)}</span><button type="button" onClick={() => setReturnModal({ orderId: order._id, item })}><RotateCcw size={14} /> Return</button></div>
  }
  const title = request.status === 'requested' ? 'Return requested · waiting for the seller' : request.status === 'approved' ? 'Return accepted' : 'Return rejected'
  return <div className={`return-status is-${request.status}`}>
    <strong>{title}</strong>
    <p><b>Your reason:</b> {request.reason}. “{request.message}”</p>
    {request.status !== 'requested' && request.sellerMessage && <p><b>Seller’s message:</b> “{request.sellerMessage}”</p>}
    {request.status === 'approved' && <ReturnPickup order={order} item={item} resending={resending} resendCode={resendCode} />}
    <small>Requested on {shortDate(request.requestedAt)}{request.resolvedAt ? ` · ${request.status === 'approved' ? 'Accepted' : 'Rejected'} on ${shortDate(request.resolvedAt)}` : ''}</small>
  </div>
}

function OrderCard({ order, resending, resendCode }) {
  const { products: catalog, navigateTo, shopSettings } = useStore()
  const current = orderSteps.indexOf(order.status)
  const cancelled = order.status === 'cancelled'
  const delivered = order.status === 'delivered'
  const finished = cancelled || delivered
  const returnDeadline = new Date(new Date(order.deliveredAt || order.updatedAt || order.createdAt).getTime() + shopSettings.returnWindowDays * 24 * 3600 * 1000)
  const statusDate = delivered ? order.deliveredAt || order.updatedAt || order.createdAt : finished ? order.updatedAt || order.createdAt : order.createdAt
  return <article className={`order-card ${cancelled ? 'is-cancelled' : delivered ? 'is-delivered' : 'is-active'}`}>
    <div className="order-card-head"><span className="order-status-icon">{cancelled ? <X size={18} /> : delivered ? <Check size={18} /> : <Truck size={18} />}</span><div><strong>{orderStatusLabels[order.status] || order.status}</strong><small>{finished ? 'On' : 'Ordered on'} {new Date(statusDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</small></div></div>
    {['shipped', 'out_for_delivery'].includes(order.status) && <div className="order-otp"><ShieldCheck size={20} /><div><strong>Delivery OTP by SMS</strong><small>{order.status === 'out_for_delivery' ? `We have texted your 4-digit delivery OTP${order.smsTo ? ` to ${order.smsTo}` : ''}.` : `We text your delivery OTP${order.smsTo ? ` to ${order.smsTo}` : ''} when your order is out for delivery.`} Tell it to the delivery partner only when you receive your order.</small></div><button className="otp-resend" type="button" disabled={resending === order._id} onClick={() => void resendCode(order._id, () => resendDeliveryOtp(order._id))}>{resending === order._id ? 'Sending…' : order.status === 'out_for_delivery' ? 'Resend OTP' : 'Send OTP now'}</button></div>}
    {!finished && order.deliveryPartner?.name && <div className="order-partner"><Truck size={18} /><div><strong>{order.deliveryPartner.name} is your delivery partner</strong><small>{[order.deliveryPartner.vehicleType, order.deliveryPartner.vehicleNumber].filter(Boolean).join(' · ')}</small></div><a href={`tel:${order.deliveryPartner.phone}`}>Call</a></div>}
    <div className="order-items">{order.items.map((item, index) => {
      const linked = item.product ? catalog.find((product) => productId(product) === item.product) : undefined
      const href = linked ? productPath(linked) : ''
      const image = item.imageUrl || linked?.imageUrl
      const brand = linked ? brandOf(linked) : ''
      const body = <>{image ? <img src={image} alt="" loading="lazy" /> : <span className="order-item-placeholder"><ShoppingBag size={20} /></span>}<div><strong>{brand || item.name}</strong>{brand && <p>{item.name}</p>}<small>{item.size && item.size !== 'One size' ? `Size: ${item.size} · ` : ''}Qty: {item.quantity} · {formatPrice(item.unitPrice * item.quantity)}</small></div>{href && <ChevronRight size={18} />}</>
      const line = href ? <a className="order-item" href={href} onClick={(event) => { event.preventDefault(); navigateTo(href) }}>{body}</a> : <div className="order-item">{body}</div>
      return <div className="order-line" key={item._id || `${item.name}-${index}`}>{line}{delivered && <ItemReturn order={order} item={item} deadline={returnDeadline} resending={resending} resendCode={resendCode} />}</div>
    })}</div>
    {!cancelled && <div className="order-timeline">{orderSteps.map((status, index) => <span className={index <= current ? 'complete' : ''} key={status}><i />{orderStatusLabels[status]}</span>)}</div>}
    <div className="order-card-foot"><span>Order #{order._id.slice(-8).toUpperCase()} · {paymentSummary(order)}</span><b>Total {formatPrice(order.total)}</b></div>
  </article>
}

function OrdersPage() {
  const { orders, navigateTo, showNotice } = useStore()
  const [orderQuery, setOrderQuery] = useState('')
  const [orderFilter, setOrderFilter] = useState('all')
  // Delivery OTPs and return codes are only ever sent by SMS; this asks the API to text one again.
  const [resending, setResending] = useState('')
  const resendCode = async (key, send) => {
    setResending(key)
    try {
      const { result } = await send()
      showNotice(String(result?.message || 'Could not send the code. Try again.'))
    } finally {
      setResending('')
    }
  }

  const needle = orderQuery.trim().toLowerCase()
  const visibleOrders = orders.filter((order) => (orderFilter === 'all' || (orderFilter === 'active' ? !['delivered', 'cancelled'].includes(order.status) : order.status === orderFilter))
    && (!needle || order._id.toLowerCase().includes(needle) || order.items.some((item) => item.name.toLowerCase().includes(needle))))

  return <AccountLayout>
    <div className="orders-head">
      <div><h2>All orders</h2><p>from anytime</p></div>
      <label className="orders-search"><Search size={16} /><input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="Search in orders" aria-label="Search in orders" /></label>
      <label className="orders-filter"><SlidersHorizontal size={15} /><select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)} aria-label="Filter orders">{[['all', 'All orders'], ['active', 'In progress'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown size={15} /></label>
    </div>
    {!orders.length ? <EmptyState icon={<PackageCheck size={46} />} title="No orders yet" text="Your placed orders will appear here."><button className="primary-button" type="button" onClick={() => navigateTo('/')}>Start shopping</button></EmptyState>
      : !visibleOrders.length ? <div className="panel muted-panel"><Search size={20} /><p>No orders match your search.</p></div>
      : <div className="orders-list">{visibleOrders.map((order) => <OrderCard order={order} resending={resending} resendCode={resendCode} key={order._id} />)}</div>}
  </AccountLayout>
}

export default OrdersPage
