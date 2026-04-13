import * as Y from 'yjs';
import { z } from 'zod';
import { collectEntities, readEntity } from './entityUtils';
import type {
    BusinessInfo,
    Client,
    DailyGoal,
    DocName,
    Expense,
    ExpenseRecurrence,
    Invoice,
    InvoiceTemplate,
    MultiTimerState,
    PaymentMethod,
    PlannerAttachment,
    Preferences,
    Project,
    Task,
    TimeEntry,
} from './types';
import type { YjsDocManager } from './YjsDocManager';

const STORAGE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const storageDateSchema = z.string().regex(STORAGE_DATE_REGEX);
const finiteNumberSchema = z.number().finite();
const integerNumberSchema = z.number().int();
const nonNegativeNumberSchema = z.number().finite().min(0);
const nonEmptyStringSchema = z.string().trim().min(1);
const optionalNullableIdSchema = z.string().trim().min(1).nullable().optional();

const recurringConfigSchema = z.object({
    type: z.enum(['weekly', 'monthly', 'yearly']),
    weeklyDays: z.array(z.number().int().min(0).max(6)).optional(),
    monthlyType: z.enum(['first', 'last', 'specific']).optional(),
    monthlyDay: z.number().int().min(1).max(31).optional(),
    yearlyDate: storageDateSchema.optional(),
}).passthrough();

const projectSchema = z.object({
    id: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    createdAt: finiteNumberSchema.optional(),
    updatedAt: finiteNumberSchema.optional(),
    description: z.string().optional(),
    hourlyRate: finiteNumberSchema.nullable().optional(),
    flatRate: z.boolean().optional(),
    preferredClientId: optionalNullableIdSchema,
    isPersonal: z.boolean().optional(),
    archived: z.boolean().optional(),
    archivedOnDate: storageDateSchema.nullable().optional(),
    lastBilledAt: finiteNumberSchema.nullable().optional(),
    color: z.string().nullable().optional(),
    invoiceIds: z.array(nonEmptyStringSchema).optional(),
}).passthrough() satisfies z.ZodType<Project>;

const taskSchema = z.object({
    id: nonEmptyStringSchema,
    projectId: optionalNullableIdSchema,
    parentTaskId: optionalNullableIdSchema,
    title: nonEmptyStringSchema,
    note: z.string().nullable().optional(),
    completed: z.boolean().optional(),
    archived: z.boolean().optional(),
    archivedOnDate: storageDateSchema.nullable().optional(),
    billable: z.boolean().optional(),
    billableSetByUser: z.boolean().optional(),
    lastActive: finiteNumberSchema.optional(),
    createdAt: finiteNumberSchema.optional(),
    lastBilledAt: finiteNumberSchema.nullable().optional(),
    startDate: storageDateSchema.nullable().optional(),
    recurring: recurringConfigSchema.nullable().optional(),
    promptTimeEntry: z.boolean().optional(),
    skipUntilNextRecurring: z.boolean().optional(),
    skippedOccurrenceDate: storageDateSchema.nullable().optional(),
    completedDatesByYear: z.record(z.string(), z.record(z.string(), z.array(z.number().int().min(1).max(31)))).optional(),
    completedOnDate: storageDateSchema.nullable().optional(),
}).passthrough() satisfies z.ZodType<Task>;

const timeEntrySchema = z.object({
    id: nonEmptyStringSchema,
    taskId: nonEmptyStringSchema,
    start: finiteNumberSchema,
    end: finiteNumberSchema,
    createdAt: finiteNumberSchema.optional(),
    updatedAt: finiteNumberSchema.optional(),
    note: z.string().optional(),
    source: z.string().optional(),
    billedHourlyRate: finiteNumberSchema.nullable().optional(),
    billedAt: finiteNumberSchema.nullable().optional(),
    billedInvoiceId: optionalNullableIdSchema,
}).superRefine((value: TimeEntry, ctx: z.RefinementCtx) => {
    if (value.end < value.start) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['end'],
            message: 'end must be greater than or equal to start',
        });
    }
}).passthrough() satisfies z.ZodType<TimeEntry>;

const clientSchema = z.object({
    id: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    createdAt: finiteNumberSchema.optional(),
    updatedAt: finiteNumberSchema.optional(),
    clientName: z.string().optional(),
    contactPerson: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
    registrationNumber: z.string().optional(),
    vat: z.string().optional(),
    taxNumber: z.string().optional(),
    notes: z.string().optional(),
    custom: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    disableTax: z.boolean().optional(),
    defaultHourlyRate: finiteNumberSchema.nullable().optional(),
    hourlyRate: finiteNumberSchema.nullable().optional(),
    flatRate: z.boolean().optional(),
    defaultCurrency: z.string().optional(),
    archived: z.boolean().optional(),
    archivedOnDate: storageDateSchema.nullable().optional(),
    color: z.string().nullable().optional(),
}).passthrough() satisfies z.ZodType<Client>;

const businessInfoSchema = z.object({
    id: nonEmptyStringSchema,
    title: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    businessName: z.string().trim().min(1).optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
    registrationNumber: z.string().optional(),
    vat: z.string().optional(),
    taxNumber: z.string().optional(),
    custom: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    taxId: z.string().optional(),
    logo: z.string().optional(),
    isDefault: z.boolean().optional(),
    taxEnabled: z.boolean().optional(),
    taxLabel: z.string().optional(),
    taxRate: finiteNumberSchema.optional(),
}).superRefine((value: BusinessInfo, ctx: z.RefinementCtx) => {
    if (!value.title && !value.name) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['title'],
            message: 'title or name is required',
        });
    }

    if (!value.businessName && !value.name) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['businessName'],
            message: 'businessName or name is required',
        });
    }
}).passthrough() satisfies z.ZodType<BusinessInfo>;

const invoiceItemSchema = z.object({
    description: z.string(),
    quantity: finiteNumberSchema,
    rate: finiteNumberSchema,
    amount: finiteNumberSchema,
    taskId: z.string().optional(),
    expenseId: z.string().optional(),
    supplierName: z.string().nullable().optional(),
    originalAmount: finiteNumberSchema.optional(),
    originalCurrency: z.string().optional(),
    exchangeRate: finiteNumberSchema.optional(),
}).passthrough();

const invoiceSchema = z.object({
    id: nonEmptyStringSchema,
    projectId: nonEmptyStringSchema,
    clientId: nonEmptyStringSchema,
    createdAt: finiteNumberSchema.optional(),
    updatedAt: finiteNumberSchema.optional(),
    businessInfoId: optionalNullableIdSchema,
    invoiceNumber: nonEmptyStringSchema,
    date: storageDateSchema,
    dueDate: storageDateSchema.nullable().optional(),
    status: z.enum(['draft', 'sent', 'paid', 'overdue']),
    items: z.array(invoiceItemSchema),
    subtotal: finiteNumberSchema,
    tax: finiteNumberSchema.optional(),
    taxRate: finiteNumberSchema.optional(),
    total: finiteNumberSchema,
    notes: z.string().optional(),
    paymentMethodId: optionalNullableIdSchema,
    currency: z.string().optional(),
    paidAt: finiteNumberSchema.nullable().optional(),
}).passthrough() satisfies z.ZodType<Invoice>;

const invoiceTemplateSchema = z.object({
    id: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    prefix: z.string().optional(),
    useSequentialNumbers: z.boolean().optional(),
    currentSequentialNumber: integerNumberSchema.optional(),
    defaultNotes: z.string().optional(),
    defaultTaxRate: finiteNumberSchema.optional(),
    defaultDueDays: integerNumberSchema.optional(),
    isDefault: z.boolean().optional(),
}).passthrough() satisfies z.ZodType<InvoiceTemplate>;

const paymentMethodSchema = z.object({
    id: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    fullName: z.string().optional(),
    bank: z.string().optional(),
    iban: z.string().optional(),
    swift: z.string().optional(),
    bankAddress: z.string().optional(),
    paypal: z.string().optional(),
    custom: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
    instructions: z.string().optional(),
    isDefault: z.boolean().optional(),
    createdAt: finiteNumberSchema.optional(),
    updatedAt: finiteNumberSchema.optional(),
    name: z.string().optional(),
}).passthrough() satisfies z.ZodType<PaymentMethod>;

const expenseSchema = z.object({
    id: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    note: z.string().nullable().optional(),
    date: storageDateSchema,
    supplierName: z.string().nullable().optional(),
    receiptNumber: z.string().nullable().optional(),
    currency: nonEmptyStringSchema,
    amount: finiteNumberSchema,
    paidOn: storageDateSchema.nullable().optional(),
    paidBy: z.string().nullable().optional(),
    paymentStatus: z.enum(['unpaid', 'paid']),
    paymentMode: z.enum(['manual', 'auto']).optional(),
    clientId: optionalNullableIdSchema,
    projectId: optionalNullableIdSchema,
    businessId: optionalNullableIdSchema,
    isPersonal: z.boolean(),
    billable: z.boolean(),
    billingStatus: z.enum(['unbilled', 'billed']),
    invoiceId: optionalNullableIdSchema,
    billedAt: finiteNumberSchema.nullable().optional(),
    isRecurring: z.boolean(),
    recurrenceId: optionalNullableIdSchema,
    amountType: z.enum(['fixed', 'variable']).nullable().optional(),
    taxNumber: z.string().nullable().optional(),
    isTaxExempt: z.boolean(),
    isPreview: z.boolean().optional(),
    createdAt: finiteNumberSchema.optional(),
    updatedAt: finiteNumberSchema.optional(),
}).passthrough() satisfies z.ZodType<Expense>;

const expenseRecurrenceSchema = z.object({
    id: nonEmptyStringSchema,
    title: nonEmptyStringSchema,
    note: z.string().nullable().optional(),
    supplierName: z.string().nullable().optional(),
    paidBy: z.string().nullable().optional(),
    currency: nonEmptyStringSchema,
    amount: finiteNumberSchema,
    amountType: z.enum(['fixed', 'variable']),
    paymentMode: z.enum(['manual', 'auto']).optional(),
    repeat: z.enum(['monthly', 'yearly']),
    monthlyType: z.enum(['first', 'last', 'specific']).optional(),
    monthlyDay: integerNumberSchema.min(1).max(31).optional(),
    startDate: storageDateSchema,
    endDate: storageDateSchema.nullable().optional(),
    clientId: optionalNullableIdSchema,
    projectId: optionalNullableIdSchema,
    businessId: optionalNullableIdSchema,
    isPersonal: z.boolean(),
    billable: z.boolean(),
    taxNumber: z.string().nullable().optional(),
    isTaxExempt: z.boolean(),
    lastGeneratedDate: storageDateSchema.nullable().optional(),
    active: z.boolean(),
    createdAt: finiteNumberSchema.optional(),
    updatedAt: finiteNumberSchema.optional(),
}).passthrough() satisfies z.ZodType<ExpenseRecurrence>;

const plannerAttachmentSchema = z.object({
    id: nonEmptyStringSchema,
    type: z.enum(['client', 'project', 'task']),
    referenceId: nonEmptyStringSchema,
    mode: z.enum(['static', 'date', 'weekday']),
    date: storageDateSchema.nullable().optional(),
    weekday: integerNumberSchema.min(0).max(6).nullable().optional(),
    sortOrder: finiteNumberSchema,
    createdAt: finiteNumberSchema,
    estimatedHours: finiteNumberSchema.nullable().optional(),
}).superRefine((value: PlannerAttachment, ctx: z.RefinementCtx) => {
    if (value.mode === 'date' && !value.date) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['date'],
            message: 'date is required when mode is date',
        });
    }

    if (value.mode === 'weekday' && (value.weekday === undefined || value.weekday === null)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['weekday'],
            message: 'weekday is required when mode is weekday',
        });
    }
}).passthrough() satisfies z.ZodType<PlannerAttachment>;

const dailyGoalSchema = z.object({
    id: nonEmptyStringSchema,
    weekday: integerNumberSchema.min(0).max(6),
    targetHours: finiteNumberSchema.nullable().optional(),
    targetEarnings: finiteNumberSchema.nullable().optional(),
    createdAt: finiteNumberSchema,
    updatedAt: finiteNumberSchema.nullable().optional(),
}).passthrough() satisfies z.ZodType<DailyGoal>;

const preferencesSchema = z.object({
    currency: z.string().optional(),
    dateFormat: z.string().optional(),
    timeFormat: z.string().optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    defaultView: z.string().optional(),
    weekStartsOn: integerNumberSchema.min(0).max(6).optional(),
    autoHideTotalsOnRevisit: z.boolean().optional(),
    showCompletedTasks: z.boolean().optional(),
    defaultBillable: z.boolean().optional(),
    projectSort: z.enum(['createdAt', 'lastActive', 'name']).optional(),
    clientSort: z.enum(['createdAt', 'lastActive', 'name']).optional(),
    autoSyncEnabled: z.boolean().optional(),
    autoSyncMode: z.enum(['backup', 'sync']).optional(),
    weeklyGoalTargetHours: finiteNumberSchema.nullable().optional(),
    weeklyGoalTargetEarnings: finiteNumberSchema.nullable().optional(),
    backupEnabled: z.boolean().optional(),
    backupFrequencyHours: integerNumberSchema.min(1).optional(),
}).passthrough() satisfies z.ZodType<Preferences>;

const timerSchema = z.object({
    projectId: nonEmptyStringSchema,
    taskId: nonEmptyStringSchema,
    startTime: finiteNumberSchema,
    paused: z.boolean().optional(),
    pausedElapsedTime: nonNegativeNumberSchema.optional(),
    note: z.string().optional(),
    lastActive: finiteNumberSchema.optional(),
}).passthrough() satisfies z.ZodType<MultiTimerState>;

export const collectionSchemas = {
    projects: projectSchema,
    tasks: taskSchema,
    timeEntries: timeEntrySchema,
    clients: clientSchema,
    businessInfos: businessInfoSchema,
    invoices: invoiceSchema,
    invoiceTemplates: invoiceTemplateSchema,
    paymentMethods: paymentMethodSchema,
    expenses: expenseSchema,
    expenseRecurrences: expenseRecurrenceSchema,
    plannerAttachments: plannerAttachmentSchema,
    dailyGoals: dailyGoalSchema,
    preferences: preferencesSchema,
    timers: timerSchema,
} as const;

export type YjsCollectionName = keyof typeof collectionSchemas;

type ValidationSnapshot = {
    projects: Project[];
    tasks: Task[];
    timeEntries: TimeEntry[];
    clients: Client[];
    businessInfos: BusinessInfo[];
    invoices: Invoice[];
    invoiceTemplates: InvoiceTemplate[];
    paymentMethods: PaymentMethod[];
    expenses: Expense[];
    expenseRecurrences: ExpenseRecurrence[];
    plannerAttachments: PlannerAttachment[];
    dailyGoals: DailyGoal[];
    preferences: Preferences;
    timers: MultiTimerState[];
};

function formatIssues(error: z.ZodError): string {
    return error.issues
        .map((issue: { path: PropertyKey[]; message: string }) => {
            const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
            return `${path}: ${issue.message}`;
        })
        .join('; ');
}

export function validateCollectionEntity<T>(collectionName: YjsCollectionName, entity: unknown, context: string): T {
    const schema = collectionSchemas[collectionName];
    const parsed = schema.safeParse(entity);

    if (!parsed.success) {
        throw new Error(`Invalid ${collectionName} entity in ${context}: ${formatIssues(parsed.error)}`);
    }

    return parsed.data as T;
}

export function safeValidateCollectionEntity<T>(collectionName: YjsCollectionName, entity: unknown, context: string): T | undefined {
    try {
        return validateCollectionEntity<T>(collectionName, entity, context);
    } catch (error) {
        console.warn(`[YjsValidation] ${error instanceof Error ? error.message : error}`);
        return undefined;
    }
}

export function collectValidatedEntities<T>(collectionName: YjsCollectionName, map: Y.Map<string, unknown>, context: string): T[] {
    const items: T[] = [];

    for (const entity of collectEntities<unknown>(map)) {
        const validated = safeValidateCollectionEntity<T>(collectionName, entity, context);

        if (validated) {
            items.push(validated);
        }
    }

    return items;
}

export function readValidatedEntity<T>(collectionName: YjsCollectionName, value: unknown, context: string): T | undefined {
    const entity = readEntity<unknown>(value);

    if (entity == null) {
        return undefined;
    }

    return safeValidateCollectionEntity<T>(collectionName, entity, context);
}

export function validatePreferencesRecord(preferences: Record<string, unknown>, context: string): Preferences {
    return validateCollectionEntity<Preferences>('preferences', preferences, context);
}

function emptySnapshot(): ValidationSnapshot {
    return {
        projects: [],
        tasks: [],
        timeEntries: [],
        clients: [],
        businessInfos: [],
        invoices: [],
        invoiceTemplates: [],
        paymentMethods: [],
        expenses: [],
        expenseRecurrences: [],
        plannerAttachments: [],
        dailyGoals: [],
        preferences: {},
        timers: [],
    };
}

function readPreferencesMap(map: Y.Map<string, unknown> | null | undefined): Preferences {
    const values: Record<string, unknown> = {};

    if (map) {
        map.forEach((value, key) => {
            values[key] = value;
        });
    }

    return validatePreferencesRecord(values, 'preferences snapshot');
}

function buildSnapshotFromDocs(docs: {
    coreDoc: Y.Doc | null;
    activeEntriesDoc: Y.Doc | null;
    archivedTasksDoc: Y.Doc | null;
    archivedInvoicesDoc: Y.Doc | null;
    archivedExpensesDoc: Y.Doc | null;
    yearEntryDocs: Y.Doc[];
}): ValidationSnapshot {
    const snapshot = emptySnapshot();

    if (docs.coreDoc) {
        const core = docs.coreDoc;

        snapshot.projects = collectValidatedEntities<Project>('projects', core.getMap('projects') as Y.Map<string, unknown>, 'core.projects');
        snapshot.tasks = collectValidatedEntities<Task>('tasks', core.getMap('tasks') as Y.Map<string, unknown>, 'core.tasks');
        snapshot.clients = collectValidatedEntities<Client>('clients', core.getMap('clients') as Y.Map<string, unknown>, 'core.clients');
        snapshot.businessInfos = collectValidatedEntities<BusinessInfo>('businessInfos', core.getMap('businessInfos') as Y.Map<string, unknown>, 'core.businessInfos');
        snapshot.invoiceTemplates = collectValidatedEntities<InvoiceTemplate>('invoiceTemplates', core.getMap('invoiceTemplates') as Y.Map<string, unknown>, 'core.invoiceTemplates');
        snapshot.paymentMethods = collectValidatedEntities<PaymentMethod>('paymentMethods', core.getMap('paymentMethods') as Y.Map<string, unknown>, 'core.paymentMethods');
        snapshot.invoices = collectValidatedEntities<Invoice>('invoices', core.getMap('invoices') as Y.Map<string, unknown>, 'core.invoices');
        snapshot.expenses = collectValidatedEntities<Expense>('expenses', core.getMap('expenses') as Y.Map<string, unknown>, 'core.expenses');
        snapshot.expenseRecurrences = collectValidatedEntities<ExpenseRecurrence>('expenseRecurrences', core.getMap('expenseRecurrences') as Y.Map<string, unknown>, 'core.expenseRecurrences');
        snapshot.plannerAttachments = collectValidatedEntities<PlannerAttachment>('plannerAttachments', core.getMap('plannerAttachments') as Y.Map<string, unknown>, 'core.plannerAttachments');
        snapshot.dailyGoals = collectValidatedEntities<DailyGoal>('dailyGoals', core.getMap('dailyGoals') as Y.Map<string, unknown>, 'core.dailyGoals');
        snapshot.timers = collectValidatedEntities<MultiTimerState>('timers', core.getMap('timers') as Y.Map<string, unknown>, 'core.timers');
        snapshot.preferences = readPreferencesMap(core.getMap('preferences') as Y.Map<string, unknown>);
    }

    if (docs.activeEntriesDoc) {
        snapshot.timeEntries.push(
            ...collectValidatedEntities<TimeEntry>('timeEntries', docs.activeEntriesDoc.getMap('timeEntries') as Y.Map<string, unknown>, 'entries-active.timeEntries')
        );
    }

    if (docs.archivedTasksDoc) {
        snapshot.tasks.push(
            ...collectValidatedEntities<Task>('tasks', docs.archivedTasksDoc.getMap('tasks') as Y.Map<string, unknown>, 'tasks-archived.tasks')
        );
    }

    if (docs.archivedInvoicesDoc) {
        snapshot.invoices.push(
            ...collectValidatedEntities<Invoice>('invoices', docs.archivedInvoicesDoc.getMap('invoices') as Y.Map<string, unknown>, 'invoices-archived.invoices')
        );
    }

    if (docs.archivedExpensesDoc) {
        snapshot.expenses.push(
            ...collectValidatedEntities<Expense>('expenses', docs.archivedExpensesDoc.getMap('expenses') as Y.Map<string, unknown>, 'expenses-archived.expenses')
        );
    }

    for (const entryDoc of docs.yearEntryDocs) {
        snapshot.timeEntries.push(
            ...collectValidatedEntities<TimeEntry>('timeEntries', entryDoc.getMap('timeEntries') as Y.Map<string, unknown>, 'entries-year.timeEntries')
        );
    }

    return snapshot;
}

function assertReference(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function validateSnapshotIntegrity(snapshot: ValidationSnapshot, context: string): void {
    const projectIds = new Set(snapshot.projects.map((item) => item.id));
    const clientIds = new Set(snapshot.clients.map((item) => item.id));
    const businessInfoIds = new Set(snapshot.businessInfos.map((item) => item.id));
    const paymentMethodIds = new Set(snapshot.paymentMethods.map((item) => item.id));
    const invoiceIds = new Set(snapshot.invoices.map((item) => item.id));
    const recurrenceIds = new Set(snapshot.expenseRecurrences.map((item) => item.id));
    const taskIds = new Set(snapshot.tasks.map((item) => item.id));

    for (const project of snapshot.projects) {
        if (project.preferredClientId) {
            assertReference(clientIds.has(project.preferredClientId), `${context}: project ${project.id} references missing client ${project.preferredClientId}`);
        }

        if (project.invoiceIds) {
            for (const invoiceId of project.invoiceIds) {
                assertReference(invoiceIds.has(invoiceId), `${context}: project ${project.id} references missing invoice ${invoiceId}`);
            }
        }
    }

    for (const task of snapshot.tasks) {
        if (task.projectId) {
            assertReference(projectIds.has(task.projectId), `${context}: task ${task.id} references missing project ${task.projectId}`);
        }

        if (task.parentTaskId) {
            assertReference(taskIds.has(task.parentTaskId), `${context}: task ${task.id} references missing parent task ${task.parentTaskId}`);
        }
    }

    for (const invoice of snapshot.invoices) {
        assertReference(projectIds.has(invoice.projectId), `${context}: invoice ${invoice.id} references missing project ${invoice.projectId}`);
        assertReference(clientIds.has(invoice.clientId), `${context}: invoice ${invoice.id} references missing client ${invoice.clientId}`);

        if (invoice.businessInfoId) {
            assertReference(businessInfoIds.has(invoice.businessInfoId), `${context}: invoice ${invoice.id} references missing business info ${invoice.businessInfoId}`);
        }

        if (invoice.paymentMethodId) {
            assertReference(paymentMethodIds.has(invoice.paymentMethodId), `${context}: invoice ${invoice.id} references missing payment method ${invoice.paymentMethodId}`);
        }
    }

    for (const expense of snapshot.expenses) {
        if (expense.clientId) {
            assertReference(clientIds.has(expense.clientId), `${context}: expense ${expense.id} references missing client ${expense.clientId}`);
        }

        if (expense.projectId) {
            assertReference(projectIds.has(expense.projectId), `${context}: expense ${expense.id} references missing project ${expense.projectId}`);
        }

        if (expense.businessId) {
            assertReference(businessInfoIds.has(expense.businessId), `${context}: expense ${expense.id} references missing business info ${expense.businessId}`);
        }

        if (expense.invoiceId) {
            assertReference(invoiceIds.has(expense.invoiceId), `${context}: expense ${expense.id} references missing invoice ${expense.invoiceId}`);
        }

        if (expense.recurrenceId) {
            assertReference(recurrenceIds.has(expense.recurrenceId), `${context}: expense ${expense.id} references missing recurrence ${expense.recurrenceId}`);
        }
    }

    for (const recurrence of snapshot.expenseRecurrences) {
        if (recurrence.clientId) {
            assertReference(clientIds.has(recurrence.clientId), `${context}: expense recurrence ${recurrence.id} references missing client ${recurrence.clientId}`);
        }

        if (recurrence.projectId) {
            assertReference(projectIds.has(recurrence.projectId), `${context}: expense recurrence ${recurrence.id} references missing project ${recurrence.projectId}`);
        }

        if (recurrence.businessId) {
            assertReference(businessInfoIds.has(recurrence.businessId), `${context}: expense recurrence ${recurrence.id} references missing business info ${recurrence.businessId}`);
        }
    }

    for (const attachment of snapshot.plannerAttachments) {
        if (attachment.type === 'client') {
            assertReference(clientIds.has(attachment.referenceId), `${context}: planner attachment ${attachment.id} references missing client ${attachment.referenceId}`);
        }

        if (attachment.type === 'project') {
            assertReference(projectIds.has(attachment.referenceId), `${context}: planner attachment ${attachment.id} references missing project ${attachment.referenceId}`);
        }

        if (attachment.type === 'task') {
            assertReference(taskIds.has(attachment.referenceId), `${context}: planner attachment ${attachment.id} references missing task ${attachment.referenceId}`);
        }
    }

    if (taskIds.size > 0) {
        for (const entry of snapshot.timeEntries) {
            assertReference(taskIds.has(entry.taskId), `${context}: time entry ${entry.id} references missing task ${entry.taskId}`);
        }

        for (const timer of snapshot.timers) {
            assertReference(taskIds.has(timer.taskId), `${context}: timer ${timer.projectId} references missing task ${timer.taskId}`);
        }
    }
}

export function validateDocManagerState(docManager: YjsDocManager, docName: DocName, candidateDoc: Y.Doc): void {
    const loadedDocNames = new Set(docManager.getLoadedDocs());

    if (docName.startsWith('entries-')) {
        loadedDocNames.add(docName);
    }

    const resolveDoc = (name: DocName): Y.Doc | null => {
        if (name === docName) {
            return candidateDoc;
        }

        return docManager.getDocSync(name);
    };

    const snapshot = buildSnapshotFromDocs({
        coreDoc: resolveDoc('core'),
        activeEntriesDoc: resolveDoc('entries-active'),
        archivedTasksDoc: resolveDoc('tasks-archived'),
        archivedInvoicesDoc: resolveDoc('invoices-archived'),
        archivedExpensesDoc: resolveDoc('expenses-archived'),
        yearEntryDocs: Array.from(loadedDocNames)
            .filter((name): name is `entries-${number}` => /^entries-\d+$/.test(name))
            .map((name) => resolveDoc(name))
            .filter((doc): doc is Y.Doc => doc !== null),
    });

    validateSnapshotIntegrity(snapshot, `remote ${docName}`);
}