import { CircleCheck, Undo2 } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { useJobs } from '../context/JobsContext'
import { isToday, orderNumber, plural, rupees, time } from '../utils/format'

// Deliveries and returns completed in the last 30 days.
function CompletedPage() {
  const { completed, returns } = useJobs()
  if (!completed.length && !returns.completed.length) return <EmptyState icon={<CircleCheck size={26} />} title="No completed deliveries yet" text="Orders you deliver in the last 30 days are listed here." />
  const cashCollectedToday = completed.filter((delivery) => isToday(delivery.deliveredAt)).reduce((total, delivery) => total + delivery.cashCollected, 0)
  return <section className="completed">
    <div className="completed-summary"><span>Last 30 days</span><span>Cash collected today <b>{rupees(cashCollectedToday)}</b></span></div>
    <ul>{completed.map((delivery) => <li key={delivery._id}>
      <span className="done-icon"><CircleCheck size={18} /></span>
      <div><strong>#{orderNumber(delivery._id)} · {delivery.customer.name}</strong><small>{delivery.address.city} {delivery.address.pincode} · {time(delivery.deliveredAt)}</small></div>
      <b>{delivery.cashCollected ? `${rupees(delivery.cashCollected)} cash` : 'Prepaid'}</b>
    </li>)}</ul>
    {returns.completed.length > 0 && <>
      <div className="completed-summary"><span>Returns brought back</span><span><b>{returns.completed.length}</b></span></div>
      <ul>{returns.completed.map((job) => <li key={job._id}>
        <span className="done-icon"><Undo2 size={18} /></span>
        <div><strong>#{orderNumber(job.orderId)} · {job.customer.name} → {job.seller.name}</strong><small>{plural(job.itemCount, 'item')} · {time(job.returnedAt)}</small></div>
        <b>Return</b>
      </li>)}</ul>
    </>}
  </section>
}

export default CompletedPage
