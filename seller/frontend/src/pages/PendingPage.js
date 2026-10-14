import { useState } from 'react'
import { ArrowRight, Check, Clock3, LayoutDashboard } from 'lucide-react'
import { errorMessage } from '../api/client'
import * as sellerApi from '../api/seller'
import Wordmark from '../components/Wordmark'
import { useSeller } from '../context/SellerContext'
import { normalizeProduct } from '../utils/product'

// Shown while admin reviews the seller's application.
function PendingPage() {
  const { identity, setPhase, setProducts } = useSeller()
  const [approvalMessage, setApprovalMessage] = useState('')

  const checkSellerApproval = async () => {
    try {
      const user = await sellerApi.fetchCurrentUser()
      if (user.sellerStatus === 'approved') {
        setPhase('dashboard')
        setApprovalMessage('')
        const sellerProducts = await sellerApi.fetchProducts()
        setProducts(sellerProducts.map(normalizeProduct))
        return
      }
      setApprovalMessage(user.sellerStatus === 'rejected' ? 'Your application needs updates. Contact seller support for details.' : 'Your application is still under review. Check back after the admin has made a decision.')
    } catch (error) {
      setApprovalMessage(errorMessage(error, 'Could not check your approval status.'))
    }
  }

  return (
    <main className="pending-shell">
      <header className="pending-header"><Wordmark /><span className="application-id">APPLICATION&nbsp; / &nbsp;{identity.id.slice(-8).toUpperCase()}</span></header>
      <section className="pending-content" id="top">
        <div className="pending-illustration"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-center"><Clock3 size={31} strokeWidth={1.5} /></div><span className="orbit-dot dot-one" /><span className="orbit-dot dot-two" /><span className="orbit-dot dot-three" /></div>
        <span className="eyebrow">APPLICATION RECEIVED</span>
        <h1>Good things<br />take <em>a moment.</em></h1>
        <p className="pending-copy">Your seller application is with our team. We’ll send an update to <strong>{identity.email || 'your registered email'}</strong> as soon as the review is complete.</p>
        <div className="review-timeline">
          <div className="timeline-item complete"><span><Check size={13} /></span><div><strong>Application submitted</strong><small>All your details are safely with us</small></div><time>NOW</time></div>
          <div className="timeline-item current"><span><Clock3 size={13} /></span><div><strong>Seller verification</strong><small>Usually completed in 2–3 business days</small></div><time>IN REVIEW</time></div>
          <div className="timeline-item"><span><LayoutDashboard size={13} /></span><div><strong>Your seller dashboard</strong><small>Products and store tools unlock after approval</small></div></div>
        </div>
        <button className="button button-primary pending-back" type="button" onClick={() => void checkSellerApproval()}>Check approval status<ArrowRight size={16} /></button>
        {approvalMessage && <p className="approval-feedback" role="status">{approvalMessage}</p>}
        <p className="prototype-note pending-prototype">Admin decisions appear here once your application has been reviewed.</p>
      </section>
      <footer className="pending-footer"><span>THREADLINE SELLER STUDIO</span><a href="mailto:sellers@threadline.example">Questions? Contact seller support</a></footer>
    </main>
  )
}

export default PendingPage
