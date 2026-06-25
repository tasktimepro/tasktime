import { markMeaningfulActivity } from '@/utils/usageMetrics';
import { toStorageDate } from '@/utils/dateUtils';
import { normalizeCurrencyCode, fetchExchangeRates } from '@/utils/currencyUtils';
import { createExpensePaymentCurrencySnapshot } from '@/utils/expenseUtils';
import { collectValidatedEntities } from '@/stores/yjs/validation';
import type { Client, Expense, Project } from '@/stores/yjs/types';
import type { AgentCommandContext } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import {
    assertPermission,
    assertReady,
    createValidatedEntity,
    getId,
    getNow,
    readRequiredEntity,
    requireString,
    updateValidatedEntity,
    withIdempotency,
} from './shared';

export interface ListExpensesCommandInput {
    clientId?: string | null;
    projectId?: string | null;
    billableOnly?: boolean;
}

export interface CreateExpenseCommandInput extends Partial<Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>> {
    id?: string;
    title: string;
    date: string;
    amount: number;
    currency: string;
    isPersonal: boolean;
    billable: boolean;
    createdAt?: number;
    updatedAt?: number;
    idempotencyKey?: string;
}

export interface MarkExpensePaidCommandInput {
    expenseId: string;
    amount?: number;
    paidOn?: string | null;
    paidBy?: string | null;
}

function getPreferredCurrency(context: AgentCommandContext): string {
    const stored = context.store.preferences.get('currency');
    return normalizeCurrencyCode(typeof stored === 'string' ? stored : undefined);
}

function shouldStorePaymentSnapshot(expense: Partial<Expense>, preferredCurrency: string): boolean {
    return normalizeCurrencyCode(expense.currency || preferredCurrency) !== preferredCurrency;
}

function validateExpenseReferences(context: AgentCommandContext, input: Partial<Expense>): void {
    if (input.clientId) {
        readRequiredEntity<Client>(context.store.clients as any, input.clientId, 'Client');
    }

    if (input.projectId) {
        readRequiredEntity<Project>(context.store.projects as any, input.projectId, 'Project');
    }
}

export function listExpensesCommand(context: AgentCommandContext, input: ListExpensesCommandInput = {}): Expense[] {
    assertReady(context);
    assertPermission(context, 'read');

    return collectValidatedEntities<Expense>('expenses', context.store.expenses as any, 'agent list expenses')
        .filter((expense) => !input.clientId || expense.clientId === input.clientId)
        .filter((expense) => !input.projectId || expense.projectId === input.projectId)
        .filter((expense) => !input.billableOnly || expense.billable)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function createExpenseCommand(context: AgentCommandContext, input: CreateExpenseCommandInput): Expense {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const title = requireString(input.title, 'title');

        if (!Number.isFinite(input.amount)) {
            throw new AgentCommandError('INVALID_INPUT', 'amount must be a finite number.');
        }

        validateExpenseReferences(context, input);

        const now = getNow(context);
        const id = input.id || getId(context);
        const expense = createValidatedEntity<Expense>(context.store.expenses as any, 'expenses', {
            ...input,
            id,
            title,
            paymentStatus: input.paymentStatus ?? 'unpaid',
            paymentMode: input.paymentMode ?? 'manual',
            billingStatus: input.billingStatus ?? 'unbilled',
            invoiceId: input.invoiceId ?? null,
            billedAt: input.billedAt ?? null,
            isRecurring: input.isRecurring ?? false,
            recurrenceId: input.recurrenceId ?? null,
            isTaxExempt: input.isTaxExempt ?? false,
            taxClaimStatus: input.taxClaimStatus ?? 'unclaimed',
            createdAt: input.createdAt ?? now,
            updatedAt: input.updatedAt ?? now,
        }, `agent create expense ${id}`);

        markMeaningfulActivity('expense_create');
        return expense;
    });
}

export async function markExpensePaidCommand(context: AgentCommandContext, input: MarkExpensePaidCommandInput): Promise<Expense> {
    assertReady(context);
    assertPermission(context, 'write');

    const expenseId = requireString(input.expenseId, 'expenseId');
    const expense = readRequiredEntity<Expense>(context.store.expenses as any, expenseId, 'Expense');
    const amount = typeof input.amount === 'number' ? input.amount : expense.amount;

    if (expense.amountType === 'variable' && (!amount || amount <= 0)) {
        throw new AgentCommandError('INVALID_INPUT', 'Amount is required to mark variable expenses as paid.');
    }

    const preferredCurrency = getPreferredCurrency(context);
    const requiresSnapshot = shouldStorePaymentSnapshot({ ...expense, amount }, preferredCurrency);
    let rates: Record<string, number> | null = null;

    if (requiresSnapshot) {
        const result = await fetchExchangeRates();
        rates = result.rates;

        if (!rates) {
            throw new AgentCommandError('UNAVAILABLE', result.error || 'Unable to load exchange rates for expense payment snapshot.');
        }
    }

    const now = getNow(context);
    const paidOn = input.paidOn ?? toStorageDate(new Date(now));
    const paidBy = input.paidBy ?? expense.paidBy ?? null;
    const paidExpense = {
        ...expense,
        amount,
        paidOn,
        paidBy,
        paymentStatus: 'paid' as const,
    };
    const paymentCurrencySnapshot = createExpensePaymentCurrencySnapshot({
        expense: paidExpense,
        preferredCurrency,
        exchangeRates: rates,
    }) ?? undefined;

    const updated = updateValidatedEntity<Expense>(context.store.expenses as any, 'expenses', expenseId, {
        amount,
        paidOn,
        paidBy,
        paymentStatus: 'paid',
        paymentCurrencySnapshot,
        updatedAt: now,
    }, `agent mark expense paid ${expenseId}`);

    markMeaningfulActivity('expense_update');
    return updated;
}

export function markExpenseUnpaidCommand(context: AgentCommandContext, input: { expenseId: string }): Expense {
    assertReady(context);
    assertPermission(context, 'write');

    const expenseId = requireString(input.expenseId, 'expenseId');
    readRequiredEntity<Expense>(context.store.expenses as any, expenseId, 'Expense');
    const updated = updateValidatedEntity<Expense>(context.store.expenses as any, 'expenses', expenseId, {
        paidOn: null,
        paidBy: null,
        paymentStatus: 'unpaid',
        paymentCurrencySnapshot: undefined,
        updatedAt: getNow(context),
    }, `agent mark expense unpaid ${expenseId}`);

    markMeaningfulActivity('expense_update');
    return updated;
}
