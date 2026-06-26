import { collectValidatedEntities } from '@/stores/yjs/validation';
import { buildExpenseTaxClaimedUpdates, buildExpenseTaxUnclaimedUpdates } from '@/domain/expenses/expenseUpdates';
import { buildTaxReturnPeriodFiledUpdates, buildTaxReturnPeriodPaidUpdates } from '@/domain/expenses/taxReturnUpdates';
import type { Expense, TaxReturnPeriod } from '@/stores/yjs/types';
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

export interface CreateTaxReturnPeriodCommandInput extends Partial<Omit<TaxReturnPeriod, 'id' | 'createdAt' | 'updatedAt'>> {
    id?: string;
    title: string;
    type: TaxReturnPeriod['type'];
    startDate: string;
    endDate: string;
    idempotencyKey?: string;
}

export interface UpdateTaxReturnPeriodCommandInput {
    taxReturnPeriodId: string;
    updates: Partial<TaxReturnPeriod>;
}

export interface MarkExpensesTaxClaimedCommandInput {
    expenseIds: string[];
    taxReturnPeriodId: string;
    confirmClaim: boolean;
}

export interface MarkExpensesTaxUnclaimedCommandInput {
    expenseIds: string[];
    confirmUnclaim: boolean;
}

export interface MarkTaxReturnPeriodFiledCommandInput {
    taxReturnPeriodId: string;
    filedAt?: number;
    confirmFiled: boolean;
}

export interface MarkTaxReturnPeriodPaidCommandInput {
    taxReturnPeriodId: string;
    filedAt?: number;
    paidAt?: number;
    confirmPaid: boolean;
}

const getUniqueExpenseIds = (expenseIds: unknown) => {
    if (!Array.isArray(expenseIds)) {
        throw new AgentCommandError('INVALID_INPUT', 'expenseIds must be an array.', { field: 'expenseIds' });
    }

    const ids = Array.from(new Set(expenseIds.map((id) => requireString(id, 'expenseIds[]'))));

    if (ids.length === 0) {
        throw new AgentCommandError('INVALID_INPUT', 'At least one expense is required.', { field: 'expenseIds' });
    }

    return ids;
};

const assertWriteReady = (context: AgentCommandContext) => {
    assertReady(context);
    assertPermission(context, 'write');
};

export function listTaxReturnPeriodsCommand(context: AgentCommandContext): TaxReturnPeriod[] {
    assertReady(context);
    assertPermission(context, 'read');

    return collectValidatedEntities<TaxReturnPeriod>('taxReturnPeriods', context.store.taxReturnPeriods as any, 'agent list tax return periods')
        .sort((left, right) => right.startDate.localeCompare(left.startDate) || left.title.localeCompare(right.title));
}

export function createTaxReturnPeriodCommand(context: AgentCommandContext, input: CreateTaxReturnPeriodCommandInput): TaxReturnPeriod {
    assertWriteReady(context);

    return withIdempotency(context, input.idempotencyKey, () => {
        const now = getNow(context);
        const id = input.id || getId(context);

        return createValidatedEntity<TaxReturnPeriod>(context.store.taxReturnPeriods as any, 'taxReturnPeriods', {
            ...input,
            id,
            title: requireString(input.title, 'title'),
            type: input.type,
            startDate: requireString(input.startDate, 'startDate'),
            endDate: requireString(input.endDate, 'endDate'),
            status: input.status || 'draft',
            businessInfoId: input.businessInfoId ?? null,
            notes: input.notes ?? null,
            createdAt: input.createdAt ?? now,
            updatedAt: input.updatedAt ?? now,
        }, `agent create tax return period ${id}`);
    });
}

export function updateTaxReturnPeriodCommand(context: AgentCommandContext, input: UpdateTaxReturnPeriodCommandInput): TaxReturnPeriod {
    assertWriteReady(context);

    const taxReturnPeriodId = requireString(input.taxReturnPeriodId, 'taxReturnPeriodId');
    const updates = input.updates || {};

    const blockedStatusKeys = ['status', 'filedAt', 'paidAt'].filter((key) => Object.prototype.hasOwnProperty.call(updates, key));

    if (blockedStatusKeys.length > 0) {
        throw new AgentCommandError('INVALID_INPUT', 'Tax return filing and payment status changes require explicit tax status commands.', {
            keys: blockedStatusKeys,
        });
    }

    readRequiredEntity<TaxReturnPeriod>(context.store.taxReturnPeriods as any, taxReturnPeriodId, 'Tax return period');

    return updateValidatedEntity<TaxReturnPeriod>(
        context.store.taxReturnPeriods as any,
        'taxReturnPeriods',
        taxReturnPeriodId,
        {
            ...updates,
            updatedAt: updates.updatedAt ?? getNow(context),
        },
        `agent update tax return period ${taxReturnPeriodId}`
    );
}

export function markExpensesTaxClaimedCommand(context: AgentCommandContext, input: MarkExpensesTaxClaimedCommandInput): {
    expenseIds: string[];
    taxReturnPeriodId: string;
    updatedCount: number;
} {
    assertWriteReady(context);

    if (input.confirmClaim !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmClaim must be true to mark expenses as tax claimed.', { field: 'confirmClaim' });
    }

    const taxReturnPeriodId = requireString(input.taxReturnPeriodId, 'taxReturnPeriodId');
    const expenseIds = getUniqueExpenseIds(input.expenseIds);
    const now = getNow(context);

    readRequiredEntity<TaxReturnPeriod>(context.store.taxReturnPeriods as any, taxReturnPeriodId, 'Tax return period');
    expenseIds.forEach((expenseId) => {
        readRequiredEntity<Expense>(context.store.expenses as any, expenseId, 'Expense');
    });

    expenseIds.forEach((expenseId) => {
        updateValidatedEntity<Expense>(
            context.store.expenses as any,
            'expenses',
            expenseId,
            buildExpenseTaxClaimedUpdates({
                taxClaimPeriodId: taxReturnPeriodId,
                claimedAt: now,
            }),
            `agent mark expense tax claimed ${expenseId}`
        );
    });

    return {
        expenseIds,
        taxReturnPeriodId,
        updatedCount: expenseIds.length,
    };
}

export function markExpensesTaxUnclaimedCommand(context: AgentCommandContext, input: MarkExpensesTaxUnclaimedCommandInput): {
    expenseIds: string[];
    updatedCount: number;
} {
    assertWriteReady(context);

    if (input.confirmUnclaim !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmUnclaim must be true to mark expenses as tax unclaimed.', { field: 'confirmUnclaim' });
    }

    const expenseIds = getUniqueExpenseIds(input.expenseIds);
    const now = getNow(context);

    expenseIds.forEach((expenseId) => {
        readRequiredEntity<Expense>(context.store.expenses as any, expenseId, 'Expense');
    });

    expenseIds.forEach((expenseId) => {
        updateValidatedEntity<Expense>(
            context.store.expenses as any,
            'expenses',
            expenseId,
            buildExpenseTaxUnclaimedUpdates({ updatedAt: now }),
            `agent mark expense tax unclaimed ${expenseId}`
        );
    });

    return {
        expenseIds,
        updatedCount: expenseIds.length,
    };
}

export function markTaxReturnPeriodFiledCommand(context: AgentCommandContext, input: MarkTaxReturnPeriodFiledCommandInput): TaxReturnPeriod {
    assertWriteReady(context);

    if (input.confirmFiled !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmFiled must be true to mark a tax return period filed.', {
            field: 'confirmFiled',
        });
    }

    const taxReturnPeriodId = requireString(input.taxReturnPeriodId, 'taxReturnPeriodId');
    const existing = readRequiredEntity<TaxReturnPeriod>(context.store.taxReturnPeriods as any, taxReturnPeriodId, 'Tax return period');

    if (existing.status === 'paid') {
        throw new AgentCommandError('CONFLICT', 'Paid tax return periods cannot be moved back to filed through this command.', {
            taxReturnPeriodId,
        });
    }

    return updateValidatedEntity<TaxReturnPeriod>(
        context.store.taxReturnPeriods as any,
        'taxReturnPeriods',
        taxReturnPeriodId,
        buildTaxReturnPeriodFiledUpdates({
            existing,
            filedAt: input.filedAt ?? getNow(context),
            updatedAt: getNow(context),
        }),
        `agent mark tax return period filed ${taxReturnPeriodId}`
    );
}

export function markTaxReturnPeriodPaidCommand(context: AgentCommandContext, input: MarkTaxReturnPeriodPaidCommandInput): TaxReturnPeriod {
    assertWriteReady(context);

    if (input.confirmPaid !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmPaid must be true to mark a tax return period paid.', {
            field: 'confirmPaid',
        });
    }

    const taxReturnPeriodId = requireString(input.taxReturnPeriodId, 'taxReturnPeriodId');
    const existing = readRequiredEntity<TaxReturnPeriod>(context.store.taxReturnPeriods as any, taxReturnPeriodId, 'Tax return period');
    const now = getNow(context);

    return updateValidatedEntity<TaxReturnPeriod>(
        context.store.taxReturnPeriods as any,
        'taxReturnPeriods',
        taxReturnPeriodId,
        buildTaxReturnPeriodPaidUpdates({
            existing,
            filedAt: input.filedAt ?? now,
            paidAt: input.paidAt ?? now,
            updatedAt: now,
        }),
        `agent mark tax return period paid ${taxReturnPeriodId}`
    );
}
