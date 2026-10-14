import { Heart, LogOut, MapPin, PackageCheck, Pencil, ShoppingBag, UserRound } from 'lucide-react'
import AccountLayout from '../components/AccountLayout'
import { useStore } from '../context/StoreContext'

// The account overview: who is signed in, and shortcuts to orders, wishlist, bag, addresses and profile.
function AccountPage() {
  const { navigateTo, authUser, profile, setProfileDraft, logoutUser, orders, wishlist, bagCount, addresses } = useStore()
  const tiles = [
    { icon: <PackageCheck size={30} />, title: 'Orders', text: 'Check your order status', path: '/orders', count: orders.length },
    { icon: <Heart size={30} />, title: 'Wishlist', text: 'All the products you have saved', path: '/wishlist', count: wishlist.length },
    { icon: <ShoppingBag size={30} />, title: 'Bag', text: 'Items waiting to be ordered', path: '/cart', count: bagCount },
    { icon: <MapPin size={30} />, title: 'Addresses', text: 'Save addresses for a hassle-free checkout', path: '/address', count: addresses.length },
    { icon: <UserRound size={30} />, title: 'Profile Details', text: 'Change your profile details', path: '/profile', count: 0 },
  ]
  return <AccountLayout>
    <div className="overview-hero">
      <span className="overview-avatar">{(profile.name || authUser?.email || '?').trim().charAt(0).toUpperCase()}</span>
      <div><strong>{profile.name || 'Add your name'}</strong><span>{profile.email || authUser?.email}</span>{profile.phone && <span>+91 {profile.phone}</span>}</div>
      <button className="outline-button small" type="button" onClick={() => { navigateTo('/profile'); setProfileDraft({ ...profile }) }}><Pencil size={13} /> Edit profile</button>
    </div>
    <div className="overview-grid">{tiles.map((tile) => <button type="button" className="overview-tile" key={tile.title} onClick={() => navigateTo(tile.path)}>{tile.icon}<strong>{tile.title}{tile.count > 0 && <b>{tile.count}</b>}</strong><span>{tile.text}</span></button>)}</div>
    <button className="primary-button overview-logout" type="button" onClick={() => void logoutUser()}><LogOut size={16} /> Logout</button>
  </AccountLayout>
}

export default AccountPage
