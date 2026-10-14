import { Hand, IndianRupee } from 'lucide-react'
import { useJobs } from '../context/JobsContext'
import { minutesAgo, orderNumber, plural, rupees } from '../utils/format'

// A packed order in the pool, waiting for a partner to accept it.
function AvailableOrderCard({ order }) {
  const { busy, cardErrors, atCapacity, acceptOrder } = useJobs()
  const working = Boolean(busy[order._id])
  return <article className="job-card offer-card">
    <header className="job-head">
      <div><strong>Order #{orderNumber(order._id)}</strong><small>Placed {minutesAgo(order.createdAt)} · {plural(order.itemCount, 'item')}</small></div>
      <span className="stage-chip is-packed">Packed · ready</span>
    </header>
    <div className="route">
      <div><span className="route-dot pickup" /><div><small>PICK UP</small>{order.pickups.map((pickup) => <strong key={pickup.sellerId}>{pickup.name}<span>{[pickup.city, pickup.pincode].filter(Boolean).join(' ') || 'Bangalore'}</span></strong>)}</div></div>
      <div><span className="route-dot drop" /><div><small>DROP</small><strong>{[order.dropArea.city, order.dropArea.pincode].filter(Boolean).join(' ')}</strong></div></div>
    </div>
    <div className={`payment-banner ${order.cashToCollect ? 'is-cash' : 'is-prepaid'}`}><IndianRupee size={18} />{order.cashToCollect ? <span><b>Collect {rupees(order.cashToCollect)}</b> at the door</span> : <span><b>Prepaid</b> · no cash to collect</span>}</div>
    <footer className="job-foot">
      {cardErrors[order._id] && <p className="form-error" role="alert">{cardErrors[order._id]}</p>}
      <button className="primary-button" type="button" disabled={working || atCapacity} onClick={() => void acceptOrder(order)}><Hand size={18} /> {working ? 'Accepting…' : 'Accept order'}</button>
    </footer>
  </article>
}

export default AvailableOrderCard
