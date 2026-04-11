import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { registerAppServiceWorker } from './utils/serviceWorkerRegistration'

// Global error handlers - catch uncaught exceptions and unhandled promise rejections
// so they don't silently disappear in production.
window.addEventListener('error', (event) => {
    console.error('[TaskTime] Uncaught error:', event.error ?? event.message);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('[TaskTime] Unhandled promise rejection:', event.reason);
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerAppServiceWorker({
  isProd: import.meta.env.PROD,
})
