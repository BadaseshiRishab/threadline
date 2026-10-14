import { useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '../context/StoreContext'
import { emptyAddressDraft } from '../utils/constants'
import { mobileError } from '../utils/mobile'
import { useEscapeKey } from '../utils/useEscapeKey'

// Add or edit a delivery address. Rendered while addressModal is set; addressModal.address is the one being edited.
function AddressModal() {
  const { addressModal, setAddressModal, selectedAddressId, saveAddress, shopSettings, inDeliveryArea } = useStore()
  const editing = addressModal.address
  const [draft, setDraft] = useState(editing ? { name: editing.name, phone: editing.phone, line: editing.line, locality: editing.locality || '', city: editing.city, state: editing.state, pincode: editing.pincode, type: editing.type } : emptyAddressDraft)
  const [makeDefault, setMakeDefault] = useState(editing ? selectedAddressId === editing.id : true)
  const close = () => setAddressModal(null)
  useEscapeKey(true, close)
  const outsideArea = draft.pincode.length === 6 && !inDeliveryArea(draft.pincode)

  const submit = (event) => {
    event.preventDefault()
    void saveAddress(draft, makeDefault, editing?.id || '')
  }

  return <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="address-modal-title">
    <button className="modal-backdrop" type="button" aria-label="Close" onClick={close} />
    <form className="modal-card" onSubmit={submit}>
      <div className="modal-head"><h2 id="address-modal-title">{editing ? 'Edit address' : 'Add new address'}</h2><button type="button" aria-label="Close" onClick={close}><X size={20} /></button></div>
      <div className="modal-body">
        <h3>Contact details</h3>
        <label className="field"><span>Name*</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoComplete="name" required autoFocus /></label>
        <label className="field field-phone"><span>Mobile no*</span><div><b>+91</b><input type="tel" inputMode="numeric" autoComplete="tel-national" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} required aria-invalid={Boolean(mobileError(draft.phone))} /></div>{mobileError(draft.phone) && <small className="field-error">{mobileError(draft.phone)}</small>}</label>
        <h3>Address</h3>
        <label className="field"><span>Pin code*</span><input inputMode="numeric" autoComplete="postal-code" value={draft.pincode} onChange={(event) => { const pincode = event.target.value.replace(/\D/g, '').slice(0, 6); setDraft((current) => ({ ...current, pincode, ...(inDeliveryArea(pincode) ? { city: current.city || shopSettings.deliveryCity, state: current.state || shopSettings.deliveryState } : {}) })) }} required aria-invalid={outsideArea} />{outsideArea && <small className="field-error">We currently deliver only within {shopSettings.deliveryAreaName} (PIN codes starting with {shopSettings.deliveryPinPrefix}).</small>}</label>
        <label className="field"><span>Address (house no, building, street, area)*</span><input value={draft.line} onChange={(event) => setDraft({ ...draft, line: event.target.value })} autoComplete="street-address" required /></label>
        <label className="field"><span>Locality / town</span><input value={draft.locality} onChange={(event) => setDraft({ ...draft, locality: event.target.value })} /></label>
        <div className="field-row"><label className="field"><span>City / district*</span><input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} required /></label><label className="field"><span>State*</span><input value={draft.state} onChange={(event) => setDraft({ ...draft, state: event.target.value })} required /></label></div>
        <h3>Save address as</h3>
        <div className="address-type-picker">{['Home', 'Work'].map((type) => <button type="button" className={draft.type === type ? 'selected' : ''} aria-pressed={draft.type === type} onClick={() => setDraft({ ...draft, type })} key={type}>{type}</button>)}</div>
        <label className="checkbox-field"><input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} /> Make this my default address</label>
      </div>
      <div className="modal-actions"><button className="outline-button" type="button" onClick={close}>Cancel</button><button className="primary-button" type="submit">Save</button></div>
    </form>
  </div>
}

export default AddressModal
