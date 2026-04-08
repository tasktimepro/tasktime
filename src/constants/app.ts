declare const __APP_VERSION__: string;

/**
 * Application-wide constants
 * 
 * Centralizes magic numbers and configuration values used throughout the app.
 * This improves maintainability and makes values easier to adjust.
 */

// =============================================================================
// VERSION CONSTANTS
// =============================================================================

/** Current application version (injected by Vite at build time) */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined'
	? __APP_VERSION__
	: '0.0.0';

// =============================================================================
// TIME CONSTANTS
// =============================================================================

/** One second in milliseconds */
export const ONE_SECOND_MS = 1000;

/** One minute in milliseconds */
export const ONE_MINUTE_MS = 60 * 1000;

/** One hour in milliseconds */
export const ONE_HOUR_MS = 60 * 60 * 1000;

/** One day in milliseconds */
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Thirty days in milliseconds (used for "recent" activity filtering) */
export const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

// =============================================================================
// TIMER CONSTANTS
// =============================================================================

/** Interval for timer updates (1 second) */
export const TIMER_UPDATE_INTERVAL_MS = 1000;

/** 
 * Interval for timer heartbeat auto-save (30 seconds).
 * Periodically saves timer state to IndexedDB as a safety measure
 * in case of browser crash or unexpected shutdown.
 */
export const TIMER_HEARTBEAT_INTERVAL_MS = 30 * ONE_SECOND_MS;

// =============================================================================
// BILLING CONSTANTS
// =============================================================================

/** 
 * Minimum time threshold to consider a task as having "significant" billable time.
 * Tasks with less than this amount won't be auto-marked as billable.
 * Default: 30 seconds (30,000 milliseconds)
 */
export const BILLABLE_TIME_THRESHOLD_MS = 30000;

// =============================================================================
// CACHE CONSTANTS
// =============================================================================

/** 
 * Duration for which exchange rates are cached before fetching new ones.
 * Default: 24 hours
 */
export const EXCHANGE_RATE_CACHE_MS = ONE_DAY_MS;

// =============================================================================
// UI CONSTANTS
// =============================================================================

/** Default toast notification duration in milliseconds */
export const TOAST_DURATION_DEFAULT_MS = 3000;

/** Warning toast duration (longer to ensure user sees it) */
export const TOAST_DURATION_WARNING_MS = 5000;

// =============================================================================
// PAGINATION CONSTANTS
// =============================================================================

/** Maximum items per page in paginated lists */
export const MAX_PAGINATION_ITEMS = 20;

// =============================================================================
// PWA CONSTANTS
// =============================================================================

/** 
 * Delay before showing the PWA install prompt.
 * We wait to ensure user has had time to explore the app.
 * Default: 60 seconds
 */
export const INSTALL_PROMPT_DELAY_MS = 60 * ONE_SECOND_MS;
