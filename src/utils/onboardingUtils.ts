export const ONBOARDING_COMPLETED_KEY = 'tasktime-onboarding-completed';
export const ONBOARDING_PENDING_KEY = 'tasktime-onboarding-pending';

export function hasCompletedOnboarding(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
    } catch {
        return false;
    }
}

export function hasPendingOnboarding(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        return localStorage.getItem(ONBOARDING_PENDING_KEY) === 'true';
    } catch {
        return false;
    }
}

export function setOnboardingCompleted(completed: boolean): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(ONBOARDING_COMPLETED_KEY, String(completed));

        if (completed) {
            localStorage.removeItem(ONBOARDING_PENDING_KEY);
        }
    } catch {
        // Ignore storage failures and continue showing onboarding when needed.
    }
}

export function setOnboardingPending(pending: boolean): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(ONBOARDING_PENDING_KEY, String(pending));
    } catch {
        // Ignore storage failures and continue showing onboarding when needed.
    }
}

export function resetOnboardingCompleted(): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
        localStorage.removeItem(ONBOARDING_PENDING_KEY);
    } catch {
        // Ignore storage failures during reset.
    }
}