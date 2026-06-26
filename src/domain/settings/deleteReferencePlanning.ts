import type { BusinessBrandAsset, BusinessInfo, Expense, ExpenseCategory, ExpenseRecurrence, Invoice, InvoiceTemplate, PaymentMethod, TaxReturnPeriod } from '@/stores/yjs/types';

export type SettingsDeleteReference =
    | { kind: 'invoice'; id: string }
    | { kind: 'businessBrandAsset'; id: string }
    | { kind: 'businessInfo'; id: string }
    | { kind: 'expense'; id: string }
    | { kind: 'expenseRecurrence'; id: string }
    | { kind: 'taxReturnPeriod'; id: string };

export function findBusinessInfoDeleteReference({
    businessInfoId,
    invoices,
    businessBrandAssets,
    expenses,
    expenseRecurrences,
    taxReturnPeriods,
}: {
    businessInfoId: string;
    invoices: Invoice[];
    businessBrandAssets: BusinessBrandAsset[];
    expenses: Expense[];
    expenseRecurrences: ExpenseRecurrence[];
    taxReturnPeriods: TaxReturnPeriod[];
}): SettingsDeleteReference | null {
    const invoice = invoices.find((candidate) => (
        candidate.businessInfoId === businessInfoId
        || candidate.brandingSnapshot?.businessInfoId === businessInfoId
    ));
    if (invoice) return { kind: 'invoice', id: invoice.id };

    const asset = businessBrandAssets.find((candidate) => candidate.businessInfoId === businessInfoId);
    if (asset) return { kind: 'businessBrandAsset', id: asset.id };

    const expense = expenses.find((candidate) => candidate.businessId === businessInfoId);
    if (expense) return { kind: 'expense', id: expense.id };

    const recurrence = expenseRecurrences.find((candidate) => candidate.businessId === businessInfoId);
    if (recurrence) return { kind: 'expenseRecurrence', id: recurrence.id };

    const taxReturn = taxReturnPeriods.find((candidate) => candidate.businessInfoId === businessInfoId);
    if (taxReturn) return { kind: 'taxReturnPeriod', id: taxReturn.id };

    return null;
}

export function findBusinessBrandAssetDeleteReference({
    businessBrandAssetId,
    businessInfos,
    invoices,
}: {
    businessBrandAssetId: string;
    businessInfos: BusinessInfo[];
    invoices: Invoice[];
}): SettingsDeleteReference | null {
    const businessInfo = businessInfos.find((candidate) => candidate.branding?.logoAssetId === businessBrandAssetId);
    if (businessInfo) return { kind: 'businessInfo', id: businessInfo.id };

    const invoice = invoices.find((candidate) => candidate.brandingSnapshot?.logoAssetId === businessBrandAssetId);
    if (invoice) return { kind: 'invoice', id: invoice.id };

    return null;
}

export function findPaymentMethodDeleteReference({
    paymentMethodId,
    invoices,
}: {
    paymentMethodId: string;
    invoices: Invoice[];
}): SettingsDeleteReference | null {
    const invoice = invoices.find((candidate) => candidate.paymentMethodId === paymentMethodId);

    return invoice ? { kind: 'invoice', id: invoice.id } : null;
}

export function findInvoiceTemplateDeleteReference({
    invoiceTemplateId,
    invoices,
}: {
    invoiceTemplateId: string;
    invoices: Array<Invoice & { templateId?: string | null }>;
}): SettingsDeleteReference | null {
    const invoice = invoices.find((candidate) => (
        candidate.templateId === invoiceTemplateId
        || candidate.brandingSnapshot?.templateId === invoiceTemplateId
    ));

    return invoice ? { kind: 'invoice', id: invoice.id } : null;
}

export function findExpenseCategoryDeleteReference({
    expenseCategoryId,
    expenses,
    expenseRecurrences,
}: {
    expenseCategoryId: string;
    expenses: Expense[];
    expenseRecurrences: ExpenseRecurrence[];
}): SettingsDeleteReference | null {
    const expense = expenses.find((candidate) => candidate.categoryId === expenseCategoryId);
    if (expense) return { kind: 'expense', id: expense.id };

    const recurrence = expenseRecurrences.find((candidate) => candidate.categoryId === expenseCategoryId);
    if (recurrence) return { kind: 'expenseRecurrence', id: recurrence.id };

    return null;
}

export function canDeleteSettingsRecord(reference: SettingsDeleteReference | null): boolean {
    return reference === null;
}
