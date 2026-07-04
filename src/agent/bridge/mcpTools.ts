import type { AgentCommandName } from '@/agent/commands/registry';
import type { AgentPermissionScope } from '@/agent/types';

export type JsonSchema = {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
};

export interface McpToolDefinition {
    name: AgentCommandName;
    description: string;
    scopes: AgentPermissionScope[];
    inputSchema: JsonSchema;
}

const optionalString = { type: 'string' };
const optionalNumber = { type: 'number' };
const optionalBoolean = { type: 'boolean' };
const nullableString = { type: ['string', 'null'] };
const projectQuoteTaskSchema = {
    type: 'object',
    properties: {
        id: optionalString,
        title: optionalString,
        hours: optionalNumber,
        hourlyRate: optionalNumber,
        flatRate: optionalNumber,
        quantity: optionalNumber,
        useFlatRate: optionalBoolean,
        parentTaskId: nullableString,
    },
    required: ['title'],
    additionalProperties: false,
};
const projectQuoteBaseProperties = {
    projectId: optionalString,
    clientId: nullableString,
    businessInfoId: nullableString,
    paymentMethodId: nullableString,
    invoiceTemplateId: nullableString,
    note: optionalString,
    quoteDate: optionalString,
    quoteTimestamp: optionalString,
    quoteTasks: {
        type: 'array',
        items: projectQuoteTaskSchema,
    },
    additionalTasks: {
        type: 'array',
        items: projectQuoteTaskSchema,
    },
};
const projectQuoteEmailProperties = {
    ...projectQuoteBaseProperties,
    emailTemplateId: nullableString,
    to: nullableString,
    fromName: nullableString,
    replyTo: nullableString,
    subject: nullableString,
    body: nullableString,
    attachmentTitle: nullableString,
    forwardToSelf: optionalBoolean,
};

const emptySchema: JsonSchema = {
    type: 'object',
    properties: {},
    additionalProperties: false,
};

export const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
    {
        name: 'list_projects',
        description: 'List active TaskTime projects visible to the paired app session.',
        scopes: ['read'],
        inputSchema: emptySchema,
    },
    {
        name: 'create_project',
        description: 'Create a non-archived TaskTime project, optionally linked to an existing preferred client.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                id: optionalString,
                title: optionalString,
                description: optionalString,
                hourlyRate: { type: ['number', 'null'] },
                flatRate: optionalBoolean,
                preferredClientId: nullableString,
                isPersonal: optionalBoolean,
                color: nullableString,
                billableTimeIncrementMinutes: { type: ['number', 'null'] },
                taskView: { type: 'string', enum: ['list', 'kanban'] },
                taskSort: { type: 'string', enum: ['createdAt', 'lastActive', 'name', 'manual'] },
                statusMode: { type: 'string', enum: ['active', 'quote'] },
                deadline: nullableString,
                budgetAmount: { type: ['number', 'null'] },
                idempotencyKey: optionalString,
            },
            required: ['title'],
            additionalProperties: false,
        },
    },
    {
        name: 'update_project',
        description: 'Update non-destructive project fields such as title, rates, client link, color, deadline, budget, and task view preferences.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
                updates: {
                    type: 'object',
                    additionalProperties: true,
                },
            },
            required: ['projectId', 'updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'archive_project',
        description: 'Archive an existing project without deleting related data.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'unarchive_project',
        description: 'Restore an archived project without changing related data.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'preview_delete_project',
        description: 'Preview the UI-style cascade impact of deleting a project without mutating data.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
                includeInvoiceDeletion: optionalBoolean,
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'cascade_delete_project',
        description: 'Delete a project and related non-billed tasks, active time entries, timers, expenses, recurring templates, and planner attachments after preview matching, explicit confirmation, and visible browser approval. Invoice-linked, billed, or tax-claimed records are rejected.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
                expectedTaskIds: {
                    type: 'array',
                    items: optionalString,
                },
                expectedTimeEntryIds: {
                    type: 'array',
                    items: optionalString,
                },
                expectedTimerKeys: {
                    type: 'array',
                    items: optionalString,
                },
                expectedExpenseIds: {
                    type: 'array',
                    items: optionalString,
                },
                expectedRecurrenceIds: {
                    type: 'array',
                    items: optionalString,
                },
                expectedPlannerAttachmentIds: {
                    type: 'array',
                    items: optionalString,
                },
            },
            required: ['projectId', 'confirmDelete', 'confirmationText', 'expectedTaskIds', 'expectedTimeEntryIds'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_project',
        description: 'Delete one unreferenced project after explicit command confirmation and visible browser approval.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['projectId', 'confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_clients',
        description: 'List TaskTime clients visible to the paired app session.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                includeArchived: optionalBoolean,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'create_client',
        description: 'Create a non-archived TaskTime client with contact, billing, tax, and notes fields.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                id: optionalString,
                title: optionalString,
                clientName: optionalString,
                contactPerson: optionalString,
                email: optionalString,
                phone: optionalString,
                address: optionalString,
                city: optionalString,
                state: optionalString,
                zip: optionalString,
                country: optionalString,
                registrationNumber: optionalString,
                vat: optionalString,
                taxNumber: optionalString,
                notes: optionalString,
                disableTax: optionalBoolean,
                defaultHourlyRate: { type: ['number', 'null'] },
                hourlyRate: { type: ['number', 'null'] },
                flatRate: optionalBoolean,
                defaultCurrency: optionalString,
                color: nullableString,
                idempotencyKey: optionalString,
            },
            required: ['title'],
            additionalProperties: false,
        },
    },
    {
        name: 'update_client',
        description: 'Update non-destructive client fields such as contact, billing, tax, notes, hourly rate, and color.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: optionalString,
                updates: {
                    type: 'object',
                    additionalProperties: true,
                },
            },
            required: ['clientId', 'updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'archive_client',
        description: 'Archive an existing client without deleting related data.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: optionalString,
            },
            required: ['clientId'],
            additionalProperties: false,
        },
    },
    {
        name: 'unarchive_client',
        description: 'Restore an archived client without changing related data.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: optionalString,
            },
            required: ['clientId'],
            additionalProperties: false,
        },
    },
    {
        name: 'preview_delete_client',
        description: 'Preview the UI-style cascade impact of deleting a client without mutating data.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: optionalString,
                alsoDeleteProjects: optionalBoolean,
                includeInvoiceDeletion: optionalBoolean,
            },
            required: ['clientId'],
            additionalProperties: false,
        },
    },
    {
        name: 'cascade_delete_client',
        description: 'Delete a client and either convert linked projects to personal or delete related non-billed project data after preview matching, explicit confirmation, and visible browser approval. Invoice-linked, billed, or tax-claimed records are rejected.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: optionalString,
                alsoDeleteProjects: optionalBoolean,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
                expectedProjectIdsToDelete: {
                    type: 'array',
                    items: optionalString,
                },
                expectedProjectIdsToConvertToPersonal: {
                    type: 'array',
                    items: optionalString,
                },
                expectedTaskIds: {
                    type: 'array',
                    items: optionalString,
                },
                expectedTimeEntryIds: {
                    type: 'array',
                    items: optionalString,
                },
                expectedTimerKeys: {
                    type: 'array',
                    items: optionalString,
                },
                expectedExpenseIds: {
                    type: 'array',
                    items: optionalString,
                },
                expectedRecurrenceIds: {
                    type: 'array',
                    items: optionalString,
                },
                expectedPlannerAttachmentIds: {
                    type: 'array',
                    items: optionalString,
                },
            },
            required: ['clientId', 'confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_client',
        description: 'Delete one unreferenced client after explicit command confirmation and visible browser approval.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['clientId', 'confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_business_infos',
        description: 'List business profiles used for invoices, expenses, and tax/reporting context.',
        scopes: ['read'],
        inputSchema: emptySchema,
    },
    {
        name: 'create_business_info',
        description: 'Create a business profile for invoice sender/tax details. Requires title/name and businessName/name.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                id: optionalString,
                title: optionalString,
                name: optionalString,
                businessName: optionalString,
                email: optionalString,
                phone: optionalString,
                address: optionalString,
                city: optionalString,
                state: optionalString,
                zip: optionalString,
                country: optionalString,
                registrationNumber: optionalString,
                vat: optionalString,
                taxNumber: optionalString,
                taxId: optionalString,
                isDefault: optionalBoolean,
                taxEnabled: optionalBoolean,
                taxLabel: optionalString,
                taxRate: optionalNumber,
                branding: { type: 'object' },
                idempotencyKey: optionalString,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'update_business_info',
        description: 'Update a business profile without deleting invoices, expenses, or brand assets.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                businessInfoId: optionalString,
                updates: { type: 'object', additionalProperties: true },
            },
            required: ['businessInfoId', 'updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'set_default_business_info',
        description: 'Set the default business profile and clear default status from the others.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                businessInfoId: optionalString,
            },
            required: ['businessInfoId'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_business_info',
        description: 'Delete one unreferenced business profile after explicit command confirmation and visible browser approval. Profiles referenced by invoices, brand assets, expenses, recurring templates, or tax return periods are rejected.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                businessInfoId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['businessInfoId', 'confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_business_brand_assets',
        description: 'List business logo brand assets, optionally scoped to a business profile and including archived assets or data URLs.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                businessInfoId: optionalString,
                includeArchived: optionalBoolean,
                includeDataUrl: optionalBoolean,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'create_business_brand_asset',
        description: 'Create a validated business logo brand asset for an existing business profile, reusing an existing matching content hash when present.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                id: optionalString,
                businessInfoId: optionalString,
                kind: { type: 'string', enum: ['logo'] },
                dataUrl: optionalString,
                mimeType: { type: 'string', enum: ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'] },
                fileName: nullableString,
                width: optionalNumber,
                height: optionalNumber,
                byteSize: optionalNumber,
                contentHash: optionalString,
                idempotencyKey: optionalString,
            },
            required: ['businessInfoId', 'dataUrl', 'mimeType', 'width', 'height', 'byteSize', 'contentHash'],
            additionalProperties: false,
        },
    },
    {
        name: 'update_business_brand_asset',
        description: 'Update a business logo brand asset without deleting invoices or business profile references.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                businessBrandAssetId: optionalString,
                updates: { type: 'object', additionalProperties: true },
            },
            required: ['businessBrandAssetId', 'updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'archive_business_brand_asset',
        description: 'Archive a business logo brand asset without deleting invoices or business profile references.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                businessBrandAssetId: optionalString,
            },
            required: ['businessBrandAssetId'],
            additionalProperties: false,
        },
    },
    {
        name: 'unarchive_business_brand_asset',
        description: 'Restore an archived business logo brand asset without changing invoices or business profile references.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                businessBrandAssetId: optionalString,
            },
            required: ['businessBrandAssetId'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_business_brand_asset',
        description: 'Delete one unreferenced business logo brand asset after explicit command confirmation and visible browser approval. Assets referenced by business profiles or invoice snapshots are rejected.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                businessBrandAssetId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['businessBrandAssetId', 'confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_payment_methods',
        description: 'List payment methods used on invoices and expenses.',
        scopes: ['read'],
        inputSchema: emptySchema,
    },
    {
        name: 'create_payment_method',
        description: 'Create a payment method. The first method becomes default unless specified otherwise.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                id: optionalString,
                title: optionalString,
                fullName: optionalString,
                bank: optionalString,
                iban: optionalString,
                swift: optionalString,
                bankAddress: optionalString,
                paypal: optionalString,
                instructions: optionalString,
                custom: { type: 'array' },
                isDefault: optionalBoolean,
                idempotencyKey: optionalString,
            },
            required: ['title'],
            additionalProperties: false,
        },
    },
    {
        name: 'update_payment_method',
        description: 'Update a payment method without deleting invoices or expenses that reference older snapshots.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                paymentMethodId: optionalString,
                updates: { type: 'object', additionalProperties: true },
            },
            required: ['paymentMethodId', 'updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'set_default_payment_method',
        description: 'Set the default payment method and clear default status from the others.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                paymentMethodId: optionalString,
            },
            required: ['paymentMethodId'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_payment_method',
        description: 'Delete one unreferenced payment method after explicit command confirmation and visible browser approval. Payment methods referenced by invoices are rejected.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                paymentMethodId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['paymentMethodId', 'confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_invoice_templates',
        description: 'List invoice templates, including sequence and branding defaults.',
        scopes: ['read'],
        inputSchema: emptySchema,
    },
    {
        name: 'create_invoice_template',
        description: 'Create an invoice template with sequence, tax, notes, and branding defaults.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                id: optionalString,
                name: optionalString,
                prefix: optionalString,
                useSequentialNumbers: optionalBoolean,
                currentSequentialNumber: optionalNumber,
                defaultNotes: optionalString,
                defaultTaxRate: optionalNumber,
                defaultDueDays: optionalNumber,
                isDefault: optionalBoolean,
                brandingOptions: { type: 'object' },
                layoutStyle: { type: 'string', enum: ['classic', 'neutral'] },
                logoPlacement: { type: 'string' },
                showBillingPeriod: optionalBoolean,
                showProjectTitle: optionalBoolean,
                idempotencyKey: optionalString,
            },
            required: ['name'],
            additionalProperties: false,
        },
    },
    {
        name: 'update_invoice_template',
        description: 'Update an invoice template. Sequence changes are allowed but should be deliberate.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceTemplateId: optionalString,
                updates: { type: 'object', additionalProperties: true },
            },
            required: ['invoiceTemplateId', 'updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'set_default_invoice_template',
        description: 'Set the default invoice template and clear default status from the others.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceTemplateId: optionalString,
            },
            required: ['invoiceTemplateId'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_invoice_template',
        description: 'Delete one unreferenced invoice template after explicit command confirmation and visible browser approval. Templates referenced by invoices are rejected.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceTemplateId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['invoiceTemplateId', 'confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_email_templates',
        description: 'List invoice/quote email templates, optionally filtered by template type.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                type: { type: ['string', 'null'], enum: ['invoice', 'quote', null] },
            },
            additionalProperties: false,
        },
    },
    {
        name: 'create_email_template',
        description: 'Create an invoice or quote email template with subject, body, reminder body, and attachment filename defaults.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                id: optionalString,
                name: optionalString,
                type: { type: 'string', enum: ['invoice', 'quote'] },
                fromName: optionalString,
                replyTo: optionalString,
                subject: optionalString,
                sendBody: optionalString,
                reminderBody: optionalString,
                attachmentTitle: optionalString,
                isDefault: optionalBoolean,
                idempotencyKey: optionalString,
            },
            required: ['name', 'type', 'subject', 'sendBody', 'reminderBody', 'attachmentTitle'],
            additionalProperties: false,
        },
    },
    {
        name: 'update_email_template',
        description: 'Update an invoice or quote email template.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                emailTemplateId: optionalString,
                updates: { type: 'object', additionalProperties: true },
            },
            required: ['emailTemplateId', 'updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'set_default_email_template',
        description: 'Set the default email template for its type and clear default status from other templates of the same type.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                emailTemplateId: optionalString,
            },
            required: ['emailTemplateId'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_email_template',
        description: 'Delete one invoice or quote email template after explicit command confirmation and visible browser approval.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                emailTemplateId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['emailTemplateId', 'confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_expense_categories',
        description: 'List active expense categories used by expense and recurring expense workflows. Set includeArchived to true to include archived categories.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                includeArchived: optionalBoolean,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'create_expense_category',
        description: 'Create a non-archived expense category through the validated settings collection.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                id: optionalString,
                name: optionalString,
                group: nullableString,
                isDefault: optionalBoolean,
                archived: optionalBoolean,
                idempotencyKey: optionalString,
            },
            required: ['name'],
            additionalProperties: false,
        },
    },
    {
        name: 'update_expense_category',
        description: 'Update expense category metadata such as name, group, default flag, and archive state.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                expenseCategoryId: optionalString,
                updates: { type: 'object', additionalProperties: true },
            },
            required: ['expenseCategoryId', 'updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'archive_expense_category',
        description: 'Archive an expense category without deleting expenses or recurring templates that reference it.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                expenseCategoryId: optionalString,
            },
            required: ['expenseCategoryId'],
            additionalProperties: false,
        },
    },
    {
        name: 'unarchive_expense_category',
        description: 'Restore an archived expense category without changing related expenses or recurring templates.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                expenseCategoryId: optionalString,
            },
            required: ['expenseCategoryId'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_expense_category',
        description: 'Delete one unreferenced expense category after explicit command confirmation and visible browser approval. Categories referenced by expenses or recurring templates are rejected.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                expenseCategoryId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['expenseCategoryId', 'confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_preferences',
        description: 'Return validated TaskTime user preferences. Sync/backup control state is readable but not mutable through update_preferences.',
        scopes: ['read'],
        inputSchema: emptySchema,
    },
    {
        name: 'update_preferences',
        description: 'Update non-sync user preferences such as currency, theme, date/time format, default view, week start, task visibility, default billable behavior, sorting, weekly goals, and notification time. Sync/backup preferences are intentionally rejected.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                updates: {
                    type: 'object',
                    properties: {
                        currency: optionalString,
                        dateFormat: optionalString,
                        timeFormat: optionalString,
                        theme: { type: 'string', enum: ['light', 'dark', 'system'] },
                        defaultView: optionalString,
                        weekStartsOn: optionalNumber,
                        autoHideTotalsOnRevisit: optionalBoolean,
                        showCompletedTasks: optionalBoolean,
                        defaultBillable: optionalBoolean,
                        projectSort: { type: 'string', enum: ['createdAt', 'lastActive', 'name'] },
                        clientSort: { type: 'string', enum: ['createdAt', 'lastActive', 'name'] },
                        weeklyGoalTargetHours: { type: ['number', 'null'] },
                        weeklyGoalTargetEarnings: { type: ['number', 'null'] },
                        systemNotificationsEnabled: optionalBoolean,
                        systemNotificationTime: optionalString,
                    },
                    additionalProperties: false,
                },
            },
            required: ['updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_tasks',
        description: 'List TaskTime tasks, optionally scoped to a project ID.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: nullableString,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'create_task',
        description: 'Create a TaskTime task or subtask. Subtasks cannot be recurring.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                title: optionalString,
                projectId: nullableString,
                parentTaskId: nullableString,
                note: nullableString,
                billable: optionalBoolean,
                idempotencyKey: optionalString,
            },
            required: ['title'],
            additionalProperties: true,
        },
    },
    {
        name: 'update_task',
        description: 'Update an existing TaskTime task.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
                updates: { type: 'object' },
            },
            required: ['taskId', 'updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'complete_task',
        description: 'Complete a non-recurring task or a specific recurring occurrence.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
                occurrenceDate: optionalString,
            },
            required: ['taskId'],
            additionalProperties: false,
        },
    },
    {
        name: 'archive_task',
        description: 'Archive a task using TaskTime archive behavior. This is not a destructive delete.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
            },
            required: ['taskId'],
            additionalProperties: false,
        },
    },
    {
        name: 'unarchive_task',
        description: 'Restore an archived task using TaskTime unarchive behavior. This is not a destructive recreate.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
            },
            required: ['taskId'],
            additionalProperties: false,
        },
    },
    {
        name: 'preview_delete_task',
        description: 'Preview the UI-style cascade impact of deleting an active or archived task without mutating data.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
            },
            required: ['taskId'],
            additionalProperties: false,
        },
    },
    {
        name: 'cascade_delete_task',
        description: 'Delete a task, descendant tasks, related active time entries, matching timers, and planner attachments after preview matching, explicit confirmation, and visible browser approval. Billed or invoice-linked tasks are rejected.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
                expectedTaskIds: {
                    type: 'array',
                    items: optionalString,
                },
                expectedTimeEntryIds: {
                    type: 'array',
                    items: optionalString,
                },
                expectedTimerKeys: {
                    type: 'array',
                    items: optionalString,
                },
                expectedPlannerAttachmentIds: {
                    type: 'array',
                    items: optionalString,
                },
            },
            required: ['taskId', 'confirmDelete', 'confirmationText', 'expectedTaskIds', 'expectedTimeEntryIds'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_task',
        description: 'Delete one unreferenced active or archived task after explicit command confirmation and visible browser approval.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['taskId', 'confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_active_timers',
        description: 'List active timers with resolved timer keys and elapsed time.',
        scopes: ['read'],
        inputSchema: emptySchema,
    },
    {
        name: 'start_timer',
        description: 'Start a timer for a task. Existing active timers for the same key are not overwritten.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
                note: optionalString,
                idempotencyKey: optionalString,
            },
            required: ['taskId'],
            additionalProperties: false,
        },
    },
    {
        name: 'pause_timer',
        description: 'Pause a timer by timer key or task ID.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                timerKey: optionalString,
                taskId: optionalString,
                pausedAt: optionalNumber,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'stop_timer',
        description: 'Stop a timer and create the matching time entry.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                timerKey: optionalString,
                taskId: optionalString,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'add_manual_time_entry',
        description: 'Create a manual time entry after TaskTime validates billing cutoffs and overlaps.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taskId: optionalString,
                start: optionalNumber,
                end: optionalNumber,
                note: optionalString,
                billingIncrementMinutes: { type: ['number', 'null'] },
                idempotencyKey: optionalString,
            },
            required: ['taskId', 'start', 'end'],
            additionalProperties: false,
        },
    },
    {
        name: 'update_time_entry',
        description: 'Edit an active unbilled time entry after validating task, billing cutoff, and overlap rules. Historical and billed entries are rejected.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                entryId: optionalString,
                taskId: optionalString,
                start: optionalNumber,
                end: optionalNumber,
                note: nullableString,
                billingIncrementMinutes: { type: ['number', 'null'] },
            },
            required: ['entryId'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_time_entry',
        description: 'Delete one active unbilled time entry after explicit command confirmation and visible browser approval. Historical and billed entries are rejected.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                entryId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['entryId', 'confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_expenses',
        description: 'List expenses, optionally scoped by client, project, or billable state.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: nullableString,
                projectId: nullableString,
                billableOnly: optionalBoolean,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'create_expense',
        description: 'Create an expense through the TaskTime command layer.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                title: optionalString,
                date: optionalString,
                amount: optionalNumber,
                currency: optionalString,
                isPersonal: optionalBoolean,
                billable: optionalBoolean,
                clientId: nullableString,
                projectId: nullableString,
                idempotencyKey: optionalString,
            },
            required: ['title', 'date', 'amount', 'currency', 'isPersonal', 'billable'],
            additionalProperties: true,
        },
    },
    {
        name: 'delete_expense',
        description: 'Delete one active unbilled and unclaimed expense after explicit command confirmation and visible browser approval. Billed and tax-claimed expenses are rejected.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                expenseId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['expenseId', 'confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_expense_recurrences',
        description: 'List recurring expense templates, optionally scoped by client/project or active status.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                activeOnly: optionalBoolean,
                clientId: nullableString,
                projectId: nullableString,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'create_expense_recurrence',
        description: 'Create a recurring expense template and optionally generate the initial expense instance when due, matching the UI flow.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                id: optionalString,
                title: optionalString,
                note: nullableString,
                supplierName: nullableString,
                paidBy: nullableString,
                paymentMode: { type: 'string', enum: ['manual', 'auto'] },
                currency: optionalString,
                amount: optionalNumber,
                amountType: { type: 'string', enum: ['fixed', 'variable'] },
                repeat: { type: 'string', enum: ['monthly', 'yearly'] },
                monthlyType: { type: 'string', enum: ['first', 'last', 'specific'] },
                monthlyDay: optionalNumber,
                startDate: optionalString,
                endDate: nullableString,
                clientId: nullableString,
                projectId: nullableString,
                businessId: nullableString,
                categoryId: nullableString,
                isPersonal: optionalBoolean,
                billable: optionalBoolean,
                taxNumber: nullableString,
                isTaxExempt: optionalBoolean,
                amountExcludingTax: { type: ['number', 'null'] },
                taxLabel: nullableString,
                taxRate: { type: ['number', 'null'] },
                active: optionalBoolean,
                generateInitial: optionalBoolean,
                idempotencyKey: optionalString,
            },
            required: ['title', 'currency', 'amount', 'amountType', 'repeat', 'startDate', 'isPersonal', 'billable', 'isTaxExempt'],
            additionalProperties: false,
        },
    },
    {
        name: 'update_expense_recurrence',
        description: 'Update a recurring expense template for future generated expenses without mutating already-created expenses.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                recurrenceId: optionalString,
                updates: { type: 'object', additionalProperties: true },
            },
            required: ['recurrenceId', 'updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'pause_expense_recurrence',
        description: 'Pause a recurring expense template without deleting generated expenses.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                recurrenceId: optionalString,
            },
            required: ['recurrenceId'],
            additionalProperties: false,
        },
    },
    {
        name: 'resume_expense_recurrence',
        description: 'Resume a paused recurring expense template without changing already-generated expenses.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                recurrenceId: optionalString,
            },
            required: ['recurrenceId'],
            additionalProperties: false,
        },
    },
    {
        name: 'delete_expense_recurrence',
        description: 'Delete one recurring expense template after explicit command confirmation and visible browser approval without deleting generated expenses.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                recurrenceId: optionalString,
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['recurrenceId', 'confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'mark_expense_paid',
        description: 'Mark an expense paid using existing TaskTime payment snapshot behavior.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                expenseId: optionalString,
                amount: optionalNumber,
                paidOn: nullableString,
                paidBy: nullableString,
            },
            required: ['expenseId'],
            additionalProperties: false,
        },
    },
    {
        name: 'mark_expense_unpaid',
        description: 'Mark an expense unpaid.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                expenseId: optionalString,
            },
            required: ['expenseId'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_tax_return_periods',
        description: 'List tax return periods used by Reports tax-claim workflows.',
        scopes: ['read'],
        inputSchema: emptySchema,
    },
    {
        name: 'create_tax_return_period',
        description: 'Create a tax return period for VAT, income-tax, sales-tax, or other reporting workflows.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                id: optionalString,
                title: optionalString,
                type: { type: 'string', enum: ['vat', 'income-tax', 'sales-tax', 'other'] },
                startDate: optionalString,
                endDate: optionalString,
                businessInfoId: nullableString,
                status: { type: 'string', enum: ['draft', 'filed', 'paid'] },
                filedAt: { type: ['number', 'null'] },
                paidAt: { type: ['number', 'null'] },
                notes: nullableString,
                idempotencyKey: optionalString,
            },
            required: ['title', 'type', 'startDate', 'endDate'],
            additionalProperties: false,
        },
    },
    {
        name: 'update_tax_return_period',
        description: 'Update non-status tax return period metadata such as title, dates, business profile, and notes. Filing/payment status changes use explicit status tools.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taxReturnPeriodId: optionalString,
                updates: {
                    type: 'object',
                    additionalProperties: true,
                },
            },
            required: ['taxReturnPeriodId', 'updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'mark_tax_return_period_filed',
        description: 'Mark a tax return period filed after explicit confirmation and browser approval.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taxReturnPeriodId: optionalString,
                filedAt: optionalNumber,
                confirmFiled: optionalBoolean,
            },
            required: ['taxReturnPeriodId', 'confirmFiled'],
            additionalProperties: false,
        },
    },
    {
        name: 'mark_tax_return_period_paid',
        description: 'Mark a tax return period paid after explicit confirmation and browser approval.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                taxReturnPeriodId: optionalString,
                filedAt: optionalNumber,
                paidAt: optionalNumber,
                confirmPaid: optionalBoolean,
            },
            required: ['taxReturnPeriodId', 'confirmPaid'],
            additionalProperties: false,
        },
    },
    {
        name: 'mark_expenses_tax_claimed',
        description: 'Mark selected expenses as tax claimed against an existing tax return period after explicit confirmation and browser approval.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                expenseIds: {
                    type: 'array',
                    items: optionalString,
                    minItems: 1,
                },
                taxReturnPeriodId: optionalString,
                confirmClaim: optionalBoolean,
            },
            required: ['expenseIds', 'taxReturnPeriodId', 'confirmClaim'],
            additionalProperties: false,
        },
    },
    {
        name: 'mark_expenses_tax_unclaimed',
        description: 'Clear tax claim status and period links from selected expenses after explicit confirmation and browser approval.',
        scopes: ['write'],
        inputSchema: {
            type: 'object',
            properties: {
                expenseIds: {
                    type: 'array',
                    items: optionalString,
                    minItems: 1,
                },
                confirmUnclaim: optionalBoolean,
            },
            required: ['expenseIds', 'confirmUnclaim'],
            additionalProperties: false,
        },
    },
    {
        name: 'list_invoices',
        description: 'List invoices as bounded summary records, optionally scoped by client, project, or status.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: nullableString,
                projectId: nullableString,
                status: { enum: ['draft', 'sent', 'paid', 'overdue'] },
                limit: optionalNumber,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'preview_invoice_from_unbilled_work',
        description: 'Calculate a read-only invoice preview from unbilled project work. This does not create invoices, mark billing state, or advance invoice numbering.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
                billingPeriodStart: optionalString,
                billingPeriodEnd: optionalString,
                includeClientLevelExpenses: optionalBoolean,
                exchangeRates: { type: ['object', 'null'] },
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'create_invoice_draft',
        description: 'Create a draft invoice from unbilled project work. This creates only a draft invoice record and does not mark entries or expenses billed, update task billing cutoffs, update project invoice references, or advance invoice numbering.',
        scopes: ['read', 'write'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
                clientId: optionalString,
                invoiceNumber: optionalString,
                invoiceDate: optionalString,
                dueDate: nullableString,
                templateId: nullableString,
                businessInfoId: nullableString,
                paymentMethodId: nullableString,
                notes: optionalString,
                billingPeriodStart: optionalString,
                billingPeriodEnd: optionalString,
                includeClientLevelExpenses: optionalBoolean,
                exchangeRates: { type: ['object', 'null'] },
                idempotencyKey: optionalString,
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'update_invoice_draft',
        description: 'Edit allowed metadata, line items, totals, and UI composition fields on an existing draft invoice. This does not mark billing state, update task billing cutoffs, link projects, or advance invoice numbering.',
        scopes: ['read', 'write'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceId: optionalString,
                updates: {
                    type: 'object',
                    additionalProperties: true,
                },
            },
            required: ['invoiceId', 'updates'],
            additionalProperties: false,
        },
    },
    {
        name: 'finalize_invoice',
        description: 'Finalize an agent-created draft invoice after explicit confirmation. This marks matching active time entries and expenses billed, updates task billing cutoffs, links the invoice to the project, advances invoice sequence state, and changes the invoice from draft to sent.',
        scopes: ['read', 'write', 'billing'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceId: optionalString,
                confirmFinalize: optionalBoolean,
                finalizedAt: optionalNumber,
                idempotencyKey: optionalString,
            },
            required: ['invoiceId', 'confirmFinalize'],
            additionalProperties: false,
        },
    },
    {
        name: 'mark_invoice_paid',
        description: 'Mark an invoice paid after explicit confirmation. Cross-currency invoices require exchange rates so TaskTime can store the existing payment currency snapshot.',
        scopes: ['read', 'write', 'billing'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceId: optionalString,
                confirmPaid: optionalBoolean,
                paidAt: optionalNumber,
                exchangeRates: { type: ['object', 'null'] },
                idempotencyKey: optionalString,
            },
            required: ['invoiceId', 'confirmPaid'],
            additionalProperties: false,
        },
    },
    {
        name: 'mark_invoice_unpaid',
        description: 'Mark an invoice unpaid after explicit confirmation, matching TaskTime UI status fallback behavior.',
        scopes: ['read', 'write', 'billing'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceId: optionalString,
                confirmUnpaid: optionalBoolean,
                referenceAt: optionalNumber,
                idempotencyKey: optionalString,
            },
            required: ['invoiceId', 'confirmUnpaid'],
            additionalProperties: false,
        },
    },
    {
        name: 'undo_latest_invoice',
        description: 'Undo the latest unpaid invoice after explicit confirmation text matching the invoice number. Restores billed time entries, invoice adjustments, quoted flat amounts, linked expenses, project invoice references, task cutoffs, and sequence state when safe.',
        scopes: ['read', 'write', 'billing'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceId: optionalString,
                confirmUndo: optionalBoolean,
                confirmationText: optionalString,
                undoneAt: optionalNumber,
                idempotencyKey: optionalString,
            },
            required: ['invoiceId', 'confirmUndo', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'export_invoice_pdf',
        description: 'Generate and download an invoice PDF in the paired browser app session. The bridge returns status metadata only, not PDF bytes.',
        scopes: ['read', 'export'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceId: optionalString,
                filename: optionalString,
            },
            required: ['invoiceId'],
            additionalProperties: false,
        },
    },
    {
        name: 'preview_project_quote',
        description: 'Build a non-persistent quote document from project estimates without creating invoices or billing side effects.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: projectQuoteBaseProperties,
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'export_project_quote_pdf',
        description: 'Generate and download a non-persistent project quote PDF in the paired browser app session. The bridge returns status metadata only, not PDF bytes.',
        scopes: ['read', 'export'],
        inputSchema: {
            type: 'object',
            properties: {
                ...projectQuoteBaseProperties,
                filename: optionalString,
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'preview_project_quote_email',
        description: 'Resolve project quote email recipient, template fields, body, and attachment title without sending email or mutating data.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: projectQuoteEmailProperties,
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'send_project_quote_email',
        description: 'Send a non-persistent project quote email through the paired browser app session after explicit confirmation and browser approval. Generates the quote PDF in-browser and does not update invoice records.',
        scopes: ['read', 'email'],
        inputSchema: {
            type: 'object',
            properties: {
                ...projectQuoteEmailProperties,
                confirmSend: optionalBoolean,
                idempotencyKey: optionalString,
            },
            required: ['projectId', 'confirmSend'],
            additionalProperties: false,
        },
    },
    {
        name: 'preview_invoice_email',
        description: 'Resolve invoice email recipient, template, subject, body, and attachment filename without sending email or mutating invoice state.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceId: optionalString,
                sendType: { type: 'string', enum: ['invoice', 'reminder', 'quote'] },
                templateId: nullableString,
                to: nullableString,
                fromName: nullableString,
                replyTo: nullableString,
                subject: nullableString,
                body: nullableString,
                attachmentTitle: nullableString,
                forwardToSelf: optionalBoolean,
            },
            required: ['invoiceId'],
            additionalProperties: false,
        },
    },
    {
        name: 'send_invoice_email',
        description: 'Send an invoice, reminder, or quote email through the paired browser app session after explicit confirmation and browser approval. Generates the PDF in-browser and updates invoice sent metadata when applicable.',
        scopes: ['read', 'write', 'email'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceId: optionalString,
                sendType: { type: 'string', enum: ['invoice', 'reminder', 'quote'] },
                templateId: nullableString,
                to: nullableString,
                fromName: nullableString,
                replyTo: nullableString,
                subject: nullableString,
                body: nullableString,
                attachmentTitle: nullableString,
                forwardToSelf: optionalBoolean,
                confirmSend: optionalBoolean,
                idempotencyKey: optionalString,
            },
            required: ['invoiceId', 'confirmSend'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_dashboard_summary',
        description: 'Get a bounded summary of current TaskTime work, timers, unbilled time, expenses, and draft invoices.',
        scopes: ['read'],
        inputSchema: emptySchema,
    },
    {
        name: 'get_project_overview',
        description: 'Get a bounded project summary with task, timer, unbilled time, expense, and invoice counts.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_client_overview',
        description: 'Get a bounded client summary with project, expense, and invoice totals.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: optionalString,
            },
            required: ['clientId'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_report_summary',
        description: 'Get read-only Reports-page summaries for filtered invoices, expenses, hours, tax, outstanding, statement, work-summary, and to-invoice sections.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                section: { type: 'string', enum: ['overview', 'monthly', 'statement', 'work-summary', 'tax', 'invoices', 'outstanding', 'expenses', 'hours', 'to-invoice'] },
                period: { type: 'string', enum: ['this-month', 'last-month', 'this-quarter', 'last-quarter', 'this-year', 'last-year', 'custom'] },
                customStart: nullableString,
                customEnd: nullableString,
                businessId: nullableString,
                clientId: nullableString,
                projectId: nullableString,
                categoryId: nullableString,
                invoiceStatus: { type: 'string', enum: ['all', 'non-draft', 'paid', 'unpaid', 'overdue', 'draft'] },
                expenseStatus: { type: 'string', enum: ['all', 'paid', 'unpaid', 'claimed', 'unclaimed', 'excluded'] },
                incomeDateBasis: { type: 'string', enum: ['invoice-date', 'paid-date'] },
                expenseDateBasis: { type: 'string', enum: ['expense-date', 'paid-date'] },
                includeRows: optionalBoolean,
                rowLimit: optionalNumber,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'export_report_csv',
        description: 'Generate and download a CSV export for a Reports-page section in the paired browser app session without returning file contents through the bridge.',
        scopes: ['read', 'export'],
        inputSchema: {
            type: 'object',
            properties: {
                section: { type: 'string', enum: ['overview', 'monthly', 'statement', 'work-summary', 'tax', 'invoices', 'outstanding', 'expenses', 'hours', 'to-invoice'] },
                period: { type: 'string', enum: ['this-month', 'last-month', 'this-quarter', 'last-quarter', 'this-year', 'last-year', 'custom'] },
                customStart: nullableString,
                customEnd: nullableString,
                businessId: nullableString,
                clientId: nullableString,
                projectId: nullableString,
                categoryId: nullableString,
                invoiceStatus: { type: 'string', enum: ['all', 'non-draft', 'paid', 'unpaid', 'overdue', 'draft'] },
                expenseStatus: { type: 'string', enum: ['all', 'paid', 'unpaid', 'claimed', 'unclaimed', 'excluded'] },
                incomeDateBasis: { type: 'string', enum: ['invoice-date', 'paid-date'] },
                expenseDateBasis: { type: 'string', enum: ['expense-date', 'paid-date'] },
                rowLimit: optionalNumber,
                filename: optionalString,
            },
            required: ['section'],
            additionalProperties: false,
        },
    },
    {
        name: 'export_report_pdf',
        description: 'Generate and download a PDF export for Reports-page sections that have existing UI PDF exporters, without returning file contents through the bridge.',
        scopes: ['read', 'export'],
        inputSchema: {
            type: 'object',
            properties: {
                section: { type: 'string', enum: ['overview', 'monthly', 'statement', 'work-summary', 'invoices', 'outstanding', 'expenses'] },
                period: { type: 'string', enum: ['this-month', 'last-month', 'this-quarter', 'last-quarter', 'this-year', 'last-year', 'custom'] },
                customStart: nullableString,
                customEnd: nullableString,
                businessId: nullableString,
                clientId: nullableString,
                projectId: nullableString,
                categoryId: nullableString,
                invoiceStatus: { type: 'string', enum: ['all', 'non-draft', 'paid', 'unpaid', 'overdue', 'draft'] },
                expenseStatus: { type: 'string', enum: ['all', 'paid', 'unpaid', 'claimed', 'unclaimed', 'excluded'] },
                incomeDateBasis: { type: 'string', enum: ['invoice-date', 'paid-date'] },
                expenseDateBasis: { type: 'string', enum: ['expense-date', 'paid-date'] },
                rowLimit: optionalNumber,
                filename: optionalString,
            },
            required: ['section'],
            additionalProperties: false,
        },
    },
    {
        name: 'export_accountant_pack',
        description: 'Generate and download the Reports accountant pack ZIP in the paired browser app session without returning file contents through the bridge.',
        scopes: ['read', 'export'],
        inputSchema: {
            type: 'object',
            properties: {
                period: { type: 'string', enum: ['this-month', 'last-month', 'this-quarter', 'last-quarter', 'this-year', 'last-year', 'custom'] },
                customStart: nullableString,
                customEnd: nullableString,
                businessId: nullableString,
                clientId: nullableString,
                projectId: nullableString,
                categoryId: nullableString,
                invoiceStatus: { type: 'string', enum: ['all', 'non-draft', 'paid', 'unpaid', 'overdue', 'draft'] },
                expenseStatus: { type: 'string', enum: ['all', 'paid', 'unpaid', 'claimed', 'unclaimed', 'excluded'] },
                incomeDateBasis: { type: 'string', enum: ['invoice-date', 'paid-date'] },
                expenseDateBasis: { type: 'string', enum: ['expense-date', 'paid-date'] },
                rowLimit: optionalNumber,
                filename: optionalString,
                includeInvoicePdfs: optionalBoolean,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'export_backup_json',
        description: 'Export all TaskTime backup data as a browser-downloaded JSON file without returning backup contents through the bridge.',
        scopes: ['read', 'export'],
        inputSchema: {
            type: 'object',
            properties: {
                filename: optionalString,
                exportDate: optionalString,
                refreshFromCloud: optionalBoolean,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'list_drive_backups',
        description: 'List TaskTime backup snapshots available in Google Drive without returning backup contents.',
        scopes: ['read', 'export'],
        inputSchema: emptySchema,
    },
    {
        name: 'create_drive_backup',
        description: 'Create a TaskTime backup snapshot in Google Drive using the existing backup manager.',
        scopes: ['read', 'export'],
        inputSchema: emptySchema,
    },
    {
        name: 'download_drive_backup_json',
        description: 'Download a selected Google Drive backup as a browser JSON file without returning backup contents through the bridge.',
        scopes: ['read', 'export'],
        inputSchema: {
            type: 'object',
            properties: {
                backupId: optionalString,
                filename: optionalString,
            },
            required: ['backupId'],
            additionalProperties: false,
        },
    },
    {
        name: 'preview_backup_import_json',
        description: 'Validate a TaskTime backup JSON payload and return version/count metadata without changing current data.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                backupJson: optionalString,
            },
            required: ['backupJson'],
            additionalProperties: false,
        },
    },
    {
        name: 'restore_backup_json',
        description: 'Replace current local TaskTime data with a validated backup JSON payload after explicit confirmation and browser approval. Requires confirmationText to equal RESTORE.',
        scopes: ['read', 'write', 'export'],
        inputSchema: {
            type: 'object',
            properties: {
                backupJson: optionalString,
                confirmRestore: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['backupJson', 'confirmRestore', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'restore_drive_backup',
        description: 'Replace current local TaskTime data from a selected Google Drive backup after explicit confirmation and browser approval. Requires confirmationText to equal RESTORE.',
        scopes: ['read', 'write', 'export'],
        inputSchema: {
            type: 'object',
            properties: {
                backupId: optionalString,
                confirmRestore: optionalBoolean,
                confirmationText: optionalString,
            },
            required: ['backupId', 'confirmRestore', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'get_sync_status',
        description: 'Read current Google Drive sync status, auto-sync mode, pending changes, and backup preference metadata.',
        scopes: ['read'],
        inputSchema: emptySchema,
    },
    {
        name: 'update_sync_settings',
        description: 'Update explicit Google Drive sync and backup preferences. Backup mode requires confirmBackupMode: true. Optional runSync triggers Sync Now after saving.',
        scopes: ['read', 'write', 'export'],
        inputSchema: {
            type: 'object',
            properties: {
                autoSyncEnabled: optionalBoolean,
                autoSyncMode: { type: 'string', enum: ['backup', 'sync'] },
                backupEnabled: optionalBoolean,
                backupFrequencyHours: optionalNumber,
                confirmBackupMode: optionalBoolean,
                runSync: optionalBoolean,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'delete_all_account_data',
        description: 'Delete all local TaskTime data and, when Drive is connected, wipe Drive sync data and backups after explicit confirmation and browser approval. Requires confirmationText to equal DELETE ALL DATA.',
        scopes: ['read', 'write', 'export'],
        inputSchema: {
            type: 'object',
            properties: {
                confirmDelete: optionalBoolean,
                confirmationText: optionalString,
                includeDriveData: optionalBoolean,
            },
            required: ['confirmDelete', 'confirmationText'],
            additionalProperties: false,
        },
    },
    {
        name: 'find_unbilled_time',
        description: 'Find recent unbilled time entries, optionally scoped by project or task.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: nullableString,
                taskId: nullableString,
                limit: optionalNumber,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'list_recent_entries',
        description: 'List recent time entries as bounded summary records.',
        scopes: ['read'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: nullableString,
                taskId: nullableString,
                limit: optionalNumber,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'open_dashboard_view',
        description: 'Open the TaskTime dashboard route in the paired app session.',
        scopes: ['navigation'],
        inputSchema: emptySchema,
    },
    {
        name: 'open_project_view',
        description: 'Open a project view in the paired TaskTime app session after validating the project exists.',
        scopes: ['navigation'],
        inputSchema: {
            type: 'object',
            properties: {
                projectId: optionalString,
            },
            required: ['projectId'],
            additionalProperties: false,
        },
    },
    {
        name: 'open_client_view',
        description: 'Open a client view in the paired TaskTime app session after validating the client exists.',
        scopes: ['navigation'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: optionalString,
            },
            required: ['clientId'],
            additionalProperties: false,
        },
    },
    {
        name: 'open_invoice_view',
        description: 'Open the invoices route, optionally focused on an existing invoice.',
        scopes: ['navigation'],
        inputSchema: {
            type: 'object',
            properties: {
                invoiceId: optionalString,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'open_expenses_view',
        description: 'Open the expenses route, optionally scoped by client or project.',
        scopes: ['navigation'],
        inputSchema: {
            type: 'object',
            properties: {
                clientId: optionalString,
                projectId: optionalString,
            },
            additionalProperties: false,
        },
    },
    {
        name: 'open_reports_view',
        description: 'Open the TaskTime reports route in the paired app session.',
        scopes: ['navigation'],
        inputSchema: emptySchema,
    },
    {
        name: 'focus_running_timer',
        description: 'Focus the TaskTime app on a running timer by timer key or task ID.',
        scopes: ['navigation'],
        inputSchema: {
            type: 'object',
            properties: {
                timerKey: optionalString,
                taskId: optionalString,
            },
            additionalProperties: false,
        },
    },
];

export function listMcpToolDefinitions(scopes: Set<AgentPermissionScope>): McpToolDefinition[] {
    return MCP_TOOL_DEFINITIONS
        .filter((tool) => tool.scopes.every((scope) => scopes.has(scope)))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function getMcpToolDefinition(name: string): McpToolDefinition | null {
    return MCP_TOOL_DEFINITIONS.find((tool) => tool.name === name) ?? null;
}
