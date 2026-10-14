import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ApiError, errorMessage } from '../api/client'
import * as deliveryApi from '../api/delivery'
import { emptyReturns, stageLabels } from '../utils/constants'
import { orderNumber, rupees, without } from '../utils/format'
import { usePartner } from './PartnerContext'

const JobsContext = createContext(null)

export function useJobs() {
  const value = useContext(JobsContext)
  if (!value) throw new Error('useJobs must be used inside <JobsProvider>')
  return value
}

// An approved partner's deliveries and return pickups, and what they can do with them.
export function JobsProvider({ children }) {
  const { refreshMe, showNotice } = usePartner()
  const [tab, setTab] = useState('available')
  const [available, setAvailable] = useState([])
  const [active, setActive] = useState([])
  const [completed, setCompleted] = useState([])
  const [returns, setReturns] = useState(emptyReturns)
  const [maxOpenJobs, setMaxOpenJobs] = useState(5)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  // Codes typed into each card, the cards with a request in flight, and each card's last error, by job id.
  const [otps, setOtps] = useState({})
  const [busy, setBusy] = useState({})
  const [cardErrors, setCardErrors] = useState({})

  const loadDeliveries = useCallback(async () => {
    setLoading(true)
    try {
      const result = await deliveryApi.fetchDeliveries()
      setAvailable(result.available)
      setActive(result.active)
      setCompleted(result.completed)
      setReturns(result.returns ?? emptyReturns)
      setMaxOpenJobs(result.maxOpenJobs)
      setLoadError('')
      setLastUpdated(new Date())
    } catch (error) {
      // Signed out, deactivated, or no longer approved: re-read the account to show the right screen.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) { await refreshMe(); return }
      setLoadError(errorMessage(error, 'Could not load deliveries.'))
    } finally {
      setLoading(false)
    }
  }, [refreshMe])

  // New orders show up in the pool without reloading.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void loadDeliveries() }
    void loadDeliveries()
    const timer = window.setInterval(refresh, 30_000)
    return () => window.clearInterval(timer)
  }, [loadDeliveries])

  const setOtp = (key, value) => setOtps((current) => ({ ...current, [key]: value.replace(/\D/g, '').slice(0, 4) }))

  const runCardAction = async (id, action) => {
    setBusy((current) => ({ ...current, [id]: true }))
    setCardErrors((current) => ({ ...current, [id]: '' }))
    try {
      await action()
    } catch (error) {
      setCardErrors((current) => ({ ...current, [id]: errorMessage(error, 'Something went wrong. Try again.') }))
      // A taken or vanished order should disappear from the pool on the next refresh.
      if (error instanceof ApiError && error.status === 409) void loadDeliveries()
    } finally {
      setBusy((current) => ({ ...current, [id]: false }))
    }
  }

  const acceptOrder = (order) => runCardAction(order._id, async () => {
    const result = await deliveryApi.acceptOrder(order._id)
    setAvailable((current) => current.filter((entry) => entry._id !== order._id))
    setActive((current) => [...current, result.order])
    showNotice(`Order #${orderNumber(order._id)} is yours`)
    setTab('active')
  })

  const releaseOrder = (delivery) => runCardAction(delivery._id, async () => {
    if (!window.confirm(`Release order #${orderNumber(delivery._id)}? It goes back to the pool for other partners.`)) return
    await deliveryApi.releaseOrder(delivery._id)
    setActive((current) => current.filter((entry) => entry._id !== delivery._id))
    showNotice('Order released')
    void loadDeliveries()
  })

  // Codes are typed per seller, because an order with items from two sellers is collected from two places.
  const pickupKey = (delivery, pickup) => `${delivery._id}:${pickup.sellerId}`
  const confirmPickup = (delivery, pickup) => runCardAction(delivery._id, async () => {
    const key = pickupKey(delivery, pickup)
    const { order } = await deliveryApi.confirmPickup(delivery._id, pickup.sellerId, otps[key] || '')
    setActive((current) => current.map((entry) => entry._id === order._id ? order : entry))
    setOtps((current) => without(current, key))
    showNotice(order.status === 'shipped' ? 'Order picked up. Head to the customer.' : `Collected from ${pickup.name}`)
  })

  const advance = (delivery, status) => runCardAction(delivery._id, async () => {
    const otp = otps[delivery._id] || ''
    const { order } = await deliveryApi.updateStatus(delivery._id, status === 'delivered' ? { status, otp } : { status })
    if (order.status === 'delivered') {
      setActive((current) => current.filter((entry) => entry._id !== order._id))
      setCompleted((current) => [order, ...current])
      showNotice(order.cashCollected ? `Delivered. Collected ${rupees(order.cashCollected)} cash.` : 'Delivered. Nice work!')
    } else {
      setActive((current) => current.map((entry) => entry._id === order._id ? order : entry))
      showNotice(stageLabels[order.status])
    }
    setOtps((current) => without(current, delivery._id))
  })

  // Return pickups: accept from the pool, collect with the customer's return code, drop off with the seller's.
  const updateReturn = (job) => setReturns((current) => job.status === 'returned'
    ? { ...current, active: current.active.filter((entry) => entry._id !== job._id), completed: [job, ...current.completed] }
    : { ...current, active: current.active.map((entry) => entry._id === job._id ? job : entry) })
  const acceptReturn = (job) => runCardAction(job._id, async () => {
    const result = await deliveryApi.acceptReturn(job._id)
    setReturns((current) => ({ ...current, available: current.available.filter((entry) => entry._id !== job._id), active: [...current.active, result.job] }))
    showNotice(`Return pickup for order #${orderNumber(job.orderId)} is yours`)
    setTab('active')
  })
  const releaseReturn = (job) => runCardAction(job._id, async () => {
    if (!window.confirm(`Release the return pickup for order #${orderNumber(job.orderId)}? It goes back to the pool for other partners.`)) return
    await deliveryApi.releaseReturn(job._id)
    setReturns((current) => ({ ...current, active: current.active.filter((entry) => entry._id !== job._id) }))
    showNotice('Return pickup released')
    void loadDeliveries()
  })
  const advanceReturn = (job) => runCardAction(job._id, async () => {
    const step = job.status === 'assigned' ? 'collect' : 'drop'
    const result = await deliveryApi.advanceReturn(job._id, step, otps[job._id] || '')
    updateReturn(result.job)
    setOtps((current) => without(current, job._id))
    showNotice(step === 'collect' ? 'Return collected. Take it to the seller.' : 'Returned to the seller. Nice work!')
  })

  const openJobs = active.length + returns.active.length
  const value = {
    tab, setTab, available, active, completed, returns, maxOpenJobs, openJobs, atCapacity: openJobs >= maxOpenJobs,
    loading, loadError, lastUpdated, loadDeliveries, otps, setOtp, busy, cardErrors,
    acceptOrder, releaseOrder, pickupKey, confirmPickup, advance, acceptReturn, releaseReturn, advanceReturn,
  }
  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>
}
