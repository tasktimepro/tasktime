/**
 * Custom handled incident catalog:
 * ../../docs/debugbundle-custom-incidents.md
 */

import { createDebugBundleBrowserSdk } from '@debugbundle/sdk-browser'

let isInitialized = false
const debugBundle = createDebugBundleBrowserSdk()
const handledIncidentLastCapturedAt = new Map()

function safeCaptureException(error) {
    try {
        debugBundle.captureException(error)
        return true
    } catch {
        return false
    }
}

function normalizeUnknownError(error, fallbackMessage = 'Unexpected runtime error') {
    if (error instanceof Error) {
        return error
    }

    if (typeof error === 'string' && error.trim().length > 0) {
        return new Error(error)
    }

    return new Error(fallbackMessage)
}

function setErrorMetadata(targetError, key, value) {
    try {
        targetError[key] = value
    } catch {
        // Error objects can be frozen by browser APIs or third-party code.
    }
}

function stringifyOriginalValue(value) {
    try {
        return String(value)
    } catch {
        return '[unserializable]'
    }
}

function shouldCaptureHandledIncident(incidentKey, throttleMs) {
    if (!incidentKey || throttleMs <= 0) {
        return true
    }

    const now = Date.now()
    const lastCapturedAt = handledIncidentLastCapturedAt.get(incidentKey) ?? 0

    if ((now - lastCapturedAt) < throttleMs) {
        return false
    }

    handledIncidentLastCapturedAt.set(incidentKey, now)
    return true
}

function attachIncidentMetadata(targetError, {
    incidentKey,
    handled = false,
    context,
    originalError,
}) {
    if (incidentKey) {
        setErrorMetadata(targetError, 'debugbundleIncidentKey', incidentKey)
    }

    if (handled) {
        setErrorMetadata(targetError, 'debugbundleHandled', true)
    }

    if (context && Object.keys(context).length > 0) {
        setErrorMetadata(targetError, 'debugbundleContext', context)
    }

    if (originalError instanceof Error) {
        setErrorMetadata(targetError, 'debugbundleOriginalName', originalError.name)
        setErrorMetadata(targetError, 'debugbundleOriginalMessage', originalError.message)
    } else if (originalError != null) {
        setErrorMetadata(targetError, 'debugbundleOriginalValue', stringifyOriginalValue(originalError))
    }
}

function getProjectToken() {
    const token = import.meta.env.VITE_DEBUGBUNDLE_PROJECT_TOKEN

    if (typeof token !== 'string') {
        return null
    }

    const trimmedToken = token.trim()

    return trimmedToken.length > 0 ? trimmedToken : null
}

function getEnvironment() {
    const configuredEnvironment = import.meta.env.VITE_DEBUGBUNDLE_ENVIRONMENT

    if (typeof configuredEnvironment === 'string' && configuredEnvironment.trim().length > 0) {
        return configuredEnvironment.trim()
    }

    return import.meta.env.PROD ? 'production' : 'development'
}

export function initializeDebugBundle() {
    if (isInitialized) {
        return false
    }

    const projectToken = getProjectToken()

    if (!projectToken) {
        return false
    }

    try {
        debugBundle.init({
            projectToken,
            environment: getEnvironment(),
            service: 'tasktime-web',
        })
    } catch {
        return false
    }

    isInitialized = true

    return true
}

export function captureDebugBundleException(error) {
    if (!isInitialized || error == null) {
        return false
    }

    const normalizedError = normalizeUnknownError(error)
    return safeCaptureException(normalizedError)
}

export function captureDebugBundleIncident({
    incidentKey,
    name = 'TaskTimeHandledIncident',
    message,
    error,
    context,
    throttleMs = 5 * 60 * 1000,
}) {
    if (!isInitialized || !incidentKey || !message) {
        return false
    }

    if (!shouldCaptureHandledIncident(incidentKey, throttleMs)) {
        return false
    }

    const incidentError = new Error(message)
    incidentError.name = name

    if (error != null) {
        incidentError.cause = normalizeUnknownError(error, message)
    }

    attachIncidentMetadata(incidentError, {
        incidentKey,
        handled: true,
        context,
        originalError: error,
    })

    return safeCaptureException(incidentError)
}

export function captureDebugBundleGlobalError(error, context) {
    if (!isInitialized) {
        return false
    }

    const normalizedError = normalizeUnknownError(error, 'Uncaught browser error')
    attachIncidentMetadata(normalizedError, {
        incidentKey: 'browser.global_error',
        context,
    })
    return safeCaptureException(normalizedError)
}

export function captureDebugBundleUnhandledRejection(reason, context) {
    if (!isInitialized) {
        return false
    }

    const normalizedError = normalizeUnknownError(reason, 'Unhandled promise rejection')
    attachIncidentMetadata(normalizedError, {
        incidentKey: 'browser.unhandled_rejection',
        context,
        originalError: reason,
    })
    return safeCaptureException(normalizedError)
}

export function captureDebugBundleSecurityPolicyViolation(event) {
    return captureDebugBundleIncident({
        incidentKey: 'browser.csp_violation',
        name: 'TaskTimeSecurityPolicyViolation',
        message: 'TaskTime Content Security Policy violation',
        context: {
            blockedURI: event?.blockedURI ?? null,
            disposition: event?.disposition ?? null,
            effectiveDirective: event?.effectiveDirective ?? null,
            originalPolicy: event?.originalPolicy ?? null,
            sourceFile: event?.sourceFile ?? null,
            violatedDirective: event?.violatedDirective ?? null,
        },
        throttleMs: 5 * 60 * 1000,
    })
}
