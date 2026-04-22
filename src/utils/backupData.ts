import type {
    BusinessInfo,
    Client,
    DailyGoal,
    EmailTemplate,
    Expense,
    ExpenseRecurrence,
    Invoice,
    InvoiceTemplate,
    PaymentMethod,
    PlannerAttachment,
    Preferences,
    Project,
    Task,
    TimeEntry,
} from '@/stores/yjs/types';

export const BACKUP_VERSION = '1.1';

export interface BackupPayload {
    version: string;
    exportDate: string;
    backupType?: 'automatic' | 'manual';
    projects: Project[];
    tasks: Task[];
    timeEntries: TimeEntry[];
    invoices: Invoice[];
    paymentMethods: PaymentMethod[];
    businessInfos: BusinessInfo[];
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
    businessInfos,
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
        businessInfos,
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