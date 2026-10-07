import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import DeliveryApp from './DeliveryApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DeliveryApp />
  </StrictMode>,
)
