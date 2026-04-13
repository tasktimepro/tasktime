/**
 * Type definitions for Yjs store entities
 * 
 * These types define the structure of all entities stored in Yjs documents.
 * Note: We don't need createdAt/updatedAt/_syncSeq anymore - Yjs handles
 * conflict resolution internally via vector clocks.
 */

// ============================================================================
// Core Entities
// ============================================================================

export interface Project {
    id: string;
    title: string;
    createdAt?: number;
    updatedAt?: number;
    description?: string;
    invoiceIds?: string[];
    hourlyRate?: number | null;
    flatRate?: boolean;
    preferredClientId?: string | null;
    isPersonal?: boolean;
    archived?: boolean;
    archivedOnDate?: string | null;
    lastBilledAt?: number | null;
    /** Color tag for visual identification (hex, e.g., "#3B82F6") */
    color?: string | null;
}

export interface Task {
    id: string;
    projectId?: string | null;
    parentTaskId?: string | null;
    title: string;
    note?: string | null;
    completed?: boolean;
    archived?: boolean;
    archivedOnDate?: string | null;
    billable?: boolean;
    billableSetByUser?: boolean;
    lastActive?: number;
    createdAt?: number;
    lastBilledAt?: number | null;
    startDate?: string | null;
    recurring?: RecurringConfig | null;
    promptTimeEntry?: boolean;
    /** Temporary ignore flag for current recurring occurrence */
    skipUntilNextRecurring?: boolean;
    /** Occurrence date (YYYY-MM-DD) being skipped for recurring tasks */
    skippedOccurrenceDate?: string | null;
    /** Per-day completion tracking for recurring tasks by year/month/day */
    completedDatesByYear?: Record<string, Record<string, number[]>>;
    /** Completion date for non-recurring tasks (YYYY-MM-DD) */
    completedOnDate?: string | null;
}

export interface RecurringConfig {
    type: 'weekly' | 'monthly' | 'yearly';
    weeklyDays?: number[];
    monthlyType?: 'first' | 'last' | 'specific';
    monthlyDay?: number;
    yearlyDate?: string;
}

export interface TimeEntry {
    id: string;
    taskId: string;
    start: number;
    end: number;
    createdAt?: number;
    updatedAt?: number;
    note?: string;
    source?: string;
    billedHourlyRate?: number | null;
    billedAt?: number | null;
    billedInvoiceId?: string | null;
    /** Timer key (projectId) that produced this entry — used for cross-doc orphan reconciliation */
    _stoppedTimerKey?: string;
}

export interface Client {
    id: string;
    createdAt?: number;
    updatedAt?: number;
    /** Display name / Company name shown in lists */
    title: string;
    /** Business legal name (for invoices) */
    clientName?: string;
    /** Contact person name */
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    registrationNumber?: string;
    vat?: string;
    taxNumber?: string;
    notes?: string;
    /** Custom fields */
    custom?: Array<{ label: string; value: string }>;
    /** Whether tax is disabled for this client */
    disableTax?: boolean;
    defaultHourlyRate?: number | null;
    /** Alias for defaultHourlyRate (legacy) */
    hourlyRate?: number | null;
    flatRate?: boolean;
    defaultCurrency?: string;
    archived?: boolean;
    archivedOnDate?: string | null;
    /** Color tag for visual identification (hex, e.g., "#3B82F6") */
    color?: string | null;
}

export interface BusinessInfo {
    id: string;
    title?: string;
    name?: string;
    businessName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    registrationNumber?: string;
    vat?: string;
    taxNumber?: string;
    custom?: Array<{ label: string; value: string }>;
    taxId?: string;
    logo?: string;
    isDefault?: boolean;
    taxEnabled?: boolean;
    taxLabel?: string;
    taxRate?: number;
}

export interface InvoiceItem {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    taskId?: string;
    expenseId?: string;
    supplierName?: string | null;
    originalAmount?: number;
    originalCurrency?: string;
    exchangeRate?: number;
}

export interface Invoice {
    id: string;
    projectId: string;
    clientId: string;
    createdAt?: number;
    updatedAt?: number;
    businessInfoId?: string | null;
    invoiceNumber: string;
    date: string;
    dueDate?: string | null;
    status: 'draft' | 'sent' | 'paid' | 'overdue';
    items: InvoiceItem[];
    subtotal: number;
    tax?: number;
    taxRate?: number;
    total: number;
    notes?: string;
    paymentMethodId?: string | null;
    currency?: string;
    paidAt?: number | null;
}

export interface InvoiceTemplate {
    id: string;
    name: string;
    prefix?: string;
    useSequentialNumbers?: boolean;
    currentSequentialNumber?: number;
    defaultNotes?: string;
    defaultTaxRate?: number;
    defaultDueDays?: number;
    isDefault?: boolean;
}

export interface PaymentMethod {
    id: string;
    title: string;
    fullName?: string;
    bank?: string;
    iban?: string;
    swift?: string;
    bankAddress?: string;
    paypal?: string;
    custom: Array<{ label: string; value: string }>;
    isDefault?: boolean;
    createdAt?: number;
    updatedAt?: number;
    name?: string;
    instructions?: string;
}

export interface Expense {
    id: string;
    title: string;
    note?: string | null;
    date: string;
    supplierName?: string | null;
    receiptNumber?: string | null;
    currency: string;
    amount: number;
    paidOn?: string | null;
    paidBy?: string | null;
    paymentStatus: 'unpaid' | 'paid';
    paymentMode?: 'manual' | 'auto';
    clientId?: string | null;
    projectId?: string | null;
    businessId?: string | null;
    isPersonal: boolean;
    billable: boolean;
    billingStatus: 'unbilled' | 'billed';
    invoiceId?: string | null;
    billedAt?: number | null;
    isRecurring: boolean;
    recurrenceId?: string | null;
    amountType?: 'fixed' | 'variable' | null;
    taxNumber?: string | null;
    isTaxExempt: boolean;
    isPreview?: boolean;
    createdAt?: number;
    updatedAt?: number;
}

export interface ExpenseRecurrence {
    id: string;
    title: string;
    note?: string | null;
    supplierName?: string | null;
    paidBy?: string | null;
    currency: string;
    amount: number;
    amountType: 'fixed' | 'variable';
    paymentMode?: 'manual' | 'auto';
    repeat: 'monthly' | 'yearly';
    monthlyType?: 'first' | 'last' | 'specific';
    monthlyDay?: number;
    startDate: string;
    endDate?: string | null;
    clientId?: string | null;
    projectId?: string | null;
    businessId?: string | null;
    isPersonal: boolean;
    billable: boolean;
    taxNumber?: string | null;
    isTaxExempt: boolean;
    lastGeneratedDate?: string | null;
    active: boolean;
    createdAt?: number;
    updatedAt?: number;
}

// ============================================================================
// Planner
// ============================================================================

export interface PlannerAttachment {
    id: string;
    /** What type of entity is attached */
    type: 'client' | 'project' | 'task';
    /** ID of the client, project, or task */
    referenceId: string;
    /** How the attachment appears: 'static' = every day, 'date' = specific date, 'weekday' = every specific weekday */
    mode: 'static' | 'date' | 'weekday';
    /** Specific date for mode='date' (YYYY-MM-DD) */
    date?: string | null;
    /** Day of week for mode='weekday' (0=Sun, 1=Mon, ..., 6=Sat) */
    weekday?: number | null;
    /** Display order within a day column (for future drag-drop) */
    sortOrder: number;
    /** When the attachment was created (timestamp) */
    createdAt: number;
    /** Estimated hours for this attachment (for workload planning) */
    estimatedHours?: number | null;
}

export interface PlannerItemBase {
    key: string;
    title: string;
    isCompleted: boolean;
    color?: string | null;
    estimatedHours?: number | null;
    actualTimeMs?: number;
    isTimerActive?: boolean;
    rawHours?: number;
    effectiveHours?: number;
    heightPercent?: number;
    isActualBased?: boolean;
}

export interface PlannerClientItem extends PlannerItemBase {
    type: 'client';
    entity: Client;
    attachment: PlannerAttachment;
}

export interface PlannerProjectItem extends PlannerItemBase {
    type: 'project';
    entity: Project;
    attachment: PlannerAttachment;
}

export interface PlannerTaskItem extends PlannerItemBase {
    type: 'task';
    subtype: 'recurring' | 'due' | 'attached' | 'timer' | 'worked';
    entity: Task;
    attachment?: PlannerAttachment;
}

export interface PlannerExpenseItem extends PlannerItemBase {
    type: 'expense';
    expense: Expense;
    amount: number;
    amountType: 'fixed' | 'variable';
    currency: string;
    supplierName?: string | null;
    isPreview?: boolean;
}

export type PlannerItem = PlannerClientItem | PlannerProjectItem | PlannerTaskItem | PlannerExpenseItem;

export interface DailyGoal {
    id: string;
    /** Day of week (0=Sun, 1=Mon, ..., 6=Sat) */
    weekday: number;
    /** Target working hours for this day (e.g., 8) */
    targetHours?: number | null;
    /** Target earnings for this day in default currency (e.g., 500) */
    targetEarnings?: number | null;
    /** Timestamp when the goal was created */
    createdAt: number;
    /** Timestamp when the goal was last updated */
    updatedAt?: number | null;
}

export interface Preferences {
    currency?: string;
    dateFormat?: string;
    timeFormat?: string;
    theme?: 'light' | 'dark' | 'system';
    defaultView?: string;
    weekStartsOn?: number;
    autoHideTotalsOnRevisit?: boolean;
    showCompletedTasks?: boolean;
    defaultBillable?: boolean;
    projectSort?: 'createdAt' | 'lastActive' | 'name';
    clientSort?: 'createdAt' | 'lastActive' | 'name';
    autoSyncEnabled?: boolean;
    autoSyncMode?: 'backup' | 'sync';
    weeklyGoalTargetHours?: number | null;
    weeklyGoalTargetEarnings?: number | null;
    backupEnabled?: boolean;
    backupFrequencyHours?: number;
}

export interface MultiTimerState {
    projectId: string;
    taskId: string;
    startTime: number;
    paused?: boolean;
    pausedElapsedTime?: number;
    note?: string;
    lastActive?: number;
}

// ============================================================================
// Store Types
// ============================================================================

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';
export type AutoSyncMode = 'backup' | 'sync';
export type DriveSyncMode = 'manual' | AutoSyncMode;
export type SyncPhase = 'idle' | 'checking' | 'downloading' | 'uploading' | 'error';

/**
 * Document names for multi-document architecture
 * - core: Always loaded (projects, active tasks, clients, etc.)
 * - tasks-archived: Archived tasks (on-demand)
 * - entries-active: Recent time entries (always loaded)
 * - entries-{year}: Historical entries by year (on-demand)
 * - invoices-archived: Paid invoices from previous years (on-demand)
 */
export type DocName =
    | 'core'
    | 'tasks-archived'
    | 'entries-active'
    | 'expenses-archived'
    | `entries-${number}`
    | 'invoices-archived';
