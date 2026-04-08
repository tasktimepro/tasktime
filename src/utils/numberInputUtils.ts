export function parseOptionalNumberInput(value: string | number | null | undefined): number | null {

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
        return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

export function parseOptionalPositiveNumberInput(value: string | number | null | undefined): number | null {
    const parsed = parseOptionalNumberInput(value);

    if (parsed === null || parsed <= 0) {
        return null;
    }

    return parsed;
}

export function parseIntegerInputWithFallback(
    value: string | number | null | undefined,
    fallback: number,
    options: { min?: number; max?: number } = {}
): number {

    const parsed = parseOptionalNumberInput(value);

    if (parsed === null || !Number.isInteger(parsed)) {
        return fallback;
    }

    let normalized = parsed;

    if (typeof options.min === 'number') {
        normalized = Math.max(options.min, normalized);
    }

    if (typeof options.max === 'number') {
        normalized = Math.min(options.max, normalized);
    }

    return normalized;
}