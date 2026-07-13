import { markMeaningfulActivity } from '@/utils/usageMetrics';
import { toStorageDate } from '@/utils/dateUtils';
import { normalizeCurrencyCode, fetchExchangeRates } from '@/utils/currencyUtils';
import {
    buildExpenseFromRecurrence,
    createExpensePaymentCurrencySnapshot,
    getExpensePaymentCurrencySnapshot,
} from '@/utils/expenseUtils';
import { buildMarkExpensePaidUpdates, buildMarkExpenseUnpaidUpdates } from '@/domain/expenses/expenseUpdates';
import { collectValidatedEntities, validateCollectionEntity } from '@/stores/yjs/validation';
import type { BusinessInfo, Client, Expense, ExpenseCategory, ExpenseRecurrence, Project } from '@/stores/yjs/types';
import type { AgentCommandContext } from '@/agent/types';
import { AgentCommandError } from '@/agent/types';
import { assertExpenseCanBeDeleted, ExpenseOperationError } from '@/domain/expenses/expenseOperations';
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

export interface ListExpenseRecurrencesCommandInput {
    activeOnly?: boolean;
    clientId?: string | null;
    projectId?: string | null;
}

export interface CreateExpenseRecurrenceCommandInput extends Partial<Omit<ExpenseRecurrence, 'id' | 'createdAt' | 'updatedAt'>> {
    id?: string;
    title: string;
    currency: string;
    amount: number;
    amountType: ExpenseRecurrence['amountType'];
    repeat: ExpenseRecurrence['repeat'];
    startDate: string;
    isPersonal: boolean;
    billable: boolean;
    isTaxExempt: boolean;
    generateInitial?: boolean;
    createdAt?: number;
    updatedAt?: number;
    idempotencyKey?: string;
}

export interface UpdateExpenseRecurrenceCommandInput {
    recurrenceId: string;
    updates: Partial<ExpenseRecurrence>;
}

export interface DeleteExpenseRecurrenceCommandInput {
    recurrenceId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
}

export interface DeleteExpenseRecurrenceResult {
    recurrenceId: string;
    title: string;
    generatedExpensesDeleted: 0;
    deleted: true;
}

export interface MarkExpensePaidCommandInput {
    expenseId: string;
    amount?: number;
    paidOn?: string | null;
    paidBy?: string | null;
}

export interface DeleteExpenseCommandInput {
    expenseId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
}

export interface DeleteExpenseResult {
    expenseId: string;
    title: string;
    date: string;
    amount: number;
    currency: string;
    deleted: true;
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

function validateExpenseRecurrenceReferences(context: AgentCommandContext, input: Partial<ExpenseRecurrence>): void {
    validateExpenseReferences(context, input as Partial<Expense>);

    if (input.businessId) {
        readRequiredEntity<BusinessInfo>(context.store.businessInfos as any, input.businessId, 'Business info');
    }

    if (input.categoryId) {
        readRequiredEntity<ExpenseCategory>(context.store.expenseCategories as any, input.categoryId, 'Expense category');
    }
}

function validateExpenseRecurrenceInput(input: Partial<ExpenseRecurrence>): void {
    if (!Number.isFinite(input.amount)) {
        throw new AgentCommandError('INVALID_INPUT', 'amount must be a finite number.');
    }

    if (input.repeat === 'monthly' && input.monthlyType === 'specific' && !Number.isFinite(input.monthlyDay)) {
        throw new AgentCommandError('INVALID_INPUT', 'monthlyDay is required for specific monthly recurring expenses.', {
            field: 'monthlyDay',
        });
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
        const preferredCurrency = getPreferredCurrency(context);
        const paymentStatus = input.paymentStatus ?? 'unpaid';

        if (
            paymentStatus === 'paid'
            && shouldStorePaymentSnapshot(input, preferredCurrency)
            && !getExpensePaymentCurrencySnapshot(input)
        ) {
            throw new AgentCommandError(
                'INVALID_INPUT',
                'A payment currency snapshot is required before creating a paid cross-currency expense.'
            );
        }

        const expense = createValidatedEntity<Expense>(context.store.expenses as any, 'expenses', {
            ...input,
            id,
            title,
            paymentStatus,
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
        }, `agent create expense ${id}`, [context.store.archivedExpenses as any]);

        markMeaningfulActivity('expense_create');
        return expense;
    });
}

export function listExpenseRecurrencesCommand(context: AgentCommandContext, input: ListExpenseRecurrencesCommandInput = {}): ExpenseRecurrence[] {
    assertReady(context);
    assertPermission(context, 'read');

    return collectValidatedEntities<ExpenseRecurrence>('expenseRecurrences', context.store.expenseRecurrences as any, 'agent list expense recurrences')
        .filter((recurrence) => input.activeOnly ? recurrence.active : true)
        .filter((recurrence) => !input.clientId || recurrence.clientId === input.clientId)
        .filter((recurrence) => !input.projectId || recurrence.projectId === input.projectId)
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}

export async function createExpenseRecurrenceCommand(
    context: AgentCommandContext,
    input: CreateExpenseRecurrenceCommandInput
): Promise<{ recurrence: ExpenseRecurrence; generatedExpense: Expense | null }> {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, async () => {
        const title = requireString(input.title, 'title');
        validateExpenseRecurrenceInput(input);
        validateExpenseRecurrenceReferences(context, input);

        const now = getNow(context);
        const id = input.id || getId(context);
        const today = toStorageDate(new Date(now));
        const shouldGenerateInitial = input.generateInitial !== false && Boolean(today && input.startDate <= today);
        const recurrenceData = {
            ...input,
            id,
            title,
            note: input.note ?? null,
            supplierName: input.supplierName ?? null,
            paidBy: input.paidBy ?? null,
            paymentMode: input.paymentMode ?? 'manual',
            currency: normalizeCurrencyCode(input.currency),
            amount: input.amount,
            amountType: input.amountType,
            repeat: input.repeat,
            monthlyType: input.repeat === 'monthly' ? input.monthlyType : undefined,
            monthlyDay: input.repeat === 'monthly' ? input.monthlyDay : undefined,
            endDate: input.endDate ?? null,
            clientId: input.clientId ?? null,
            projectId: input.projectId ?? null,
            businessId: input.businessId ?? null,
            categoryId: input.categoryId ?? null,
            isPersonal: input.isPersonal,
            billable: input.billable,
            taxNumber: input.taxNumber ?? null,
            isTaxExempt: input.isTaxExempt,
            amountExcludingTax: input.amountExcludingTax ?? null,
            taxLabel: input.taxLabel ?? null,
            taxRate: input.taxRate ?? null,
            lastGeneratedDate: shouldGenerateInitial ? input.startDate : input.lastGeneratedDate ?? null,
            active: input.active ?? true,
            createdAt: input.createdAt ?? now,
            updatedAt: input.updatedAt ?? now,
        };
        const prospectiveRecurrence = validateCollectionEntity<ExpenseRecurrence>(
            'expenseRecurrences',
            recurrenceData,
            `agent prepare expense recurrence ${id}`
        );

        let preparedGeneratedExpense: Expense | null = null;

        if (shouldGenerateInitial) {
            preparedGeneratedExpense = {
                ...buildExpenseFromRecurrence(prospectiveRecurrence, input.startDate),
                createdAt: now,
                updatedAt: now,
            };
            const preferredCurrency = getPreferredCurrency(context);

            if (
                preparedGeneratedExpense.paymentStatus === 'paid'
                && shouldStorePaymentSnapshot(preparedGeneratedExpense, preferredCurrency)
            ) {
                const { rates, error } = await fetchExchangeRates();

                if (!rates) {
                    throw new AgentCommandError(
                        'UNAVAILABLE',
                        error || 'Unable to load exchange rates for expense payment snapshot.'
                    );
                }

                preparedGeneratedExpense.paymentCurrencySnapshot = createExpensePaymentCurrencySnapshot({
                    expense: preparedGeneratedExpense,
                    preferredCurrency,
                    exchangeRates: rates,
                }) ?? undefined;
            }

            preparedGeneratedExpense = validateCollectionEntity<Expense>(
                'expenses',
                preparedGeneratedExpense,
                `agent prepare initial recurring expense ${preparedGeneratedExpense.id}`
            );
        }

        const recurrence = createValidatedEntity<ExpenseRecurrence>(
            context.store.expenseRecurrences as any,
            'expenseRecurrences',
            recurrenceData,
            `agent create expense recurrence ${id}`
        );
        let generatedExpense: Expense | null = null;

        if (preparedGeneratedExpense) {
            generatedExpense = preparedGeneratedExpense;

            if (context.store.expenses.has(generatedExpense.id)) {
                generatedExpense = readRequiredEntity<Expense>(context.store.expenses as any, generatedExpense.id, 'Generated expense');
            } else if (context.store.archivedExpenses?.has(generatedExpense.id)) {
                generatedExpense = readRequiredEntity<Expense>(context.store.archivedExpenses as any, generatedExpense.id, 'Generated archived expense');
            } else {
                generatedExpense = createValidatedEntity<Expense>(context.store.expenses as any, 'expenses', {
                    ...generatedExpense,
                }, `agent create initial recurring expense ${generatedExpense.id}`, [context.store.archivedExpenses as any]);
            }
        }

        markMeaningfulActivity('expense_create');
        return { recurrence, generatedExpense };
    });
}

export function updateExpenseRecurrenceCommand(context: AgentCommandContext, input: UpdateExpenseRecurrenceCommandInput): ExpenseRecurrence {
    assertReady(context);
    assertPermission(context, 'write');

    const recurrenceId = requireString(input.recurrenceId, 'recurrenceId');
    const existing = readRequiredEntity<ExpenseRecurrence>(context.store.expenseRecurrences as any, recurrenceId, 'Expense recurrence');
    const updates = input.updates || {};
    const next = { ...existing, ...updates };

    validateExpenseRecurrenceInput(next);
    validateExpenseRecurrenceReferences(context, next);

    const updated = updateValidatedEntity<ExpenseRecurrence>(context.store.expenseRecurrences as any, 'expenseRecurrences', recurrenceId, {
        ...updates,
        updatedAt: getNow(context),
    }, `agent update expense recurrence ${recurrenceId}`);

    markMeaningfulActivity('expense_update');
    return updated;
}

export function pauseExpenseRecurrenceCommand(context: AgentCommandContext, input: { recurrenceId: string }): ExpenseRecurrence {
    return updateExpenseRecurrenceCommand(context, {
        recurrenceId: input.recurrenceId,
        updates: { active: false },
    });
}

export function resumeExpenseRecurrenceCommand(context: AgentCommandContext, input: { recurrenceId: string }): ExpenseRecurrence {
    return updateExpenseRecurrenceCommand(context, {
        recurrenceId: input.recurrenceId,
        updates: { active: true },
    });
}

export function deleteExpenseRecurrenceCommand(
    context: AgentCommandContext,
    input: DeleteExpenseRecurrenceCommandInput
): DeleteExpenseRecurrenceResult {
    assertReady(context);
    assertPermission(context, 'write');

    const recurrenceId = requireString(input.recurrenceId, 'recurrenceId');

    if (input.confirmDelete !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmDelete must be true to delete a recurring expense template.', { recurrenceId });
    }

    if (input.confirmationText !== recurrenceId) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must match recurrenceId to delete a recurring expense template.', { recurrenceId });
    }

    const recurrence = readRequiredEntity<ExpenseRecurrence>(context.store.expenseRecurrences as any, recurrenceId, 'Expense recurrence');

    context.store.coreDoc.transact(() => {
        context.store.expenseRecurrences.delete(recurrenceId);
    });

    markMeaningfulActivity('expense_update');

    return {
        recurrenceId,
        title: recurrence.title,
        generatedExpensesDeleted: 0,
        deleted: true,
    };
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

    const updated = updateValidatedEntity<Expense>(
        context.store.expenses as any,
        'expenses',
        expenseId,
        buildMarkExpensePaidUpdates({
            amount,
            paidOn,
            paidBy,
            paymentCurrencySnapshot,
            updatedAt: now,
        }),
        `agent mark expense paid ${expenseId}`
    );

    markMeaningfulActivity('expense_update');
    return updated;
}

export function markExpenseUnpaidCommand(context: AgentCommandContext, input: { expenseId: string }): Expense {
    assertReady(context);
    assertPermission(context, 'write');

    const expenseId = requireString(input.expenseId, 'expenseId');
    readRequiredEntity<Expense>(context.store.expenses as any, expenseId, 'Expense');
    const updated = updateValidatedEntity<Expense>(
        context.store.expenses as any,
        'expenses',
        expenseId,
        buildMarkExpenseUnpaidUpdates({ updatedAt: getNow(context) }),
        `agent mark expense unpaid ${expenseId}`
    );

    markMeaningfulActivity('expense_update');
    return updated;
}

export function deleteExpenseCommand(context: AgentCommandContext, input: DeleteExpenseCommandInput): DeleteExpenseResult {
    assertReady(context);
    assertPermission(context, 'write');

    const expenseId = requireString(input.expenseId, 'expenseId');

    if (input.confirmDelete !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmDelete must be true to delete an expense.', { expenseId });
    }

    if (input.confirmationText !== expenseId) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must match expenseId to delete an expense.', { expenseId });
    }

    const expense = readRequiredEntity<Expense>(context.store.expenses as any, expenseId, 'Expense');

    try {
        assertExpenseCanBeDeleted(expense);
    } catch (error) {
        if (error instanceof ExpenseOperationError) {
            throw new AgentCommandError(error.code, error.message, error.details);
        }

        throw error;
    }

    context.store.coreDoc.transact(() => {
        context.store.expenses.delete(expenseId);
    });

    markMeaningfulActivity('expense_delete');

    return {
        expenseId,
        title: expense.title,
        date: expense.date,
        amount: expense.amount,
        currency: expense.currency,
        deleted: true,
    };
}
