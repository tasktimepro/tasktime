import { describe, expect, it } from 'vitest';
import { collectInvoiceTaskRoots } from './invoiceTaskRecords';

const parentTask = {
    id: 'parent-task',
    title: 'Homepage',
    hours: 1,
    hourlyRate: 100,
    useFlatRate: false,
    mergedSubtasks: [{
        id: 'child-task',
        title: 'Responsive polish',
        hours: 1,
        hourlyRate: 100,
        useFlatRate: false,
    }],
};

const childTask = {
    id: 'child-task',
    title: 'Responsive polish',
    hours: 1,
    hourlyRate: 100,
    useFlatRate: false,
};

describe('invoice task record reconciliation', () => {
    it('rejects a merged child duplicated as a root after its parent', () => {
        expect(() => collectInvoiceTaskRoots({
            tasks: [parentTask, childTask],
        })).toThrowError(
            'Invoice data for "Responsive polish" conflicts between saved task copies. Refresh or recreate the invoice, then try again.'
        );
    });

    it('rejects a merged child duplicated as a root before its parent', () => {
        expect(() => collectInvoiceTaskRoots({
            tasks: [childTask, parentTask],
        })).toThrowError(
            'Invoice data for "Responsive polish" conflicts between saved task copies. Refresh or recreate the invoice, then try again.'
        );
    });
});
