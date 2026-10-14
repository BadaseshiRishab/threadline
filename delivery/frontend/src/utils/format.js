export const rupees = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
export const orderNumber = (id) => id.slice(-8).toUpperCase()
export const time = (value) => value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''
export const addressText = (address) => [address.line, address.city, address.state, address.pincode].filter(Boolean).join(', ')
export const mapsLink = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText(address))}`
export const isToday = (value) => Boolean(value) && new Date(value).toDateString() === new Date().toDateString()
export const minutesAgo = (value) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  return minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : time(value)
}
export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
export const itemLine = (item) => `${item.name}${item.size && item.size !== 'One size' ? ` · ${item.size}` : ''} × ${item.quantity}`
// Removes one key from an object kept in state, e.g. a code that has been used.
export const without = (record, key) => { const next = { ...record }; delete next[key]; return next }
