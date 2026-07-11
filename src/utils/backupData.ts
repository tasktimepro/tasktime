import type {
    BusinessBrandAsset,
    BusinessInfo,
    Client,
    DailyGoal,
    EmailTemplate,
    Expense,
    ExpenseCategory,
    ExpenseRecurrence,
    Invoice,
    InvoiceTemplate,
    PaymentMethod,
    PlannerAttachment,
    Preferences,
    Project,
    Task,
    TaxReturnPeriod,
    TimeEntry,
} from '@/stores/yjs/types';
import { validateCollectionEntity, validatePreferencesRecord } from '@/stores/yjs/validation';
import { normalizeInvoiceRecord } from '@/utils/invoiceUtils';

export const BACKUP_VERSION = '1.4';
export const SUPPORTED_BACKUP_IMPORT_VERSIONS = Array.from(new Set(['1.0', '1.1', '1.3', BACKUP_VERSION]));

export interface BackupPayload {
    version: string;
    exportDate: string;
    backupType?: 'automatic' | 'manual';
    projects: Project[];
    tasks: Task[];
    timeEntries: TimeEntry[];
    invoices: Invoice[];
    paymentMethods: PaymentMethod[];
    expenseCategories?: ExpenseCategory[];
    taxReturnPeriods?: TaxReturnPeriod[];
    businessInfos: BusinessInfo[];
    businessBrandAssets: BusinessBrandAsset[];
    clients: Client[];
    invoiceTemplates: InvoiceTemplate[];
    emailTemplates: EmailTemplate[];
    expenses: Expense[];
    expenseRecurrences: ExpenseRecurrence[];
    dailyGoals: DailyGoal[];
    plannerAttachments: PlannerAttachment[];
    preferences: Preferences;
}

export type BackupImportPayload = Omit<BackupPayload, 'version' | 'exportDate' | 'backupType'>;

export type NormalizedBackupImportPayload = BackupImportPayload & {
    version?: string;
    exportDate?: string;
    backupType?: 'automatic' | 'manual';
};

type BackupPayloadInput = Omit<BackupPayload, 'version' | 'exportDate'> & {
    exportDate?: string;
};

export function createBackupPayload({
    exportDate = new Date().toISOString(),
    backupType,
    projects,
    tasks,
    timeEntries,
    invoices,
    paymentMethods,
    expenseCategories,
    taxReturnPeriods,
    businessInfos,
    businessBrandAssets,
    clients,
    invoiceTemplates,
    emailTemplates,
    expenses,
    expenseRecurrences,
    dailyGoals,
    plannerAttachments,
    preferences,
}: BackupPayloadInput): BackupPayload {
    return {
        version: BACKUP_VERSION,
        exportDate,
        ...(backupType ? { backupType } : {}),
        projects,
        tasks,
        timeEntries,
        invoices,
        paymentMethods,
        expenseCategories,
        taxReturnPeriods,
        businessInfos,
        businessBrandAssets,
        clients,
        invoiceTemplates,
        emailTemplates,
        expenses,
        expenseRecurrences,
        dailyGoals,
        plannerAttachments,
        preferences,
    };
}

function assertArray(value: unknown, field: string): unknown[] {
    if (!Array.isArray(value)) {
        throw new Error(`Invalid data format: ${field} must be an array`);
    }

    return value;
}

function assertOptionalArray(value: unknown, field: string): unknown[] {
    return value === undefined ? [] : assertArray(value, field);
}

function assertObject(value: unknown, field: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Invalid data format: ${field} must be an object`);
    }

    return value as Record<string, unknown>;
}

function assertEntityId(entity: unknown, collection: string): string {
    if (!entity || typeof entity !== 'object') {
        throw new Error(`Invalid ${collection}: expected object`);
    }

    const id = (entity as { id?: unknown }).id;

    if (!id || typeof id !== 'string') {
        throw new Error(`Invalid ${collection}: missing or non-string id`);
    }

    return id;
}

function assertEntityTitle(entity: unknown, collection: string, id: string): void {
    const title = (entity as { title?: unknown }).title;

    if (!title || typeof title !== 'string') {
        throw new Error(`Invalid ${collection} "${id}": missing or non-string title`);
    }
}

function collectUniqueIds(entities: unknown[], collection: string, requireTitle = false): Set<string> {
    const ids = new Set<string>();

    for (const entity of entities) {
        const id = assertEntityId(entity, collection);

        if (requireTitle) {
            assertEntityTitle(entity, collection, id);
        }

        if (ids.has(id)) {
            throw new Error(`Duplicate ${collection} id: ${id}`);
        }

        ids.add(id);
    }

    return ids;
}

export function parseBackupImportJson(backupJson: string): NormalizedBackupImportPayload {
    let parsed: Record<string, unknown>;

    try {
        parsed = JSON.parse(backupJson);
    } catch {
        throw new Error('Backup JSON could not be parsed.');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Backup JSON must be an object.');
    }

    if (parsed.version && (typeof parsed.version !== 'string' || !SUPPORTED_BACKUP_IMPORT_VERSIONS.includes(parsed.version))) {
        throw new Error(`Unsupported export version "${String(parsed.version)}". Supported: ${SUPPORTED_BACKUP_IMPORT_VERSIONS.join(', ')}. You may need to update TaskTime Pro.`);
    }

    const projects = assertArray(parsed.projects, 'projects') as Project[];
    const tasks = assertOptionalArray(parsed.tasks, 'tasks') as Task[];
    const timeEntries = assertOptionalArray(parsed.timeEntries, 'timeEntries') as TimeEntry[];
    const invoices = assertOptionalArray(parsed.invoices, 'invoices') as Invoice[];
    const paymentMethods = assertOptionalArray(parsed.paymentMethods, 'paymentMethods') as PaymentMethod[];
    const expenseCategories = assertOptionalArray(parsed.expenseCategories, 'expenseCategories') as ExpenseCategory[];
    const taxReturnPeriods = assertOptionalArray(parsed.taxReturnPeriods, 'taxReturnPeriods') as TaxReturnPeriod[];
    const businessInfos = assertOptionalArray(parsed.businessInfos, 'businessInfos') as BusinessInfo[];
    const businessBrandAssets = assertOptionalArray(parsed.businessBrandAssets, 'businessBrandAssets') as BusinessBrandAsset[];
    const clients = assertOptionalArray(parsed.clients, 'clients') as Client[];
    const invoiceTemplates = assertOptionalArray(parsed.invoiceTemplates, 'invoiceTemplates') as InvoiceTemplate[];
    const emailTemplates = assertOptionalArray(parsed.emailTemplates, 'emailTemplates') as EmailTemplate[];
    const expenses = assertOptionalArray(parsed.expenses, 'expenses') as Expense[];
    const expenseRecurrences = assertOptionalArray(parsed.expenseRecurrences, 'expenseRecurrences') as ExpenseRecurrence[];
    const dailyGoals = assertOptionalArray(parsed.dailyGoals, 'dailyGoals') as DailyGoal[];
    const plannerAttachments = assertOptionalArray(parsed.plannerAttachments, 'plannerAttachments') as PlannerAttachment[];
    const preferences = parsed.preferences === undefined ? {} : assertObject(parsed.preferences, 'preferences') as Preferences;

    return validateBackupImportPayload({
        version: typeof parsed.version === 'string' ? parsed.version : undefined,
        exportDate: typeof parsed.exportDate === 'string' ? parsed.exportDate : undefined,
        backupType: parsed.backupType === 'automatic' || parsed.backupType === 'manual' ? parsed.backupType : undefined,
        projects,
        tasks,
        timeEntries,
        invoices,
        paymentMethods,
        expenseCategories,
        taxReturnPeriods,
        businessInfos,
        businessBrandAssets,
        clients,
        invoiceTemplates,
        emailTemplates,
        expenses,
        expenseRecurrences,
        dailyGoals,
        plannerAttachments,
        preferences,
    });
}

export function validateBackupImportPayload(data: NormalizedBackupImportPayload): NormalizedBackupImportPayload {
    const projects = data.projects || [];
    const tasks = data.tasks || [];
    const timeEntries = data.timeEntries || [];
    const invoices = data.invoices || [];
    const paymentMethods = data.paymentMethods || [];
    const expenseCategories = data.expenseCategories || [];
    const taxReturnPeriods = data.taxReturnPeriods || [];
    const businessInfos = data.businessInfos || [];
    const businessBrandAssets = data.businessBrandAssets || [];
    const clients = data.clients || [];
    const invoiceTemplates = data.invoiceTemplates || [];
    const emailTemplates = data.emailTemplates || [];
    const expenses = data.expenses || [];
    const expenseRecurrences = data.expenseRecurrences || [];
    const dailyGoals = data.dailyGoals || [];
    const plannerAttachments = data.plannerAttachments || [];
    const preferences = data.preferences || {};

    const projectIds = collectUniqueIds(projects, 'project', true);
    const taskIds = collectUniqueIds(tasks, 'task', true);
    const invoiceIds = collectUniqueIds(invoices, 'invoice');

    collectUniqueIds(paymentMethods, 'payment method');
    collectUniqueIds(expenseCategories, 'expense category');
    collectUniqueIds(taxReturnPeriods, 'tax return period');
    collectUniqueIds(businessInfos, 'business info');
    collectUniqueIds(businessBrandAssets, 'business brand asset');
    collectUniqueIds(clients, 'client');
    collectUniqueIds(invoiceTemplates, 'invoice template');
    collectUniqueIds(emailTemplates, 'email template');
    collectUniqueIds(expenses, 'expense');
    collectUniqueIds(expenseRecurrences, 'expense recurrence');
    collectUniqueIds(dailyGoals, 'daily goal');
    collectUniqueIds(plannerAttachments, 'planner attachment');

    for (const task of tasks) {
        if (task.parentTaskId && !taskIds.has(task.parentTaskId)) {
            throw new Error(`Task "${task.id}" references non-existent parent task "${task.parentTaskId}"`);
        }

        if (task.projectId && !projectIds.has(task.projectId)) {
            throw new Error(`Task "${task.id}" references non-existent project "${task.projectId}"`);
        }
    }

    for (const entry of timeEntries) {
        assertEntityId(entry, 'time entry');

        if (typeof entry.start !== 'number' || typeof entry.end !== 'number') {
            throw new Error(`Invalid time entry "${entry.id}": start and end must be numbers`);
        }

        if (entry.start > entry.end) {
            throw new Error(`Invalid time entry "${entry.id}": start time is after end time`);
        }

        if (entry.taskId && !taskIds.has(entry.taskId)) {
            throw new Error(`Time entry "${entry.id}" references non-existent task "${entry.taskId}"`);
        }
    }

    for (const project of projects) {
        if (project.invoiceIds && Array.isArray(project.invoiceIds)) {
            for (const invoiceId of project.invoiceIds) {
                if (!invoiceIds.has(invoiceId)) {
                    throw new Error(`Project "${project.id}" references non-existent invoice "${invoiceId}"`);
                }
            }
        }
    }

    return {
        ...data,
        projects: projects.map((project) => validateCollectionEntity<Project>('projects', project, `backup project ${project.id}`)),
        tasks: tasks.map((task) => validateCollectionEntity<Task>('tasks', task, `backup task ${task.id}`)),
        timeEntries: timeEntries.map((entry) => validateCollectionEntity<TimeEntry>('timeEntries', entry, `backup time entry ${entry.id}`)),
        invoices: invoices.map((invoice) => {
            const normalized = normalizeInvoiceRecord(invoice);
            return validateCollectionEntity<Invoice>('invoices', normalized, `backup invoice ${invoice.id}`);
        }),
        paymentMethods: paymentMethods.map((method) => validateCollectionEntity<PaymentMethod>('paymentMethods', method, `backup payment method ${method.id}`)),
        expenseCategories: expenseCategories.map((category) => validateCollectionEntity<ExpenseCategory>('expenseCategories', category, `backup expense category ${category.id}`)),
        taxReturnPeriods: taxReturnPeriods.map((period) => validateCollectionEntity<TaxReturnPeriod>('taxReturnPeriods', period, `backup tax return period ${period.id}`)),
        businessInfos: businessInfos.map((info) => validateCollectionEntity<BusinessInfo>('businessInfos', info, `backup business info ${info.id}`)),
        businessBrandAssets: businessBrandAssets.map((asset) => validateCollectionEntity<BusinessBrandAsset>('businessBrandAssets', asset, `backup business brand asset ${asset.id}`)),
        clients: clients.map((client) => validateCollectionEntity<Client>('clients', client, `backup client ${client.id}`)),
        invoiceTemplates: invoiceTemplates.map((template) => validateCollectionEntity<InvoiceTemplate>('invoiceTemplates', template, `backup invoice template ${template.id}`)),
        emailTemplates: emailTemplates.map((template) => validateCollectionEntity<EmailTemplate>('emailTemplates', template, `backup email template ${template.id}`)),
        expenses: expenses.map((expense) => validateCollectionEntity<Expense>('expenses', expense, `backup expense ${expense.id}`)),
        expenseRecurrences: expenseRecurrences.map((recurrence) => validateCollectionEntity<ExpenseRecurrence>('expenseRecurrences', recurrence, `backup expense recurrence ${recurrence.id}`)),
        dailyGoals: dailyGoals.map((goal) => validateCollectionEntity<DailyGoal>('dailyGoals', goal, `backup daily goal ${goal.id}`)),
        plannerAttachments: plannerAttachments.map((attachment) => validateCollectionEntity<PlannerAttachment>('plannerAttachments', attachment, `backup planner attachment ${attachment.id}`)),
        preferences: validatePreferencesRecord(preferences as Record<string, unknown>, 'backup preferences'),
    };
}

export function getBackupImportCounts(data: BackupImportPayload) {
    return {
        businessBrandAssets: data.businessBrandAssets?.length || 0,
        businessInfos: data.businessInfos?.length || 0,
        clients: data.clients?.length || 0,
        dailyGoals: data.dailyGoals?.length || 0,
        emailTemplates: data.emailTemplates?.length || 0,
        expenseCategories: data.expenseCategories?.length || 0,
        expenseRecurrences: data.expenseRecurrences?.length || 0,
        expenses: data.expenses?.length || 0,
        invoices: data.invoices?.length || 0,
        invoiceTemplates: data.invoiceTemplates?.length || 0,
        paymentMethods: data.paymentMethods?.length || 0,
        plannerAttachments: data.plannerAttachments?.length || 0,
        projects: data.projects?.length || 0,
        tasks: data.tasks?.length || 0,
        taxReturnPeriods: data.taxReturnPeriods?.length || 0,
        timeEntries: data.timeEntries?.length || 0,
    };
}
