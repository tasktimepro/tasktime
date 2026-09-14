const MINUTE_IN_MS = 60 * 1000;

/**
 * Convert exact selected source time into the invoice composer's canonical
 * two-decimal hours. Sub-minute remainder is intentionally ignored in invoice
 * presentation and pricing while the exact source milliseconds stay stored in
 * the billing snapshot.
 */
export function getCanonicalInvoiceHours(durationMs: number): number {
    const wholeMinutes = getInvoiceWholeMinutesFromDuration(durationMs);

    return Math.round((wholeMinutes / 60) * 100) / 100;
}

/**
 * Discard the sub-minute remainder from an exact selected source duration.
 */
export function getInvoiceWholeMinutesFromDuration(durationMs: number): number {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
        return 0;
    }

    return Math.floor(durationMs / MINUTE_IN_MS);
}

/**
 * Interpret the composer's decimal-hours input at its displayed minute level.
 */
export function getInvoiceWholeMinutesFromHours(hours: number): number {
    if (!Number.isFinite(hours) || hours <= 0) {
        return 0;
    }

    return Math.round(hours * 60);
}
