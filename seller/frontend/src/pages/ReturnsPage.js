import { useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { errorMessage } from '../api/client'
import * as sellerApi from '../api/seller'
import BackendNotice from '../components/BackendNotice'
import EmptyCatalog from '../components/EmptyCatalog'
import { useSeller } from '../context/SellerContext'
import { returnPickupLabels } from '../utils/constants'
import { orderNumber, returnRequestsOf, sizeLabel, without } from '../utils/orders'

function ReturnsPage() {
  const { orders, setOrders, setProducts, setBackendNotice } = useSeller()
  const [returnReplies, setReturnReplies] = useState({})
  const [returnBusy, setReturnBusy] = useState('')
  // Return codes are only ever sent by SMS; this asks the API to text one again.
  const [resending, setResending] = useState('')

  const returnRequests = returnRequestsOf(orders)
  const openReturns = returnRequests.filter((entry) => entry.request.status === 'requested')
  const resolvedReturns = returnRequests.filter((entry) => entry.request.status !== 'requested')
  // Returns a partner has collected and is bringing back now: the seller gives them the code on receiving the items.
  const incomingReturns = returnRequests.filter((entry) => entry.item.returnPickup?.status === 'picked_up')

  const resendReturnCode = async (order, item) => {
    setResending(item._id)
    try {
      const { message } = await sellerApi.resendReturnCode(order._id, item._id)
      setBackendNotice(message)
    } catch (error) {
      setBackendNotice(errorMessage(error, 'Could not send the code. Try again.'))
    } finally {
      setResending('')
    }
  }

  const decideReturn = async (order, item, decision) => {
    const message = (returnReplies[item._id] ?? '').trim()
    if (decision === 'rejected' && message.length < 10) { setBackendNotice('Tell the customer why you are rejecting the return (at least 10 characters).'); return }
    setReturnBusy(item._id)
    try {
      const { order: updated, restockedQuantity } = await sellerApi.decideReturn(order._id, item._id, decision, message)
      setOrders((current) => current.map((entry) => entry._id === updated._id ? updated : entry))
      setReturnReplies((current) => without(current, item._id))
      if (restockedQuantity && item.product) setProducts((current) => current.map((product) => product.id === item.product && item.size ? { ...product, stock: { ...product.stock, [item.size]: Number(product.stock[item.size] || 0) + restockedQuantity } } : product))
      setBackendNotice(decision === 'approved' ? 'Return accepted. A delivery partner will collect the item from the customer and bring it back to you; it goes back into stock when it arrives.' : 'Return rejected. The customer can see your message.')
    } catch (error) {
      setBackendNotice(errorMessage(error, 'Could not update the return request.'))
    } finally {
      setReturnBusy('')
    }
  }

  return <div className="dashboard-page">
    <div className="dashboard-heading"><div><span className="eyebrow">AFTER DELIVERY</span><h1>Returns</h1><p>Customers can ask to return delivered items within 7 days. Accepting a return sends a delivery partner to collect the item and bring it back to you; it goes back into your stock when it arrives. If you reject it, tell the customer why.</p></div></div>
    <BackendNotice />
    {incomingReturns.length > 0 && <section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Returns on their way back</strong><span>When the partner hands you the items, check them and give the partner the return code we texted you.</span></div></div>
      <div className="restock-list">{incomingReturns.map(({ order, item }) => <article className="restock-card return-card return-incoming" key={item._id}>
        <div className="restock-product">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}<span><strong>{item.name}</strong><small>{sizeLabel(item)}Qty {item.quantity} · Order {orderNumber(order)}</small>{item.returnPickup?.partner && <small>With {item.returnPickup.partner.name} · {item.returnPickup.partner.phone}{item.returnPickup.partner.vehicleNumber ? ` · ${item.returnPickup.partner.vehicleNumber}` : ''}</small>}</span></div>
        <div className="return-code"><span className="eyebrow">RETURN CODE</span><small>Sent to you by SMS. Give it only once you have the items.</small><button className="text-button" type="button" disabled={resending === item._id} onClick={() => void resendReturnCode(order, item)}>{resending === item._id ? 'Sending…' : 'Resend code'}</button></div>
      </article>)}</div>
    </section>}
    <section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Awaiting your decision</strong><span>{openReturns.length} open request{openReturns.length === 1 ? '' : 's'}</span></div></div>
      {openReturns.length ? <div className="restock-list">{openReturns.map(({ order, item, request }) => <article className="restock-card return-card" key={item._id}>
        <div className="restock-product">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}<span><strong>{item.name}</strong><small>{sizeLabel(item)}Qty {item.quantity} · Order {orderNumber(order)} · Customer {order.customerId}</small><small>Requested {new Date(request.requestedAt).toLocaleString('en-IN')}{order.deliveredAt ? ` · delivered ${new Date(order.deliveredAt).toLocaleDateString('en-IN')}` : ''}</small></span></div>
        <div className="return-customer"><span className="eyebrow">CUSTOMER'S REASON</span><strong>{request.reason}</strong><p>“{request.message}”</p></div>
        <label className="return-reply"><span>Message to the customer <small>(required if you reject)</small></span><textarea className="control textarea" maxLength={500} value={returnReplies[item._id] ?? ''} onChange={(event) => setReturnReplies((current) => ({ ...current, [item._id]: event.target.value }))} placeholder="e.g. The tag has been removed and the item shows signs of wear, so it can't be resold." /></label>
        <div className="return-actions"><button className="button button-primary" type="button" disabled={returnBusy === item._id} onClick={() => void decideReturn(order, item, 'approved')}><Check size={16} /> Accept return</button><button className="button return-reject" type="button" disabled={returnBusy === item._id} onClick={() => void decideReturn(order, item, 'rejected')}>Reject return</button></div>
      </article>)}</div> : <EmptyCatalog icon={<RotateCcw size={23} />} title="No open return requests" text="When a customer asks to return one of your delivered items, it will appear here." />}
    </section>
    {resolvedReturns.length > 0 && <section className="catalog-panel"><div className="catalog-toolbar"><div><strong>Resolved returns</strong><span>Your past decisions</span></div></div><div className="product-table-wrap"><table className="product-table returns-table"><thead><tr><th>PRODUCT</th><th>CUSTOMER REASON</th><th>DECISION</th><th>PICKUP</th><th>YOUR MESSAGE</th></tr></thead><tbody>{resolvedReturns.map(({ order, item, request }) => <tr key={item._id}>
      <td>{item.name}<small className="table-subtext">{sizeLabel(item)}Qty {item.quantity} · {orderNumber(order)}</small></td>
      <td>{request.reason}<small className="table-subtext">“{request.message}”</small></td>
      <td><span className={`status-pill ${request.status === 'approved' ? 'approved-pill' : 'rejected-pill'}`}>{request.status === 'approved' ? 'Accepted' : 'Rejected'}</span><small className="table-subtext">{request.resolvedAt ? new Date(request.resolvedAt).toLocaleDateString('en-IN') : ''}{request.restockedQuantity ? ` · +${request.restockedQuantity} to stock` : ''}</small></td>
      <td>{item.returnPickup ? <>{returnPickupLabels[item.returnPickup.status]}{item.returnPickup.partner && item.returnPickup.status !== 'returned' && <small className="table-subtext">{item.returnPickup.partner.name} · {item.returnPickup.partner.phone}</small>}{item.returnPickup.returnedAt && <small className="table-subtext">{new Date(item.returnPickup.returnedAt).toLocaleDateString('en-IN')}</small>}</> : '—'}</td>
      <td>{request.sellerMessage || '—'}</td>
    </tr>)}</tbody></table></div></section>}
  </div>
}

export default ReturnsPage
