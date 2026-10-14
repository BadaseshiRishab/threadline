import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { PartnerProvider } from './context/PartnerContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PartnerProvider>
      <App />
    </PartnerProvider>
  </StrictMode>,
)
