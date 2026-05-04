import * as Y from 'yjs';
import { normalizeCurrencyCode } from '@/utils/currencyUtils';
import { createExpensePaymentCurrencySnapshot, getExpensePaymentCurrencySnapshot } from '@/utils/expenseUtils';
import { objectToYMap, readEntity } from './entityUtils';

type BackfillOptions = {
    preferredCurrency: string;
    exchangeRates?: Record<string, number> | null;
};

export function hasPaidExpensesMissingCurrencySnapshotsInMap(
    expensesMap: Y.Map<string, unknown>
): boolean {
    let hasMissingSnapshot = false;

    expensesMap.forEach((value) => {
        if (hasMissingSnapshot) {
            return;
        }

        const expense = readEntity<Record<string, unknown>>(value);
        if (!expense || expense.paymentStatus !== 'paid') {
            return;
        }

        if (!getExpensePaymentCurrencySnapshot(expense)) {
            hasMissingSnapshot = true;
        }
    });

    return hasMissingSnapshot;
}

export function backfillPaidExpenseCurrencySnapshotsInMap(
    expensesMap: Y.Map<string, unknown>,
    options: BackfillOptions
): number {
    let backfilledCount = 0;
    const preferredCurrency = normalizeCurrencyCode(options.preferredCurrency);

    expensesMap.forEach((value, id) => {
        const expense = readEntity<Record<string, unknown>>(value);
        if (!expense || expense.paymentStatus !== 'paid') {
            return;
        }

        if (getExpensePaymentCurrencySnapshot(expense)) {
            return;
        }

        const expenseCurrency = normalizeCurrencyCode(
            typeof expense.currency === 'string' ? expense.currency : preferredCurrency
        );

        if (!options.exchangeRates && expenseCurrency !== preferredCurrency) {
            return;
        }

        const snapshot = createExpensePaymentCurrencySnapshot({
            expense,
            preferredCurrency,
            exchangeRates: options.exchangeRates,
        });

        if (value instanceof Y.Map) {
            value.set('paymentCurrencySnapshot', snapshot);
        } else {
            expensesMap.set(id, objectToYMap({
                ...expense,
                paymentCurrencySnapshot: snapshot,
            }));
        }

        backfilledCount += 1;
    });

    return backfilledCount;
}

export function backfillPaidExpenseCurrencySnapshotsInDoc(
    doc: Y.Doc,
    options: BackfillOptions
): number {
    const expensesMap = doc.getMap('expenses') as Y.Map<string, unknown>;
    if (expensesMap.size === 0) {
        return 0;
    }

    let backfilledCount = 0;

    doc.transact(() => {
        backfilledCount = backfillPaidExpenseCurrencySnapshotsInMap(expensesMap, options);
    }, 'expense-payment-snapshot-backfill');

    return backfilledCount;
}