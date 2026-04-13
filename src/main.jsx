import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { registerAppServiceWorker } from './utils/serviceWorkerRegistration'

const VIEWPORT_HEIGHT_PROPERTY = '--viewport-height'

const isStandalonePWA = typeof window !== 'undefined' && (
  window.navigator.standalone === true ||
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
)

function getViewportHeight() {
  if (typeof window === 'undefined') {
    return null
  }

  const visualHeight = window.visualViewport?.height
  const innerH = window.innerHeight

  let viewportHeight

  if (isStandalonePWA && visualHeight != null) {
    // In standalone PWA mode with viewport-fit=cover, visualViewport.height
    // may not include the area behind the home indicator. Use innerHeight
    // as the base unless the keyboard is open (visualViewport significantly shorter).
    const keyboardLikelyOpen = visualHeight < innerH * 0.85
    viewportHeight = keyboardLikelyOpen ? visualHeight : innerH
  } else {
    viewportHeight = visualHeight ?? innerH
  }

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
