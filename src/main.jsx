import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { registerAppServiceWorker } from './utils/serviceWorkerRegistration'

const VIEWPORT_HEIGHT_PROPERTY = '--viewport-height'

function getViewportHeight() {
  if (typeof window === 'undefined') {
    return null
  }

  const viewportHeight = window.visualViewport?.height ?? window.innerHeight

  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return null
  }

  return Math.round(viewportHeight)
}

function syncViewportHeight() {
  if (typeof document === 'undefined') {
    return
  }

  const viewportHeight = getViewportHeight()

  if (viewportHeight === null) {
    return
  }

  document.documentElement.style.setProperty(VIEWPORT_HEIGHT_PROPERTY, `${viewportHeight}px`)
}

function registerViewportHeightSync() {
  if (typeof window === 'undefined') {
    return
  }

  syncViewportHeight()

  window.addEventListener('resize', syncViewportHeight)
  window.addEventListener('orientationchange', syncViewportHeight)
  window.addEventListener('pageshow', syncViewportHeight)

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncViewportHeight)
    window.visualViewport.addEventListener('scroll', syncViewportHeight)
  }
}

registerViewportHeightSync()

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
