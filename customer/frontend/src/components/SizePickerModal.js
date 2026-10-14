import { useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import { formatPrice } from '../utils/format'
import { discountOf, mrpOf, priceOf } from '../utils/product'
import { useEscapeKey } from '../utils/useEscapeKey'

// Asks for a size before a wishlisted product with several sizes moves to the bag.
function SizePickerModal() {
  const { sizePicker: product, setSizePicker, moveToBag } = useStore()
  const [size, setSize] = useState('')
  const close = () => setSizePicker(null)
  useEscapeKey(true, close)
  const price = priceOf(product)
  const mrp = mrpOf(product)
  const sizeStock = Number(product.stock?.[size] || 0)
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="size-picker-title">
    <button className="modal-backdrop" type="button" aria-label="Close" onClick={close} />
    <div className="modal-card size-picker">
      <div className="size-picker-product">
        <img src={product.imageUrl} alt="" />
        <div><h3>{product.name}</h3><p><strong>{formatPrice(price)}</strong>{mrp > price && <><del>{formatPrice(mrp)}</del><span>({discountOf(product)}% OFF)</span></>}</p></div>
        <button type="button" aria-label="Close" onClick={close}><X size={20} /></button>
      </div>
      <div className="size-picker-body">
        <h2 id="size-picker-title">Select size</h2>
        <div className="product-size-options">{Object.entries(product.stock || {}).map(([option, count]) => <button type="button" className={size === option ? 'selected' : ''} disabled={Number(count) < 1} aria-pressed={size === option} onClick={() => setSize(option)} key={option}>{option === 'One size' ? 'Onesize' : option}</button>)}</div>
        {sizeStock > 0 && sizeStock < 5 && <p className="product-stock-note">Only {sizeStock} left!</p>}
      </div>
      <div className="size-picker-actions"><button className="primary-button" type="button" disabled={!size} onClick={() => void moveToBag(product, size)}>Done</button></div>
    </div>
  </div>
}

export default SizePickerModal
