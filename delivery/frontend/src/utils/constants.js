export const vehicleTypes = ['Bike', 'Scooter', 'Bicycle', 'Van']
export const emptyApplication = { name: '', email: '', phone: '', password: '', vehicleType: 'Bike', vehicleNumber: '', licenceNumber: '', area: '' }
// Uploaded with the application; the API stores them privately for the review team.
export const documentKinds = [
  { kind: 'licence', field: 'licenceDoc', label: 'Driving licence photo' },
  { kind: 'rc', field: 'rcDoc', label: 'Vehicle RC photo' },
]
export const documentTypes = ['image/jpeg', 'image/png', 'application/pdf']
export const maxDocumentSize = 5 * 1024 * 1024

// The partner's side of the order journey. "shipped" is shown as picked up, because that is what it means here.
export const stageLabels = { placed: 'Waiting for seller to pack', packed: 'Ready for pickup', shipped: 'Picked up', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' }
export const stages = ['packed', 'shipped', 'out_for_delivery', 'delivered']
export const returnLabels = { awaiting_partner: 'Waiting for a partner', assigned: 'Collect from customer', picked_up: 'Return to seller', returned: 'Returned to seller' }
export const emptyReturns = { available: [], active: [], completed: [] }
