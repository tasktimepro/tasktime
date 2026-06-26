import { collectValidatedEntities, type YjsCollectionName, validatePreferencesRecord } from '@/stores/yjs/validation';
import { readEntity, updateEntityFields } from '@/stores/yjs/entityUtils';
import { planDefaultClearing } from '@/domain/settings/defaultSelection';
import {
    findBusinessBrandAssetDeleteReference,
    findBusinessInfoDeleteReference,
    findExpenseCategoryDeleteReference,
    findInvoiceTemplateDeleteReference,
    findPaymentMethodDeleteReference,
    type SettingsDeleteReference,
} from '@/domain/settings/deleteReferencePlanning';
import type { BusinessBrandAsset, BusinessInfo, EmailTemplate, Expense, ExpenseCategory, ExpenseRecurrence, Invoice, InvoiceTemplate, PaymentMethod, Preferences, TaxReturnPeriod } from '@/stores/yjs/types';
import type { AgentCommandContext, AgentYMap } from '@/agent/types';
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

type Defaultable = { id: string; isDefault?: boolean };

const MAX_BRAND_ASSET_BYTES = 250 * 1024;
const SUPPORTED_BRAND_ASSET_MIME_TYPES = new Set(['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']);

export interface CreateBusinessInfoCommandInput extends Partial<BusinessInfo> {
    id?: string;
    idempotencyKey?: string;
}

export interface UpdateBusinessInfoCommandInput {
    businessInfoId: string;
    updates: Partial<BusinessInfo>;
}

export interface DeleteBusinessInfoCommandInput {
    businessInfoId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
}

export interface DeleteBusinessInfoResult {
    businessInfoId: string;
    title: string;
    deleted: true;
}

export interface ListBusinessBrandAssetsCommandInput {
    businessInfoId?: string;
    includeArchived?: boolean;
    includeDataUrl?: boolean;
}

export interface CreateBusinessBrandAssetCommandInput extends Partial<Omit<BusinessBrandAsset, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>> {
    id?: string;
    businessInfoId: string;
    kind?: 'logo';
    dataUrl: string;
    mimeType: BusinessBrandAsset['mimeType'];
    width: number;
    height: number;
    byteSize: number;
    contentHash: string;
    createdAt?: number;
    updatedAt?: number | null;
    archivedAt?: number | null;
    idempotencyKey?: string;
}

export interface UpdateBusinessBrandAssetCommandInput {
    businessBrandAssetId: string;
    updates: Partial<BusinessBrandAsset>;
}

export interface DeleteBusinessBrandAssetCommandInput {
    businessBrandAssetId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
}

export interface DeleteBusinessBrandAssetResult {
    businessBrandAssetId: string;
    businessInfoId: string;
    contentHash: string;
    deleted: true;
}

export interface CreatePaymentMethodCommandInput extends Partial<Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>> {
    id?: string;
    title: string;
    createdAt?: number;
    updatedAt?: number;
    idempotencyKey?: string;
}

export interface UpdatePaymentMethodCommandInput {
    paymentMethodId: string;
    updates: Partial<PaymentMethod>;
}

export interface DeletePaymentMethodCommandInput {
    paymentMethodId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
}

export interface DeletePaymentMethodResult {
    paymentMethodId: string;
    title: string;
    deleted: true;
}

export interface CreateInvoiceTemplateCommandInput extends Partial<Omit<InvoiceTemplate, 'id'>> {
    id?: string;
    name: string;
    idempotencyKey?: string;
}

export interface UpdateInvoiceTemplateCommandInput {
    invoiceTemplateId: string;
    updates: Partial<InvoiceTemplate>;
}

export interface DeleteInvoiceTemplateCommandInput {
    invoiceTemplateId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
}

export interface DeleteInvoiceTemplateResult {
    invoiceTemplateId: string;
    name: string;
    deleted: true;
}

export interface CreateEmailTemplateCommandInput extends Partial<Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>> {
    id?: string;
    name: string;
    type: EmailTemplate['type'];
    subject: string;
    sendBody: string;
    reminderBody: string;
    attachmentTitle: string;
    createdAt?: number;
    updatedAt?: number;
    idempotencyKey?: string;
}

export interface UpdateEmailTemplateCommandInput {
    emailTemplateId: string;
    updates: Partial<EmailTemplate>;
}

export interface DeleteEmailTemplateCommandInput {
    emailTemplateId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
}

export interface DeleteEmailTemplateResult {
    emailTemplateId: string;
    name: string;
    type: EmailTemplate['type'];
    deleted: true;
}

export interface CreateExpenseCategoryCommandInput extends Partial<Omit<ExpenseCategory, 'id' | 'createdAt' | 'updatedAt'>> {
    id?: string;
    name: string;
    createdAt?: number;
    updatedAt?: number;
    idempotencyKey?: string;
}

export interface UpdateExpenseCategoryCommandInput {
    expenseCategoryId: string;
    updates: Partial<ExpenseCategory>;
}

export interface DeleteExpenseCategoryCommandInput {
    expenseCategoryId: string;
    confirmDelete?: boolean;
    confirmationText?: string;
}

export interface DeleteExpenseCategoryResult {
    expenseCategoryId: string;
    name: string;
    deleted: true;
}

export interface UpdatePreferencesCommandInput {
    updates: Partial<Preferences>;
}

const SYNC_PREFERENCE_KEYS = new Set<keyof Preferences>([
    'autoSyncEnabled',
    'autoSyncMode',
    'backupEnabled',
    'backupFrequencyHours',
]);

export function getPreferencesCommand(context: AgentCommandContext): Preferences {
    assertReady(context);
    assertPermission(context, 'read');

    return validatePreferencesRecord(Object.fromEntries(context.store.preferences.entries()), 'agent get preferences');
}

export function updatePreferencesCommand(context: AgentCommandContext, input: UpdatePreferencesCommandInput): Preferences {
    assertReady(context);
    assertPermission(context, 'write');

    const updates = input.updates || {};
    const blockedSyncKeys = Object.keys(updates).filter((key) => SYNC_PREFERENCE_KEYS.has(key as keyof Preferences));

    if (blockedSyncKeys.length > 0) {
        throw new AgentCommandError('INVALID_INPUT', 'Sync and backup preferences require explicit sync-control commands.', {
            keys: blockedSyncKeys,
        });
    }

    const existing = Object.fromEntries(context.store.preferences.entries());
    const nextPreferences = validatePreferencesRecord({
        ...existing,
        ...updates,
    }, 'agent update preferences');

    Object.keys(updates).forEach((key) => {
        const value = (nextPreferences as Record<string, unknown>)[key];

        if (value !== undefined) {
            context.store.preferences.set(key, value as Preferences[keyof Preferences]);
        }
    });

    return validatePreferencesRecord(Object.fromEntries(context.store.preferences.entries()), 'agent updated preferences');
}

export function listBusinessInfosCommand(context: AgentCommandContext): BusinessInfo[] {
    assertReady(context);
    assertPermission(context, 'read');

    return collectValidatedEntities<BusinessInfo>('businessInfos', context.store.businessInfos as any, 'agent list business infos')
        .sort(defaultFirstTitleSort);
}

export function createBusinessInfoCommand(context: AgentCommandContext, input: CreateBusinessInfoCommandInput): BusinessInfo {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const id = input.id || getId(context);
        const existing = collectValidatedEntities<BusinessInfo>('businessInfos', context.store.businessInfos as any, 'agent create business info defaults');
        const isDefault = input.isDefault ?? existing.length === 0;

        if (isDefault) {
            unsetDefaults(context.store.businessInfos as any);
        }

        return createValidatedEntity<BusinessInfo>(context.store.businessInfos as any, 'businessInfos', {
            ...input,
            id,
            isDefault,
        }, `agent create business info ${id}`);
    });
}

export function updateBusinessInfoCommand(context: AgentCommandContext, input: UpdateBusinessInfoCommandInput): BusinessInfo {
    assertReady(context);
    assertPermission(context, 'write');

    const businessInfoId = requireString(input.businessInfoId, 'businessInfoId');

    readRequiredEntity<BusinessInfo>(context.store.businessInfos as any, businessInfoId, 'Business info');

    if (input.updates?.isDefault === true) {
        unsetDefaults(context.store.businessInfos as any, businessInfoId);
    }

    return updateValidatedEntity<BusinessInfo>(
        context.store.businessInfos as any,
        'businessInfos',
        businessInfoId,
        input.updates || {},
        `agent update business info ${businessInfoId}`
    );
}

export function setDefaultBusinessInfoCommand(context: AgentCommandContext, input: { businessInfoId: string }): BusinessInfo {
    return updateBusinessInfoCommand(context, {
        businessInfoId: input.businessInfoId,
        updates: { isDefault: true },
    });
}

export function deleteBusinessInfoCommand(context: AgentCommandContext, input: DeleteBusinessInfoCommandInput): DeleteBusinessInfoResult {
    assertReady(context);
    assertPermission(context, 'write');

    const businessInfoId = requireString(input.businessInfoId, 'businessInfoId');

    if (input.confirmDelete !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmDelete must be true to delete a business profile.', { businessInfoId });
    }

    if (input.confirmationText !== businessInfoId) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must match businessInfoId to delete a business profile.', { businessInfoId });
    }

    const businessInfo = readRequiredEntity<BusinessInfo>(context.store.businessInfos as any, businessInfoId, 'Business info');
    const reference = findBusinessInfoDeleteReference({
        businessInfoId,
        invoices: collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent delete business info invoice references'),
        businessBrandAssets: collectValidatedEntities<BusinessBrandAsset>('businessBrandAssets', context.store.businessBrandAssets as any, 'agent delete business info brand asset references'),
        expenses: collectValidatedEntities<Expense>('expenses', context.store.expenses as any, 'agent delete business info expense references'),
        expenseRecurrences: collectValidatedEntities<ExpenseRecurrence>('expenseRecurrences', context.store.expenseRecurrences as any, 'agent delete business info recurrence references'),
        taxReturnPeriods: collectValidatedEntities<TaxReturnPeriod>('taxReturnPeriods', context.store.taxReturnPeriods as any, 'agent delete business info tax return references'),
    });

    throwSettingsDeleteReferenceConflict('businessInfo', businessInfoId, reference);

    context.store.coreDoc.transact(() => {
        context.store.businessInfos.delete(businessInfoId);
    });

    return {
        businessInfoId,
        title: businessInfo.title || businessInfo.businessName || businessInfoId,
        deleted: true,
    };
}

export function listBusinessBrandAssetsCommand(
    context: AgentCommandContext,
    input: ListBusinessBrandAssetsCommandInput = {}
): Array<BusinessBrandAsset | (Omit<BusinessBrandAsset, 'dataUrl'> & { hasDataUrl: boolean })> {
    assertReady(context);
    assertPermission(context, 'read');

    const businessInfoId = input.businessInfoId ? requireString(input.businessInfoId, 'businessInfoId') : null;

    if (businessInfoId) {
        readRequiredEntity<BusinessInfo>(context.store.businessInfos as any, businessInfoId, 'Business info');
    }

    return collectValidatedEntities<BusinessBrandAsset>('businessBrandAssets', context.store.businessBrandAssets as any, 'agent list business brand assets')
        .filter((asset) => !businessInfoId || asset.businessInfoId === businessInfoId)
        .filter((asset) => input.includeArchived === true || !asset.archivedAt)
        .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
        .map((asset) => input.includeDataUrl === true ? asset : omitBrandAssetDataUrl(asset));
}

export function createBusinessBrandAssetCommand(context: AgentCommandContext, input: CreateBusinessBrandAssetCommandInput): BusinessBrandAsset {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const businessInfoId = requireString(input.businessInfoId, 'businessInfoId');
        const contentHash = requireString(input.contentHash, 'contentHash');
        const existing = findBusinessBrandAssetByHash(context, businessInfoId, contentHash);

        if (existing) {
            return existing;
        }

        readRequiredEntity<BusinessInfo>(context.store.businessInfos as any, businessInfoId, 'Business info');
        validateBusinessBrandAssetPayload(input);

        const id = input.id || getId(context);
        const now = getNow(context);

        return createValidatedEntity<BusinessBrandAsset>(context.store.businessBrandAssets as any, 'businessBrandAssets', {
            ...input,
            id,
            businessInfoId,
            kind: 'logo',
            dataUrl: requireString(input.dataUrl, 'dataUrl'),
            mimeType: requireString(input.mimeType, 'mimeType'),
            fileName: input.fileName ?? null,
            width: input.width,
            height: input.height,
            byteSize: input.byteSize,
            contentHash,
            createdAt: input.createdAt ?? now,
            updatedAt: input.updatedAt ?? now,
            archivedAt: input.archivedAt ?? null,
        }, `agent create business brand asset ${id}`);
    });
}

export function updateBusinessBrandAssetCommand(context: AgentCommandContext, input: UpdateBusinessBrandAssetCommandInput): BusinessBrandAsset {
    assertReady(context);
    assertPermission(context, 'write');

    const businessBrandAssetId = requireString(input.businessBrandAssetId, 'businessBrandAssetId');
    const updates = input.updates || {};
    const existing = readRequiredEntity<BusinessBrandAsset>(context.store.businessBrandAssets as any, businessBrandAssetId, 'Business brand asset');

    if (updates.businessInfoId) {
        readRequiredEntity<BusinessInfo>(context.store.businessInfos as any, updates.businessInfoId, 'Business info');
    }

    validateBusinessBrandAssetPayload({ ...existing, ...updates });

    return updateValidatedSettingsEntity<BusinessBrandAsset>(
        context,
        context.store.businessBrandAssets as any,
        'businessBrandAssets',
        businessBrandAssetId,
        updates,
        `agent update business brand asset ${businessBrandAssetId}`
    );
}

export function archiveBusinessBrandAssetCommand(context: AgentCommandContext, input: { businessBrandAssetId: string }): BusinessBrandAsset {
    return updateBusinessBrandAssetCommand(context, {
        businessBrandAssetId: input.businessBrandAssetId,
        updates: { archivedAt: getNow(context) },
    });
}

export function unarchiveBusinessBrandAssetCommand(context: AgentCommandContext, input: { businessBrandAssetId: string }): BusinessBrandAsset {
    return updateBusinessBrandAssetCommand(context, {
        businessBrandAssetId: input.businessBrandAssetId,
        updates: { archivedAt: null },
    });
}

export function deleteBusinessBrandAssetCommand(
    context: AgentCommandContext,
    input: DeleteBusinessBrandAssetCommandInput
): DeleteBusinessBrandAssetResult {
    assertReady(context);
    assertPermission(context, 'write');

    const businessBrandAssetId = requireString(input.businessBrandAssetId, 'businessBrandAssetId');

    if (input.confirmDelete !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmDelete must be true to delete a business brand asset.', { businessBrandAssetId });
    }

    if (input.confirmationText !== businessBrandAssetId) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must match businessBrandAssetId to delete a business brand asset.', { businessBrandAssetId });
    }

    const asset = readRequiredEntity<BusinessBrandAsset>(context.store.businessBrandAssets as any, businessBrandAssetId, 'Business brand asset');
    const reference = findBusinessBrandAssetDeleteReference({
        businessBrandAssetId,
        businessInfos: collectValidatedEntities<BusinessInfo>('businessInfos', context.store.businessInfos as any, 'agent delete business brand asset business references'),
        invoices: collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent delete business brand asset invoice references'),
    });

    throwSettingsDeleteReferenceConflict('businessBrandAsset', businessBrandAssetId, reference);

    context.store.coreDoc.transact(() => {
        context.store.businessBrandAssets.delete(businessBrandAssetId);
    });

    return {
        businessBrandAssetId,
        businessInfoId: asset.businessInfoId,
        contentHash: asset.contentHash,
        deleted: true,
    };
}

export function listPaymentMethodsCommand(context: AgentCommandContext): PaymentMethod[] {
    assertReady(context);
    assertPermission(context, 'read');

    return collectValidatedEntities<PaymentMethod>('paymentMethods', context.store.paymentMethods as any, 'agent list payment methods')
        .sort(defaultFirstTitleSort);
}

export function createPaymentMethodCommand(context: AgentCommandContext, input: CreatePaymentMethodCommandInput): PaymentMethod {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const id = input.id || getId(context);
        const now = getNow(context);
        const existing = collectValidatedEntities<PaymentMethod>('paymentMethods', context.store.paymentMethods as any, 'agent create payment method defaults');
        const isDefault = input.isDefault ?? existing.length === 0;

        if (isDefault) {
            unsetDefaults(context.store.paymentMethods as any);
        }

        return createValidatedEntity<PaymentMethod>(context.store.paymentMethods as any, 'paymentMethods', {
            ...input,
            id,
            title: requireString(input.title, 'title'),
            custom: input.custom ?? [],
            isDefault,
            createdAt: input.createdAt ?? now,
            updatedAt: input.updatedAt ?? now,
        }, `agent create payment method ${id}`);
    });
}

export function updatePaymentMethodCommand(context: AgentCommandContext, input: UpdatePaymentMethodCommandInput): PaymentMethod {
    assertReady(context);
    assertPermission(context, 'write');

    const paymentMethodId = requireString(input.paymentMethodId, 'paymentMethodId');

    readRequiredEntity<PaymentMethod>(context.store.paymentMethods as any, paymentMethodId, 'Payment method');

    if (input.updates?.isDefault === true) {
        unsetDefaults(context.store.paymentMethods as any, paymentMethodId);
    }

    return updateValidatedSettingsEntity<PaymentMethod>(
        context,
        context.store.paymentMethods as any,
        'paymentMethods',
        paymentMethodId,
        input.updates || {},
        `agent update payment method ${paymentMethodId}`
    );
}

export function setDefaultPaymentMethodCommand(context: AgentCommandContext, input: { paymentMethodId: string }): PaymentMethod {
    return updatePaymentMethodCommand(context, {
        paymentMethodId: input.paymentMethodId,
        updates: { isDefault: true },
    });
}

export function deletePaymentMethodCommand(context: AgentCommandContext, input: DeletePaymentMethodCommandInput): DeletePaymentMethodResult {
    assertReady(context);
    assertPermission(context, 'write');

    const paymentMethodId = requireString(input.paymentMethodId, 'paymentMethodId');

    if (input.confirmDelete !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmDelete must be true to delete a payment method.', { paymentMethodId });
    }

    if (input.confirmationText !== paymentMethodId) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must match paymentMethodId to delete a payment method.', { paymentMethodId });
    }

    const paymentMethod = readRequiredEntity<PaymentMethod>(context.store.paymentMethods as any, paymentMethodId, 'Payment method');
    const reference = findPaymentMethodDeleteReference({
        paymentMethodId,
        invoices: collectValidatedEntities<Invoice>('invoices', context.store.invoices as any, 'agent delete payment method invoice references'),
    });

    throwSettingsDeleteReferenceConflict('paymentMethod', paymentMethodId, reference);

    context.store.coreDoc.transact(() => {
        context.store.paymentMethods.delete(paymentMethodId);
    });

    return {
        paymentMethodId,
        title: paymentMethod.title,
        deleted: true,
    };
}

export function listInvoiceTemplatesCommand(context: AgentCommandContext): InvoiceTemplate[] {
    assertReady(context);
    assertPermission(context, 'read');

    return collectValidatedEntities<InvoiceTemplate>('invoiceTemplates', context.store.invoiceTemplates as any, 'agent list invoice templates')
        .sort(defaultFirstNameSort);
}

export function createInvoiceTemplateCommand(context: AgentCommandContext, input: CreateInvoiceTemplateCommandInput): InvoiceTemplate {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const id = input.id || getId(context);

        if (input.isDefault === true) {
            unsetDefaults(context.store.invoiceTemplates as any);
        }

        return createValidatedEntity<InvoiceTemplate>(context.store.invoiceTemplates as any, 'invoiceTemplates', {
            ...input,
            id,
            name: requireString(input.name, 'name'),
            currentSequentialNumber: input.currentSequentialNumber ?? 1,
        }, `agent create invoice template ${id}`);
    });
}

export function updateInvoiceTemplateCommand(context: AgentCommandContext, input: UpdateInvoiceTemplateCommandInput): InvoiceTemplate {
    assertReady(context);
    assertPermission(context, 'write');

    const invoiceTemplateId = requireString(input.invoiceTemplateId, 'invoiceTemplateId');

    readRequiredEntity<InvoiceTemplate>(context.store.invoiceTemplates as any, invoiceTemplateId, 'Invoice template');

    if (input.updates?.isDefault === true) {
        unsetDefaults(context.store.invoiceTemplates as any, invoiceTemplateId);
    }

    return updateValidatedEntity<InvoiceTemplate>(
        context.store.invoiceTemplates as any,
        'invoiceTemplates',
        invoiceTemplateId,
        input.updates || {},
        `agent update invoice template ${invoiceTemplateId}`
    );
}

export function setDefaultInvoiceTemplateCommand(context: AgentCommandContext, input: { invoiceTemplateId: string }): InvoiceTemplate {
    return updateInvoiceTemplateCommand(context, {
        invoiceTemplateId: input.invoiceTemplateId,
        updates: { isDefault: true },
    });
}

export function deleteInvoiceTemplateCommand(context: AgentCommandContext, input: DeleteInvoiceTemplateCommandInput): DeleteInvoiceTemplateResult {
    assertReady(context);
    assertPermission(context, 'write');

    const invoiceTemplateId = requireString(input.invoiceTemplateId, 'invoiceTemplateId');

    if (input.confirmDelete !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmDelete must be true to delete an invoice template.', { invoiceTemplateId });
    }

    if (input.confirmationText !== invoiceTemplateId) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must match invoiceTemplateId to delete an invoice template.', { invoiceTemplateId });
    }

    const template = readRequiredEntity<InvoiceTemplate>(context.store.invoiceTemplates as any, invoiceTemplateId, 'Invoice template');
    const reference = findInvoiceTemplateDeleteReference({
        invoiceTemplateId,
        invoices: collectValidatedEntities<Invoice & { templateId?: string | null }>('invoices', context.store.invoices as any, 'agent delete invoice template invoice references'),
    });

    throwSettingsDeleteReferenceConflict('invoiceTemplate', invoiceTemplateId, reference);

    context.store.coreDoc.transact(() => {
        context.store.invoiceTemplates.delete(invoiceTemplateId);
    });

    return {
        invoiceTemplateId,
        name: template.name,
        deleted: true,
    };
}

export function listEmailTemplatesCommand(context: AgentCommandContext, input: { type?: EmailTemplate['type'] | null } = {}): EmailTemplate[] {
    assertReady(context);
    assertPermission(context, 'read');

    return collectValidatedEntities<EmailTemplate>('emailTemplates', context.store.emailTemplates as any, 'agent list email templates')
        .filter((template) => !input.type || template.type === input.type)
        .sort(defaultFirstNameSort);
}

export function createEmailTemplateCommand(context: AgentCommandContext, input: CreateEmailTemplateCommandInput): EmailTemplate {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const id = input.id || getId(context);
        const now = getNow(context);

        if (input.isDefault === true) {
            unsetEmailTemplateDefaultsForType(context.store.emailTemplates as any, input.type);
        }

        return createValidatedEntity<EmailTemplate>(context.store.emailTemplates as any, 'emailTemplates', {
            ...input,
            id,
            name: requireString(input.name, 'name'),
            createdAt: input.createdAt ?? now,
            updatedAt: input.updatedAt ?? now,
        }, `agent create email template ${id}`);
    });
}

export function updateEmailTemplateCommand(context: AgentCommandContext, input: UpdateEmailTemplateCommandInput): EmailTemplate {
    assertReady(context);
    assertPermission(context, 'write');

    const emailTemplateId = requireString(input.emailTemplateId, 'emailTemplateId');
    const existing = readRequiredEntity<EmailTemplate>(context.store.emailTemplates as any, emailTemplateId, 'Email template');
    const nextType = input.updates?.type || existing.type;

    if (input.updates?.isDefault === true) {
        unsetEmailTemplateDefaultsForType(context.store.emailTemplates as any, nextType, emailTemplateId);
    }

    return updateValidatedSettingsEntity<EmailTemplate>(
        context,
        context.store.emailTemplates as any,
        'emailTemplates',
        emailTemplateId,
        input.updates || {},
        `agent update email template ${emailTemplateId}`
    );
}

export function setDefaultEmailTemplateCommand(context: AgentCommandContext, input: { emailTemplateId: string }): EmailTemplate {
    const emailTemplateId = requireString(input.emailTemplateId, 'emailTemplateId');
    const existing = readRequiredEntity<EmailTemplate>(context.store.emailTemplates as any, emailTemplateId, 'Email template');

    unsetEmailTemplateDefaultsForType(context.store.emailTemplates as any, existing.type, emailTemplateId);
    return updateValidatedSettingsEntity<EmailTemplate>(
        context,
        context.store.emailTemplates as any,
        'emailTemplates',
        emailTemplateId,
        { isDefault: true },
        `agent set default email template ${emailTemplateId}`
    );
}

export function deleteEmailTemplateCommand(context: AgentCommandContext, input: DeleteEmailTemplateCommandInput): DeleteEmailTemplateResult {
    assertReady(context);
    assertPermission(context, 'write');

    const emailTemplateId = requireString(input.emailTemplateId, 'emailTemplateId');

    if (input.confirmDelete !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmDelete must be true to delete an email template.', { emailTemplateId });
    }

    if (input.confirmationText !== emailTemplateId) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must match emailTemplateId to delete an email template.', { emailTemplateId });
    }

    const template = readRequiredEntity<EmailTemplate>(context.store.emailTemplates as any, emailTemplateId, 'Email template');

    context.store.coreDoc.transact(() => {
        context.store.emailTemplates.delete(emailTemplateId);
    });

    return {
        emailTemplateId,
        name: template.name,
        type: template.type,
        deleted: true,
    };
}

export function listExpenseCategoriesCommand(context: AgentCommandContext, input: { includeArchived?: boolean } = {}): ExpenseCategory[] {
    assertReady(context);
    assertPermission(context, 'read');

    return collectValidatedEntities<ExpenseCategory>('expenseCategories', context.store.expenseCategories as any, 'agent list expense categories')
        .filter((category) => input.includeArchived === true || !category.archived)
        .sort(defaultFirstNameSort);
}

export function createExpenseCategoryCommand(context: AgentCommandContext, input: CreateExpenseCategoryCommandInput): ExpenseCategory {
    assertReady(context);
    assertPermission(context, 'write');

    return withIdempotency(context, input.idempotencyKey, () => {
        const id = input.id || getId(context);
        const now = getNow(context);

        return createValidatedEntity<ExpenseCategory>(context.store.expenseCategories as any, 'expenseCategories', {
            ...input,
            id,
            name: requireString(input.name, 'name'),
            group: input.group ?? null,
            isDefault: input.isDefault ?? false,
            archived: input.archived ?? false,
            createdAt: input.createdAt ?? now,
            updatedAt: input.updatedAt ?? now,
        }, `agent create expense category ${id}`);
    });
}

export function updateExpenseCategoryCommand(context: AgentCommandContext, input: UpdateExpenseCategoryCommandInput): ExpenseCategory {
    assertReady(context);
    assertPermission(context, 'write');

    const expenseCategoryId = requireString(input.expenseCategoryId, 'expenseCategoryId');

    readRequiredEntity<ExpenseCategory>(context.store.expenseCategories as any, expenseCategoryId, 'Expense category');

    return updateValidatedSettingsEntity<ExpenseCategory>(
        context,
        context.store.expenseCategories as any,
        'expenseCategories',
        expenseCategoryId,
        input.updates || {},
        `agent update expense category ${expenseCategoryId}`
    );
}

export function archiveExpenseCategoryCommand(context: AgentCommandContext, input: { expenseCategoryId: string }): ExpenseCategory {
    return updateExpenseCategoryCommand(context, {
        expenseCategoryId: input.expenseCategoryId,
        updates: { archived: true },
    });
}

export function unarchiveExpenseCategoryCommand(context: AgentCommandContext, input: { expenseCategoryId: string }): ExpenseCategory {
    return updateExpenseCategoryCommand(context, {
        expenseCategoryId: input.expenseCategoryId,
        updates: { archived: false },
    });
}

export function deleteExpenseCategoryCommand(context: AgentCommandContext, input: DeleteExpenseCategoryCommandInput): DeleteExpenseCategoryResult {
    assertReady(context);
    assertPermission(context, 'write');

    const expenseCategoryId = requireString(input.expenseCategoryId, 'expenseCategoryId');

    if (input.confirmDelete !== true) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmDelete must be true to delete an expense category.', { expenseCategoryId });
    }

    if (input.confirmationText !== expenseCategoryId) {
        throw new AgentCommandError('INVALID_INPUT', 'confirmationText must match expenseCategoryId to delete an expense category.', { expenseCategoryId });
    }

    const category = readRequiredEntity<ExpenseCategory>(context.store.expenseCategories as any, expenseCategoryId, 'Expense category');
    const reference = findExpenseCategoryDeleteReference({
        expenseCategoryId,
        expenses: collectValidatedEntities<Expense>('expenses', context.store.expenses as any, 'agent delete expense category expense references'),
        expenseRecurrences: collectValidatedEntities<ExpenseRecurrence>('expenseRecurrences', context.store.expenseRecurrences as any, 'agent delete expense category recurrence references'),
    });

    throwSettingsDeleteReferenceConflict('expenseCategory', expenseCategoryId, reference);

    context.store.coreDoc.transact(() => {
        context.store.expenseCategories.delete(expenseCategoryId);
    });

    return {
        expenseCategoryId,
        name: category.name,
        deleted: true,
    };
}

function updateValidatedSettingsEntity<T extends { id: string }>(
    context: AgentCommandContext,
    map: AgentYMap,
    collectionName: YjsCollectionName,
    id: string,
    updates: Record<string, unknown>,
    contextLabel: string
): T {
    return updateValidatedEntity<T>(map as any, collectionName, id, {
        ...updates,
        updatedAt: getNow(context),
    }, contextLabel);
}

function throwSettingsDeleteReferenceConflict(
    targetKind: 'businessInfo' | 'businessBrandAsset' | 'paymentMethod' | 'invoiceTemplate' | 'expenseCategory',
    targetId: string,
    reference: SettingsDeleteReference | null
): void {
    if (!reference) {
        return;
    }

    if (targetKind === 'businessInfo') {
        if (reference.kind === 'invoice') {
            throw new AgentCommandError('CONFLICT', 'Business profile is still referenced by an invoice. Leave it in place to preserve invoice history.', {
                businessInfoId: targetId,
                invoiceId: reference.id,
            });
        }

        if (reference.kind === 'businessBrandAsset') {
            throw new AgentCommandError('CONFLICT', 'Business profile is still referenced by a business brand asset. Delete or archive the brand asset first.', {
                businessInfoId: targetId,
                businessBrandAssetId: reference.id,
            });
        }

        if (reference.kind === 'expense') {
            throw new AgentCommandError('CONFLICT', 'Business profile is still referenced by an expense.', {
                businessInfoId: targetId,
                expenseId: reference.id,
            });
        }

        if (reference.kind === 'expenseRecurrence') {
            throw new AgentCommandError('CONFLICT', 'Business profile is still referenced by a recurring expense template.', {
                businessInfoId: targetId,
                recurrenceId: reference.id,
            });
        }

        if (reference.kind === 'taxReturnPeriod') {
            throw new AgentCommandError('CONFLICT', 'Business profile is still referenced by a tax return period.', {
                businessInfoId: targetId,
                taxReturnPeriodId: reference.id,
            });
        }
    }

    if (targetKind === 'businessBrandAsset') {
        if (reference.kind === 'businessInfo') {
            throw new AgentCommandError('CONFLICT', 'Business brand asset is still referenced by a business profile. Remove or replace the business logo before deleting it.', {
                businessBrandAssetId: targetId,
                businessInfoId: reference.id,
            });
        }

        if (reference.kind === 'invoice') {
            throw new AgentCommandError('CONFLICT', 'Business brand asset is still referenced by an invoice branding snapshot. Archive it instead of deleting it.', {
                businessBrandAssetId: targetId,
                invoiceId: reference.id,
            });
        }
    }

    if (targetKind === 'paymentMethod' && reference.kind === 'invoice') {
        throw new AgentCommandError('CONFLICT', 'Payment method is still referenced by an invoice. Leave it in place to preserve invoice history.', {
            paymentMethodId: targetId,
            invoiceId: reference.id,
        });
    }

    if (targetKind === 'invoiceTemplate' && reference.kind === 'invoice') {
        throw new AgentCommandError('CONFLICT', 'Invoice template is still referenced by an invoice. Leave it in place to preserve invoice history.', {
            invoiceTemplateId: targetId,
            invoiceId: reference.id,
        });
    }

    if (targetKind === 'expenseCategory') {
        if (reference.kind === 'expense') {
            throw new AgentCommandError('CONFLICT', 'Expense category is still referenced by an expense. Archive it instead of deleting it.', {
                expenseCategoryId: targetId,
                expenseId: reference.id,
            });
        }

        if (reference.kind === 'expenseRecurrence') {
            throw new AgentCommandError('CONFLICT', 'Expense category is still referenced by a recurring expense template. Archive it instead of deleting it.', {
                expenseCategoryId: targetId,
                recurrenceId: reference.id,
            });
        }
    }

    throw new AgentCommandError('CONFLICT', 'Settings record is still referenced by existing data.', {
        targetKind,
        targetId,
        referenceKind: reference.kind,
        referenceId: reference.id,
    });
}

function unsetDefaults<T extends Defaultable>(map: AgentYMap, exceptId?: string): void {
    const items: T[] = [];

    map.forEach((value, id) => {
        const entity = readEntity<T>(value);

        if (entity) {
            items.push({
                ...entity,
                id: entity.id || id,
            });
        }
    });

    planDefaultClearing({ items, exceptId }).forEach((change) => {
        updateEntityFields(map as any, change.id, change.updates);
    });
}

function unsetEmailTemplateDefaultsForType(map: AgentYMap, type: EmailTemplate['type'], exceptId?: string): void {
    const items: EmailTemplate[] = [];

    map.forEach((value, id) => {
        const template = readEntity<EmailTemplate>(value);

        if (template) {
            items.push({
                ...template,
                id: template.id || id,
            });
        }
    });

    planDefaultClearing({
        items,
        exceptId,
        isInScope: (template) => template.type === type,
    }).forEach((change) => {
        updateEntityFields(map as any, change.id, change.updates);
    });
}

function findBusinessBrandAssetByHash(context: AgentCommandContext, businessInfoId: string, contentHash: string): BusinessBrandAsset | null {
    return collectValidatedEntities<BusinessBrandAsset>('businessBrandAssets', context.store.businessBrandAssets as any, 'agent find business brand asset by hash')
        .find((asset) => asset.businessInfoId === businessInfoId && asset.contentHash === contentHash) || null;
}

function validateBusinessBrandAssetPayload(input: Partial<BusinessBrandAsset>): void {
    if (input.kind && input.kind !== 'logo') {
        throw new AgentCommandError('INVALID_INPUT', 'Only logo business brand assets are supported.', { field: 'kind' });
    }

    if (typeof input.mimeType !== 'string' || !SUPPORTED_BRAND_ASSET_MIME_TYPES.has(input.mimeType)) {
        throw new AgentCommandError('INVALID_INPUT', 'Unsupported business brand asset MIME type.', { field: 'mimeType' });
    }

    if (typeof input.dataUrl !== 'string' || !input.dataUrl.startsWith(`data:${input.mimeType}`)) {
        throw new AgentCommandError('INVALID_INPUT', 'dataUrl must match the business brand asset MIME type.', { field: 'dataUrl' });
    }

    if (typeof input.byteSize !== 'number' || input.byteSize <= 0 || input.byteSize > MAX_BRAND_ASSET_BYTES) {
        throw new AgentCommandError('INVALID_INPUT', 'Business brand asset byteSize exceeds the stored logo limit.', {
            field: 'byteSize',
            maxBytes: MAX_BRAND_ASSET_BYTES,
        });
    }
}

function omitBrandAssetDataUrl(asset: BusinessBrandAsset): Omit<BusinessBrandAsset, 'dataUrl'> & { hasDataUrl: boolean } {
    const { dataUrl: _dataUrl, ...rest } = asset;

    return {
        ...rest,
        hasDataUrl: true,
    };
}

function defaultFirstTitleSort(a: { title?: string; isDefault?: boolean }, b: { title?: string; isDefault?: boolean }): number {
    return defaultSort(a.isDefault, b.isDefault) || (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
}

function defaultFirstNameSort(a: { name?: string; isDefault?: boolean }, b: { name?: string; isDefault?: boolean }): number {
    return defaultSort(a.isDefault, b.isDefault) || (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
}

function defaultSort(aDefault?: boolean, bDefault?: boolean): number {
    if (aDefault && !bDefault) return -1;
    if (!aDefault && bDefault) return 1;
    return 0;
}
