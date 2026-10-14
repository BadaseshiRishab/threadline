import { Bike, UserRound } from 'lucide-react'
import Toast from '../components/Toast'
import Topbar from '../components/Topbar'
import { JobsProvider, useJobs } from '../context/JobsContext'
import { usePartner } from '../context/PartnerContext'
import { isToday, rupees } from '../utils/format'
import AccountPage from './AccountPage'
import AvailablePage from './AvailablePage'
import CompletedPage from './CompletedPage'
import MyJobsPage from './MyJobsPage'

function Dashboard() {
  const { partner } = usePartner()
  const { tab, setTab, available, active, completed, returns, maxOpenJobs, openJobs, loading, loadError, lastUpdated, loadDeliveries } = useJobs()
  const cashDue = active.reduce((total, delivery) => total + delivery.cashToCollect, 0)
  const doneToday = completed.filter((delivery) => isToday(delivery.deliveredAt)).length + returns.completed.filter((job) => isToday(job.returnedAt)).length
  const tabButton = (id, label, extra = {}) => <button role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} type="button" onClick={() => setTab(id)} {...extra}>{label}</button>

  return (
    <div className="app-shell">
      <Topbar loading={loading} onRefresh={loadDeliveries} />
      <main className="content">
        <section className="greeting">
          <div><span className="eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</span><h1>Hi, {partner.name.split(' ')[0]}</h1></div>
          <span className="vehicle"><Bike size={15} /> {partner.vehicleType}{partner.vehicleNumber ? ` · ${partner.vehicleNumber}` : ''}</span>
        </section>
        <section className="stats" aria-label="Today at a glance">
          <div><strong>{openJobs}<small>/{maxOpenJobs}</small></strong><span>My open jobs</span></div>
          <div><strong>{doneToday}</strong><span>Done today</span></div>
          <div><strong>{rupees(cashDue)}</strong><span>Cash to collect</span></div>
        </section>

        <nav className="tabs" role="tablist">
          {tabButton('available', <>Available <b>{available.length + returns.available.length}</b></>)}
          {tabButton('active', <>My jobs <b>{openJobs}</b></>)}
          {tabButton('completed', 'Done')}
          {tabButton('account', <UserRound size={16} />, { 'aria-label': 'Account' })}
        </nav>

        {loadError && <p className="banner-error" role="alert">{loadError}</p>}

        {tab === 'available' && <AvailablePage />}
        {tab === 'active' && <MyJobsPage />}
        {tab === 'completed' && <CompletedPage />}
        {tab === 'account' && <AccountPage />}

        {lastUpdated && tab !== 'account' && <p className="updated">Updated {lastUpdated.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</p>}
      </main>
      <Toast />
    </div>
  )
}

// An approved partner's day: orders to pick up, jobs in progress, completed work and their account.
function DashboardPage() {
  return <JobsProvider><Dashboard /></JobsProvider>
}

export default DashboardPage
