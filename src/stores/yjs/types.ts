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
    lastBilledAt?: number | null;
    invoiceIds?: string[];
}

export interface Task {
    id: string;
    projectId: string;
    parentTaskId?: string | null;
    title: string;
    completed?: boolean;
    archived?: boolean;
    billable?: boolean;
    billableSetByUser?: boolean;
    lastActive?: number;
    lastBilledAt?: number | null;
}

export interface TimeEntry {
    id: string;
    taskId: string;
    start: number;
    end: number;
    note?: string;
}

export interface Client {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
    defaultHourlyRate?: number | null;
    defaultCurrency?: string;
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
}

export interface TimerState {
    taskId?: string | null;
    startTime?: number | null;
    paused?: boolean;
    pausedElapsedTime?: number;
    note?: string;
    lastActive?: number | null;
}

// ============================================================================
// Store Types
// ============================================================================

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

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
