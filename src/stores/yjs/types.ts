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
    description?: string;
    hourlyRate?: number | null;
    flatRate?: boolean;
    preferredClientId?: string | null;
    isPersonal?: boolean;
    archived?: boolean;
    archivedOnDate?: string | null;
    lastBilledAt?: number | null;
    invoiceIds?: string[];
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
    /** Per-day completion tracking for recurring tasks by year/month/day */
    completedDatesByYear?: Record<string, Record<string, number[]>>;
    /** Completion date for non-recurring tasks (YYYY-MM-DD) */
    completedOnDate?: string | null;
}

export interface RecurringConfig {
    type: 'weekly' | 'monthly';
    weeklyDays?: number[];
    monthlyType?: 'first' | 'last' | 'specific';
    monthlyDay?: number;
}

export interface TimeEntry {
    id: string;
    taskId: string;
    start: number;
    end: number;
    note?: string;
    billedHourlyRate?: number | null;
    billedAt?: number | null;
    billedInvoiceId?: string | null;
}

export interface Client {
    id: string;
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
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    taxId?: string;
    logo?: string;
    isDefault?: boolean;
}

export interface InvoiceItem {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    taskId?: string;
}

export interface Invoice {
    id: string;
    projectId: string;
    clientId: string;
    businessInfoId?: string;
    invoiceNumber: string;
    date: string;
    dueDate?: string;
    status: 'draft' | 'sent' | 'paid' | 'overdue';
    items: InvoiceItem[];
    subtotal: number;
    tax?: number;
    taxRate?: number;
    total: number;
    notes?: string;
    paymentMethodId?: string;
    currency?: string;
    paidAt?: number;
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
    name: string;
    instructions?: string;
    isDefault?: boolean;
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
    showCompletedTasks?: boolean;
    defaultBillable?: boolean;
    projectSort?: 'createdAt' | 'lastActive' | 'name';
    clientSort?: 'createdAt' | 'lastActive' | 'name';
    autoSyncEnabled?: boolean;
    autoSyncMode?: 'backup' | 'sync';
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
    | `entries-${number}`
    | 'invoices-archived';
