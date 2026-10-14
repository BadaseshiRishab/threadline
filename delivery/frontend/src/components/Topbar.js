import { LogOut, RefreshCw, Truck } from 'lucide-react'
import { usePartner } from '../context/PartnerContext'

function Topbar({ loading = false, onRefresh }) {
  const { signOut } = usePartner()
  return <header className="topbar">
    <div className="topbar-inner">
      <span className="brand-mark"><Truck size={18} /> Threadline <small>Delivery</small></span>
      <div className="topbar-actions">
        <button className="icon-button" type="button" title="Refresh" aria-label="Refresh" disabled={loading} onClick={() => void onRefresh()}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button>
        <button className="icon-button" type="button" title="Sign out" aria-label="Sign out" onClick={() => void signOut()}><LogOut size={17} /></button>
      </div>
    </div>
  </header>
}

export default Topbar
