/**
 * Yjs-based React hooks
 * 
 * These hooks provide reactive access to Yjs collections with automatic
 * UI updates when data changes.
 */

// Core hook
export { useYjsCollection } from '../useYjsCollection';

// Entity-specific hooks
export { useProjects } from '../useProjects';
export { useTasks } from '../useTasks';
export { useTimeEntries } from '../useTimeEntries';
export { useClients } from '../useClients';
export { useInvoices } from '../useInvoices';
export { useBusinessInfos } from '../useBusinessInfos';
export { useInvoiceTemplates } from '../useInvoiceTemplates';
export { usePaymentMethods } from '../usePaymentMethods';
export { usePreferences } from '../usePreferences';
export { useTimers } from '../useTimers';

// Re-export context hooks
export { useYjs, useYjsStore } from '../../contexts/YjsContext';
