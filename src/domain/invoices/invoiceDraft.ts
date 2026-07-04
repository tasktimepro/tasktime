import type { Invoice, InvoiceItem, Project } from '@/stores/yjs/types';
import type { ProjectInvoicePreview } from '@/utils/invoicePreviewUtils';

export class InvoiceDraftValidationError extends Error {

    details?: Record<string, unknown>;

    constructor(message: string, details?: Record<string, unknown>) {
        super(message);
        this.name = 'InvoiceDraftValidationError';
        this.details = details;
    }
}

export function buildDraftInvoiceItems(project: Project, preview: ProjectInvoicePreview): InvoiceItem[] {
    const items: InvoiceItem[] = [];

    if (preview.taskAmount > 0) {
        const quantity = preview.unbilledHours > 0 ? preview.unbilledHours : 1;
        const rate = Math.round((preview.taskAmount / quantity) * 100) / 100;

        items.push({
            description: `${project.title} work`,
            quantity,
            rate,
            amount: preview.taskAmount,
            projectId: project.id,
            lineType: 'project-subtotal',
            pricingMode: project.flatRate ? 'flat' : 'hourly',
        });
    }

    if (preview.expenseAmount > 0) {
        items.push({
            description: `${project.title} billable expenses`,
            quantity: 1,
            rate: preview.expenseAmount,
            amount: preview.expenseAmount,
            projectId: project.id,
            lineType: 'expense',
        });
    }

    return items;
}

export function buildDraftInvoiceUpdates(
    existing: Invoice & Record<string, unknown>,
    rawUpdates: Record<string, unknown>,
    now: number
): Partial<Invoice> & Record<string, unknown> {
    const updates = { ...rawUpdates };

    if (Object.prototype.hasOwnProperty.call(updates, 'items')) {
        updates.items = normalizeDraftInvoiceItems(updates.items);
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'projectIds')) {
        if (!Array.isArray(updates.projectIds)) {
            throw new InvoiceDraftValidationError('projectIds must be an array.', { field: 'projectIds' });
        }

        updates.projectIds = Array.from(new Set(updates.projectIds.map((id) => requireNonEmptyString(id, 'projectIds[]'))));
    }

    const items = (updates.items as InvoiceItem[] | undefined) || existing.items || [];
    const shouldRecalculateSubtotal = Object.prototype.hasOwnProperty.call(updates, 'items') && !Object.prototype.hasOwnProperty.call(updates, 'subtotal');
    const subtotal = shouldRecalculateSubtotal
        ? items.reduce((sum, item) => sum + item.amount, 0)
        : numberFromUpdate(updates, existing, 'subtotal', 0);

    if (shouldRecalculateSubtotal) {
        updates.subtotal = subtotal;
    }

    const taxRate = numberFromUpdate(updates, existing, 'taxRate', 0);
    const tax = Object.prototype.hasOwnProperty.call(updates, 'tax')
        ? numberFromUpdate(updates, existing, 'tax', 0)
        : (Object.prototype.hasOwnProperty.call(updates, 'taxRate') ? subtotal * (taxRate / 100) : numberFromUpdate(updates, existing, 'tax', 0));
    const discount = numberFromUpdate(updates, existing, 'discount', 0);
    const shipping = numberFromUpdate(updates, existing, 'shipping', 0);

    if (!Object.prototype.hasOwnProperty.call(updates, 'tax') && (Object.prototype.hasOwnProperty.call(updates, 'taxRate') || shouldRecalculateSubtotal)) {
        updates.tax = tax;
    }

    if (
        !Object.prototype.hasOwnProperty.call(updates, 'total')
        && (
            shouldRecalculateSubtotal
            || Object.prototype.hasOwnProperty.call(updates, 'subtotal')
            || Object.prototype.hasOwnProperty.call(updates, 'tax')
            || Object.prototype.hasOwnProperty.call(updates, 'taxRate')
            || Object.prototype.hasOwnProperty.call(updates, 'discount')
            || Object.prototype.hasOwnProperty.call(updates, 'shipping')
        )
    ) {
        updates.total = subtotal - discount + shipping + tax;
    }

    updates.updatedAt = now;
    return updates as Partial<Invoice> & Record<string, unknown>;
}

export function normalizeDraftInvoiceItems(items: unknown): InvoiceItem[] {
    if (!Array.isArray(items)) {
        throw new InvoiceDraftValidationError('items must be an array.', { field: 'items' });
    }

    return items.map((item, index) => {
        if (!item || typeof item !== 'object') {
            throw new InvoiceDraftValidationError('Each invoice item must be an object.', { field: `items[${index}]` });
        }

        const candidate = item as Partial<InvoiceItem>;
        const description = requireNonEmptyString(candidate.description, `items[${index}].description`);
        const quantity = Number(candidate.quantity);
        const rate = Number(candidate.rate);
        const amount = Number(candidate.amount);

        if (!Number.isFinite(quantity) || quantity < 0) {
            throw new InvoiceDraftValidationError('Invoice item quantity must be a non-negative number.', { field: `items[${index}].quantity` });
        }

        if (!Number.isFinite(rate)) {
            throw new InvoiceDraftValidationError('Invoice item rate must be a number.', { field: `items[${index}].rate` });
        }

        if (!Number.isFinite(amount)) {
            throw new InvoiceDraftValidationError('Invoice item amount must be a number.', { field: `items[${index}].amount` });
        }

        return {
            ...candidate,
            description,
            quantity,
            rate,
            amount,
        } as InvoiceItem;
    });
}

function numberFromUpdate(updates: Record<string, unknown>, existing: Record<string, unknown>, key: string, fallback = 0) {
    const value = Object.prototype.hasOwnProperty.call(updates, key) ? updates[key] : existing[key];

    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function requireNonEmptyString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new InvoiceDraftValidationError(`${field} is required.`, { field });
    }

    return value;
}
