import { endOfMonth, startOfMonth, subMonths } from 'date-fns';
import { parseStoredDate, toDisplayDate, toStorageDate } from './dateUtils';

export const DEFAULT_INVOICE_BILLING_PERIOD = 'all-time';

export const INVOICE_BILLING_PERIOD_OPTIONS = [
    { value: 'last-month', label: 'Last Month' },
    { value: 'month', label: 'This Month' },
    { value: 'all-time', label: 'All Time' },
    { value: 'custom', label: 'Custom Range' },
];

const VALID_BILLING_PERIOD_PRESETS = new Set(
    INVOICE_BILLING_PERIOD_OPTIONS.map((option) => option.value)
);

export const normalizeBillingPeriodPreset = (
    value,
    fallback = DEFAULT_INVOICE_BILLING_PERIOD
) => {
    if (typeof value === 'string' && VALID_BILLING_PERIOD_PRESETS.has(value)) {
        return value;
    }

    return fallback;
};

export const getBillingPeriodRange = ({
    preset = DEFAULT_INVOICE_BILLING_PERIOD,
    customStart = '',
    customEnd = '',
    today = new Date(),
} = {}) => {
    const normalizedPreset = normalizeBillingPeriodPreset(preset);

    if (normalizedPreset === 'all-time') {
        return {
            startDate: '',
            endDate: '',
        };
    }

    if (normalizedPreset === 'custom') {
        return {
            startDate: customStart || '',
            endDate: customEnd || '',
        };
    }

    const anchorDate = normalizedPreset === 'month' ? today : subMonths(today, 1);

    return {
        startDate: toStorageDate(startOfMonth(anchorDate)) || '',
        endDate: toStorageDate(endOfMonth(anchorDate)) || '',
    };
};

export const getDefaultInvoiceBillingPeriodState = (today = new Date()) => ({
    preset: DEFAULT_INVOICE_BILLING_PERIOD,
    ...getBillingPeriodRange({ preset: DEFAULT_INVOICE_BILLING_PERIOD, today }),
});

export const getStoredInvoiceBillingPeriodState = (invoice, today = new Date()) => {
    if (!invoice) {
        return getDefaultInvoiceBillingPeriodState(today);
    }

    const hasStoredBillingPeriod = Boolean(
        invoice.billingPeriodPreset || invoice.billingPeriodStart || invoice.billingPeriodEnd
    );

    if (!hasStoredBillingPeriod) {
        return {
            preset: 'all-time',
            startDate: '',
            endDate: '',
        };
    }

    return {
        preset: normalizeBillingPeriodPreset(invoice.billingPeriodPreset, DEFAULT_INVOICE_BILLING_PERIOD),
        startDate: invoice.billingPeriodStart || '',
        endDate: invoice.billingPeriodEnd || '',
    };
};

export const isStoredDateWithinBillingRange = (dateValue, startDate = '', endDate = '') => {
    if (!startDate && !endDate) {
        return true;
    }

    const parsedDate = parseStoredDate(dateValue);
    if (!parsedDate) {
        return false;
    }

    const parsedStart = startDate ? parseStoredDate(startDate) : null;
    const parsedEnd = endDate ? parseStoredDate(endDate) : null;

    if (parsedStart && parsedDate < parsedStart) {
        return false;
    }

    if (parsedEnd && parsedDate > parsedEnd) {
        return false;
    }

    return true;
};

export const formatBillingPeriodLabel = ({
    preset,
    startDate = '',
    endDate = '',
}) => {
    if (preset === 'all-time' && !startDate && !endDate) {
        return 'All Time';
    }

    if (startDate && endDate) {
        const formattedStart = toDisplayDate(startDate);
        const formattedEnd = toDisplayDate(endDate);

        if (formattedStart && formattedEnd) {
            if (formattedStart === formattedEnd) {
                return formattedStart;
            }

            return `${formattedStart} - ${formattedEnd}`;
        }
    }

    if (startDate) {
        return `From ${toDisplayDate(startDate)}`;
    }

    if (endDate) {
        return `Through ${toDisplayDate(endDate)}`;
    }

    return '';
};