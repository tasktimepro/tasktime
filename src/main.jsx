import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import {
  captureDebugBundleGlobalError,
  captureDebugBundleSecurityPolicyViolation,
  captureDebugBundleUnhandledRejection,
  initializeDebugBundle,
} from './utils/debugbundle'
import { registerAppServiceWorker } from './utils/serviceWorkerRegistration'

const VIEWPORT_HEIGHT_PROPERTY = '--viewport-height'

initializeDebugBundle()

const isStandalonePWA = typeof window !== 'undefined' && (
  window.navigator.standalone === true ||
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
)

function isTouchViewportEnvironment() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  const hasCoarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  const maxTouchPoints = Number.isFinite(navigator.maxTouchPoints) ? navigator.maxTouchPoints : 0

  return hasCoarsePointer || maxTouchPoints > 0
}

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
  } else if (visualHeight != null && isTouchViewportEnvironment()) {
    // On touch devices, visualViewport tracks browser chrome and on-screen keyboard changes.
    viewportHeight = visualHeight
  } else {
    // Desktop zoom can shrink visualViewport independently and leave blank space at the bottom
    // if we size the full app shell from it. Use the layout viewport there instead.
    viewportHeight = innerH
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

function shouldIgnoreSecurityPolicyViolation(event) {
  return !import.meta.env.PROD &&
    event?.blockedURI === 'eval' &&
    (event?.effectiveDirective === 'script-src' || event?.violatedDirective === 'script-src')
}

// Global error handlers - catch uncaught exceptions and unhandled promise rejections
// so they don't silently disappear in production.
window.addEventListener('error', (event) => {
  const error = event.error ?? event.message

  console.error('[TaskTime] Uncaught error:', error)
  captureDebugBundleGlobalError(error, {
    colno: event.colno ?? null,
    filename: event.filename ?? null,
    lineno: event.lineno ?? null,
    message: event.message ?? null,
  })
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[TaskTime] Unhandled promise rejection:', event.reason)
  captureDebugBundleUnhandledRejection(event.reason, {
    type: event.type,
  })
})

window.addEventListener('securitypolicyviolation', (event) => {
  if (shouldIgnoreSecurityPolicyViolation(event)) {
    return
  }

  console.error('[TaskTime] Content Security Policy violation:', event)
  captureDebugBundleSecurityPolicyViolation(event)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerAppServiceWorker({
  isProd: import.meta.env.PROD,
})
