import { Package } from 'lucide-react'
import AvailableOrderCard from '../components/AvailableOrderCard'
import AvailableReturnCard from '../components/AvailableReturnCard'
import EmptyState from '../components/EmptyState'
import { useJobs } from '../context/JobsContext'

// Packed orders and accepted returns waiting for a partner.
function AvailablePage() {
  const { available, returns, atCapacity, openJobs, loading, lastUpdated } = useJobs()
  return <>
    {atCapacity && <p className="banner-info">You have {openJobs} open jobs, the most you can hold at once. Finish or release one to accept more.</p>}
    {available.length || returns.available.length
      ? <div className="job-list">{available.map((order) => <AvailableOrderCard order={order} key={order._id} />)}{returns.available.map((job) => <AvailableReturnCard job={job} key={job._id} />)}</div>
      : <EmptyState icon={<Package size={26} />} title={loading && !lastUpdated ? 'Looking for orders…' : 'No orders waiting right now'} text="Orders appear here as soon as the seller packs them, and return pickups once a seller accepts a return. This page refreshes every 30 seconds." />}
  </>
}

export default AvailablePage
