import { createDebugBundleBrowserSdk } from '@debugbundle/sdk-browser'

let isInitialized = false
const debugBundle = createDebugBundleBrowserSdk()

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

    debugBundle.init({
        projectToken,
        environment: getEnvironment(),
        service: 'tasktime-web',
    })

    isInitialized = true

    return true
}

export function captureDebugBundleException(error) {
    if (!isInitialized || error == null) {
        return
    }

    debugBundle.captureException(error)
}