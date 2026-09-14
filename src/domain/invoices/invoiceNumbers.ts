const DECIMAL_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Read a finite invoice number from typed data or a browser number input.
 * Empty, malformed, and non-decimal strings remain invalid so billing checks
 * can fail closed instead of silently changing an amount.
 */
export function getFiniteInvoiceNumber(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value.trim();
    if (!normalized || !DECIMAL_NUMBER_PATTERN.test(normalized)) {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}
