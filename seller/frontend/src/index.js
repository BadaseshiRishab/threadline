import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { SellerProvider } from './context/SellerContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SellerProvider>
      <App />
    </SellerProvider>
  </StrictMode>,
)
