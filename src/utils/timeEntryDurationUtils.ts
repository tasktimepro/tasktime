type TimeEntryDurationLike = {
    start: number;
    end?: number | null;
    billedDurationMs?: number | null;
    billingIncrementMinutes?: number | null;
};

const MINUTE_IN_MS = 60 * 1000;

const normalizeBillingIncrementMinutes = (incrementMinutes?: number | null): number | null => {
    if (typeof incrementMinutes !== 'number' || !Number.isFinite(incrementMinutes) || incrementMinutes <= 0) {
        return null;
    }

    return Math.floor(incrementMinutes);
};

/**
 * Return the actual worked duration from stored timestamps.
 */
export const getActualDurationMs = (entry: TimeEntryDurationLike): number => {
    if (typeof entry.start !== 'number' || typeof entry.end !== 'number') {
        return 0;
    }

    const duration = entry.end - entry.start;

    if (!Number.isFinite(duration) || duration <= 0) {
        return 0;
    }

    return duration;
};

/**
 * Return the billable duration, falling back to actual worked time.
 */
export const getBillableDurationMs = (entry: TimeEntryDurationLike): number => {
    const actualDuration = getActualDurationMs(entry);

    if (typeof entry.billedDurationMs === 'number' && Number.isFinite(entry.billedDurationMs) && entry.billedDurationMs > 0) {
        return entry.billedDurationMs;
    }

    const billingIncrementMinutes = normalizeBillingIncrementMinutes(entry.billingIncrementMinutes);

    if (billingIncrementMinutes) {
        return roundDurationUpToIncrement(actualDuration, billingIncrementMinutes);
    }

    return actualDuration;
};

/**
 * Check whether an entry carries a billable duration override.
 */
export const hasBillableDurationOverride = (entry: TimeEntryDurationLike): boolean => {
    const actualDuration = getActualDurationMs(entry);
    const billableDuration = getBillableDurationMs(entry);

    return actualDuration > 0 && billableDuration !== actualDuration;
};

/**
 * Round positive durations up to the configured billing increment.
 */
export const roundDurationUpToIncrement = (durationMs: number, incrementMinutes?: number | null): number => {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
        return 0;
    }

    const normalizedIncrementMinutes = normalizeBillingIncrementMinutes(incrementMinutes);

    if (!normalizedIncrementMinutes) {
        return durationMs;
    }

    const incrementMs = normalizedIncrementMinutes * MINUTE_IN_MS;
    return Math.ceil(durationMs / incrementMs) * incrementMs;
};

/**
 * Build persisted billing metadata for time entries created from timers.
 */
export const buildBillableDurationFields = ({
    start,
    end,
    billingIncrementMinutes,
}: {
    start: number;
    end: number;
    billingIncrementMinutes?: number | null;
}): Pick<TimeEntryDurationLike, 'billedDurationMs' | 'billingIncrementMinutes'> => {
    const normalizedIncrementMinutes = normalizeBillingIncrementMinutes(billingIncrementMinutes);

    if (!normalizedIncrementMinutes) {
        return {};
    }

    const actualDuration = getActualDurationMs({ start, end });

    if (actualDuration <= 0) {
        return {};
    }

    return {
        billedDurationMs: roundDurationUpToIncrement(actualDuration, normalizedIncrementMinutes),
        billingIncrementMinutes: normalizedIncrementMinutes,
    };
};