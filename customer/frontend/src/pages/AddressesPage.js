import { MapPin, Plus } from 'lucide-react'
import AccountLayout from '../components/AccountLayout'
import EmptyState from '../components/EmptyState'
import { useStore } from '../context/StoreContext'

function AddressCard({ address, isDefault }) {
  const { setSelectedAddressId, openAddressModal, removeAddress } = useStore()
  return <article className="address-card">
    <div className="address-card-body">
      <div className="address-card-top"><strong>{address.name}</strong><span className="address-type">{address.type}</span></div>
      <p>{address.line}{address.locality ? `, ${address.locality}` : ''}<br />{address.city} - {address.pincode}<br />{address.state}</p>
      <p>Mobile: <b>{address.phone}</b></p>
      {!isDefault && <button type="button" className="make-default" onClick={() => setSelectedAddressId(address.id)}>Make this default</button>}
    </div>
    <div className="address-card-actions"><button type="button" onClick={() => openAddressModal(address)}>Edit</button><button type="button" onClick={() => removeAddress(address.id)}>Remove</button></div>
  </article>
}

function AddressesPage() {
  const { addresses, selectedAddressId, openAddressModal, shopSettings } = useStore()
  const defaultAddress = addresses.find((entry) => entry.id === selectedAddressId)
  const others = addresses.filter((entry) => entry.id !== selectedAddressId)
  return <AccountLayout>
    <div className="address-page-head"><h2>Saved Addresses</h2><button className="outline-button small" type="button" onClick={() => openAddressModal()}><Plus size={14} /> Add new address</button></div>
    {addresses.length ? <>
      {defaultAddress && <><h3 className="address-group">Default address</h3><AddressCard address={defaultAddress} isDefault /></>}
      {others.length > 0 && <><h3 className="address-group">Other addresses</h3><div className="address-list">{others.map((entry) => <AddressCard address={entry} isDefault={false} key={entry.id} />)}</div></>}
    </> : <EmptyState icon={<MapPin size={46} />} title="Save your addresses now" text={`Add your home and office addresses for a faster checkout. We currently deliver within ${shopSettings.deliveryAreaName}.`}><button className="outline-button" type="button" onClick={() => openAddressModal()}>Add new address</button></EmptyState>}
  </AccountLayout>
}

export default AddressesPage
