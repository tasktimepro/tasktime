import { getFiniteInvoiceNumber } from './invoiceNumbers';

/**
 * Resolve the persisted pricing mode with explicit task state taking priority.
 * Older invoices may only carry project or flat-rate evidence.
 */
export function usesInvoiceTaskFlatRate(task: Record<string, unknown>): boolean {
    if (task.useFlatRate === true) {
        return true;
    }

    if (task.useFlatRate === false) {
        return false;
    }

    return task.projectFlatRate === true || getFiniteInvoiceNumber(task.flatRate) !== null;
}
