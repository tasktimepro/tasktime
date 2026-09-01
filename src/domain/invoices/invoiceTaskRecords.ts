import { getFiniteInvoiceNumber } from './invoiceNumbers';

const NUMERIC_TASK_FIELDS = [
    'hours',
    'originalHours',
    'originalTimeMs',
    'hourlyRate',
    'flatRate',
    'quantity',
    'projectHourlyRate',
] as const;

const BOOLEAN_TASK_FIELDS = [
    'useFlatRate',
    'projectFlatRate',
] as const;

type InvoiceTaskContainer = {
    tasks?: unknown;
    projectBreakdowns?: unknown;
};

type InvoiceTaskNode = {
    record: Record<string, unknown>;
    childIds: string[];
};

/**
 * Reconcile the legacy top-level task snapshot and project breakdown copies.
 * Missing data is filled from the richer copy, while conflicting financial
 * evidence fails closed before any source entry can be consumed.
 */
export function collectInvoiceTaskRoots(invoice: InvoiceTaskContainer): Array<Record<string, unknown>> {
    const rawRoots: Array<Record<string, unknown>> = [];

    if (Array.isArray(invoice.tasks)) {
        rawRoots.push(...invoice.tasks.filter(isRecord));
    }

    if (Array.isArray(invoice.projectBreakdowns)) {
        invoice.projectBreakdowns.filter(isRecord).forEach((breakdown) => {
            if (Array.isArray(breakdown.tasks)) {
                rawRoots.push(...breakdown.tasks.filter(isRecord));
            }
        });
    }

    const nodes = new Map<string, InvoiceTaskNode>();
    const rootIds: string[] = [];
    const parentByChildId = new Map<string, string>();

    const visit = (
        task: Record<string, unknown>,
        depth: number,
        parentId: string | null,
        ancestry: Set<Record<string, unknown>>
    ) => {
        const taskId = getString(task.id);
        if (!taskId) return;

        if (ancestry.has(task)) {
            throwNestedMergedTaskError(task, taskId);
        }

        const childRecords = Array.isArray(task.mergedSubtasks)
            ? task.mergedSubtasks.filter(isRecord)
            : [];

        if (depth >= 1 && childRecords.length > 0) {
            throwNestedMergedTaskError(task, taskId);
        }

        const existingNode = nodes.get(taskId);
        const node = existingNode || {
            record: withoutMergedSubtasks(task),
            childIds: [],
        };

        if (existingNode) {
            node.record = mergeTaskRecords(node.record, task, taskId);
        }

        nodes.set(taskId, node);

        if (parentId) {
            const existingParentId = parentByChildId.get(taskId);
            if (existingParentId && existingParentId !== parentId) {
                throwConflictingTaskCopiesError(node.record, taskId);
            }
            if (parentId === taskId) {
                throwNestedMergedTaskError(node.record, taskId);
            }
            parentByChildId.set(taskId, parentId);
        }

        const childIds = Array.from(new Set(childRecords.map((child) => getString(child.id)).filter(Boolean))) as string[];
        if (node.childIds.length > 0 && childIds.length > 0 && !haveSameIds(node.childIds, childIds)) {
            throwConflictingTaskCopiesError(node.record, taskId);
        }
        if (node.childIds.length === 0 && childIds.length > 0) {
            node.childIds = childIds;
        }

        const nextAncestry = new Set(ancestry);
        nextAncestry.add(task);
        childRecords.forEach((child) => visit(child, depth + 1, taskId, nextAncestry));
    };

    rawRoots.forEach((task) => {
        const taskId = getString(task.id);
        if (!taskId) return;
        if (!rootIds.includes(taskId)) rootIds.push(taskId);
        visit(task, 0, null, new Set());
    });

    const nestedRootId = rootIds.find((taskId) => parentByChildId.has(taskId));
    if (nestedRootId) {
        const node = nodes.get(nestedRootId);
        throwConflictingTaskCopiesError(node?.record || {}, nestedRootId);
    }

    const build = (taskId: string, ancestry: Set<string>): Record<string, unknown> => {
        const node = nodes.get(taskId);
        if (!node) return {};
        if (ancestry.has(taskId)) {
            throwNestedMergedTaskError(node.record, taskId);
        }

        const record = { ...node.record };
        const nextAncestry = new Set(ancestry);
        nextAncestry.add(taskId);

        if (node.childIds.length > 0) {
            record.mergedSubtasks = node.childIds.map((childId) => build(childId, nextAncestry));
        }

        return record;
    };

    return rootIds.map((taskId) => build(taskId, new Set()));
}

function mergeTaskRecords(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
    taskId: string
): Record<string, unknown> {
    const merged = { ...existing };

    Object.entries(incoming).forEach(([key, value]) => {
        if (key !== 'mergedSubtasks' && !hasExplicitValue(merged[key]) && hasExplicitValue(value)) {
            merged[key] = value;
        }
    });

    NUMERIC_TASK_FIELDS.forEach((field) => {
        mergeFinancialField({ existing, incoming, merged, field, taskId, numeric: true });
    });
    BOOLEAN_TASK_FIELDS.forEach((field) => {
        mergeFinancialField({ existing, incoming, merged, field, taskId, numeric: false });
    });

    if (!getDisplayTitle(existing.title, taskId) && getDisplayTitle(incoming.title, taskId)) {
        merged.title = incoming.title;
    }

    delete merged.mergedSubtasks;
    return merged;
}

function mergeFinancialField({
    existing,
    incoming,
    merged,
    field,
    taskId,
    numeric,
}: {
    existing: Record<string, unknown>;
    incoming: Record<string, unknown>;
    merged: Record<string, unknown>;
    field: string;
    taskId: string;
    numeric: boolean;
}) {
    const existingValue = existing[field];
    const incomingValue = incoming[field];
    const hasExisting = hasExplicitValue(existingValue);
    const hasIncoming = hasExplicitValue(incomingValue);

    if (!hasExisting && hasIncoming) {
        merged[field] = incomingValue;
        return;
    }
    if (!hasExisting || !hasIncoming) {
        return;
    }

    const matches = numeric
        ? numbersMatch(existingValue, incomingValue)
        : existingValue === incomingValue;

    if (!matches) {
        throwConflictingTaskCopiesError(merged, taskId);
    }
}

function numbersMatch(left: unknown, right: unknown): boolean {
    const leftNumber = getFiniteInvoiceNumber(left);
    const rightNumber = getFiniteInvoiceNumber(right);

    if (leftNumber !== null && rightNumber !== null) {
        return Math.abs(leftNumber - rightNumber) < 0.000000001;
    }

    return String(left).trim() === String(right).trim();
}

function withoutMergedSubtasks(task: Record<string, unknown>): Record<string, unknown> {
    const record = { ...task };
    delete record.mergedSubtasks;
    return record;
}

function haveSameIds(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false;
    const rightIds = new Set(right);
    return left.every((id) => rightIds.has(id));
}

function throwConflictingTaskCopiesError(task: Record<string, unknown>, taskId: string): never {
    const title = getDisplayTitle(task.title, taskId);
    const subject = title ? `"${title}"` : 'a task';
    throw new Error(
        `Invoice data for ${subject} conflicts between saved task copies. `
        + 'Refresh or recreate the invoice, then try again.'
    );
}

function throwNestedMergedTaskError(task: Record<string, unknown>, taskId: string): never {
    const title = getDisplayTitle(task.title, taskId);
    const subject = title ? `"${title}"` : 'a task';
    throw new Error(
        `Invoice data for ${subject} contains nested merged subtasks that cannot be safely finalized. `
        + 'Refresh or recreate the invoice, then try again.'
    );
}

function getDisplayTitle(value: unknown, fallbackId: string): string {
    if (typeof value !== 'string') return '';
    const title = value.trim();
    return title && title !== fallbackId ? title : '';
}

function getString(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function hasExplicitValue(value: unknown): boolean {
    return value !== undefined && value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
