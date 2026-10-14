import { Truck } from 'lucide-react'
import DeliveryCard from '../components/DeliveryCard'
import EmptyState from '../components/EmptyState'
import ReturnJobCard from '../components/ReturnJobCard'
import { useJobs } from '../context/JobsContext'

// Deliveries and return pickups the partner has accepted and not finished yet.
function MyJobsPage() {
  const { active, returns, openJobs, setTab } = useJobs()
  if (!openJobs) return <EmptyState icon={<Truck size={26} />} title="No jobs yet" text="Accept an order from the Available tab and it shows up here with the pickup and drop details."><button className="secondary-button" type="button" onClick={() => setTab('available')}>See available orders</button></EmptyState>
  return <div className="job-list">{active.map((delivery) => <DeliveryCard delivery={delivery} key={delivery._id} />)}{returns.active.map((job) => <ReturnJobCard job={job} key={job._id} />)}</div>
}

export default MyJobsPage
