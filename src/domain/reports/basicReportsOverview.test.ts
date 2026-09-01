import { describe, expect, it } from 'vitest';

import { buildBasicReportsOverview } from './basicReportsOverview';

describe('Free current-month Reports overview', () => {
    it('uses the local half-open month, payment snapshot source values, all expenses, and actual time', () => {
        const now = new Date(2026, 7, 15, 12, 0, 0).getTime();
        const augustStart = new Date(2026, 7, 1).getTime();
        const septemberStart = new Date(2026, 8, 1).getTime();
        const overview = buildBasicReportsOverview({
            nowMs: now,
            timeZone: 'Europe/Ljubljana',
            invoices: [{
                id: 'paid',
                status: 'paid',
                date: '2026-08-02',
                paidAt: augustStart,
                total: 120,
                currency: 'USD',
                paymentCurrencySnapshot: {
                    capturedAt: augustStart,
                    sourceCurrency: 'USD',
                    sourceAmount: 120,
                    preferredCurrencyAtPayment: 'EUR',
                    preferredCurrencyAmount: 105,
                },
            }, {
                id: 'boundary', status: 'paid', date: '2026-09-01', paidAt: septemberStart,
                total: 50, currency: 'EUR',
            }] as never,
            expenses: [{
                id: 'expense', date: '2026-08-03', amount: 25, currency: 'eur',
                paymentStatus: 'unpaid', billingStatus: 'unbilled', billable: false,
            }] as never,
            entries: [{ id: 'entry', taskId: 'missing-is-fine', start: augustStart, end: augustStart + 3_600_000 }, {
                id: 'open', taskId: 'task', start: augustStart, end: Number.NaN,
            }] as never,
        });

        expect(overview).toMatchObject({
            version: 1,
            scope: 'basic-current-month',
            received: [{ currency: 'USD', amount: 120 }],
            expenses: [{ currency: 'EUR', amount: 25 }],
            trackedTimeMs: 3_600_000,
        });
        expect(Date.parse(overview.period.startAt)).toBe(augustStart);
        expect(Date.parse(overview.period.endBefore)).toBe(septemberStart);
    });
});
