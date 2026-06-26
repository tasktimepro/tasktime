import { describe, expect, it } from 'vitest';
import {
    canDeleteSettingsRecord,
    findBusinessBrandAssetDeleteReference,
    findBusinessInfoDeleteReference,
    findExpenseCategoryDeleteReference,
    findInvoiceTemplateDeleteReference,
    findPaymentMethodDeleteReference,
} from './deleteReferencePlanning';

describe('settings delete reference planning', () => {
    it('finds business profile references in history-preserving priority order', () => {
        expect(findBusinessInfoDeleteReference({
            businessInfoId: 'business-1',
            invoices: [{ id: 'invoice-1', businessInfoId: 'business-1' }] as any,
            businessBrandAssets: [{ id: 'asset-1', businessInfoId: 'business-1' }] as any,
            expenses: [{ id: 'expense-1', businessId: 'business-1' }] as any,
            expenseRecurrences: [{ id: 'recurrence-1', businessId: 'business-1' }] as any,
            taxReturnPeriods: [{ id: 'tax-1', businessInfoId: 'business-1' }] as any,
        })).toEqual({ kind: 'invoice', id: 'invoice-1' });

        expect(findBusinessInfoDeleteReference({
            businessInfoId: 'business-1',
            invoices: [],
            businessBrandAssets: [],
            expenses: [],
            expenseRecurrences: [],
            taxReturnPeriods: [{ id: 'tax-1', businessInfoId: 'business-1' }] as any,
        })).toEqual({ kind: 'taxReturnPeriod', id: 'tax-1' });
    });

    it('finds business brand asset references in business profiles and invoice snapshots', () => {
        expect(findBusinessBrandAssetDeleteReference({
            businessBrandAssetId: 'asset-1',
            businessInfos: [{ id: 'business-1', branding: { logoAssetId: 'asset-1' } }] as any,
            invoices: [],
        })).toEqual({ kind: 'businessInfo', id: 'business-1' });

        expect(findBusinessBrandAssetDeleteReference({
            businessBrandAssetId: 'asset-1',
            businessInfos: [],
            invoices: [{ id: 'invoice-1', brandingSnapshot: { logoAssetId: 'asset-1' } }] as any,
        })).toEqual({ kind: 'invoice', id: 'invoice-1' });
    });

    it('finds invoice history references for payment methods and invoice templates', () => {
        expect(findPaymentMethodDeleteReference({
            paymentMethodId: 'payment-1',
            invoices: [{ id: 'invoice-1', paymentMethodId: 'payment-1' }] as any,
        })).toEqual({ kind: 'invoice', id: 'invoice-1' });

        expect(findInvoiceTemplateDeleteReference({
            invoiceTemplateId: 'template-1',
            invoices: [{ id: 'invoice-1', brandingSnapshot: { templateId: 'template-1' } }] as any,
        })).toEqual({ kind: 'invoice', id: 'invoice-1' });
    });

    it('finds expense category references in expenses and recurring templates', () => {
        expect(findExpenseCategoryDeleteReference({
            expenseCategoryId: 'category-1',
            expenses: [{ id: 'expense-1', categoryId: 'category-1' }] as any,
            expenseRecurrences: [{ id: 'recurrence-1', categoryId: 'category-1' }] as any,
        })).toEqual({ kind: 'expense', id: 'expense-1' });

        expect(findExpenseCategoryDeleteReference({
            expenseCategoryId: 'category-1',
            expenses: [],
            expenseRecurrences: [{ id: 'recurrence-1', categoryId: 'category-1' }] as any,
        })).toEqual({ kind: 'expenseRecurrence', id: 'recurrence-1' });
    });

    it('reports when a settings record has no delete blockers', () => {
        expect(canDeleteSettingsRecord(findPaymentMethodDeleteReference({
            paymentMethodId: 'payment-1',
            invoices: [],
        }))).toBe(true);
    });
});
