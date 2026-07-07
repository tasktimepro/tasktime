import * as Y from 'yjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'tasktime-disconnected-dirty-docs'

const { docs, providerInstances, storage, providerMockState, deletedDatabaseCalls } = vi.hoisted(() => ({
    docs: new Map(),
    providerInstances: [],
    storage: new Map(),
    deletedDatabaseCalls: [],
    providerMockState: {
        hasLocalChangesToPush: false,
    },
}))

vi.mock('./YjsDocManager', async () => {
    const Yjs = await import('yjs')

    return {
        YjsDocManager: class {
            async getDoc(name) {
                if (!docs.has(name)) {
                    docs.set(name, new Yjs.Doc())
                }

                return docs.get(name)
            }

            isLoaded(name) {
                return docs.has(name)
            }

            getDocSync(name) {
                return docs.get(name) ?? null
            }

            getLoadedDocs() {
                return Array.from(docs.keys())
            }

            async listPersistedDocs() {
                return Array.from(docs.keys())
            }

            destroy() {
                docs.forEach((doc) => doc.destroy())
                docs.clear()
            }

            async deleteDatabases(docNames) {
                deletedDatabaseCalls.push(docNames)
            }
        }
    }
})

vi.mock('./providers/GoogleDriveProvider', () => ({
    YjsDriveProvider: class {
        constructor() {
            this.markDocsForFullStateUpload = vi.fn()
            this.setSyncMode = vi.fn()
            this.getManifest = vi.fn(() => ({}))
            this.onSyncComplete = vi.fn()
            this.connect = vi.fn(async () => {})
            this.disconnect = vi.fn()
            this.isConnected = vi.fn(() => true)
            this.getState = vi.fn(() => 'idle')
            this.hasLocalChangesToPush = vi.fn(() => providerMockState.hasLocalChangesToPush)
            this.sync = vi.fn(async () => {})
            this.syncAndSubscribeDoc = vi.fn(async () => {})
            this.getEntryYears = vi.fn(() => [])
            providerInstances.push(this)
        }
    }
}))

vi.mock('./providers/BackupManager', () => ({
    BackupManager: class {
        async maybeCreateBackup() {}
    }
}))

import { YjsStore } from './YjsStore.ts'

function objectToYMap(data) {
    const map = new Y.Map()
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            map.set(key, value)
        }
    })
    return map
}

describe('YjsStore reconnect sync tracking', () => {
    beforeEach(() => {
        storage.clear()
        localStorage.getItem.mockImplementation((key) => storage.get(key))
        localStorage.setItem.mockImplementation((key, value) => {
            storage.set(key, String(value))
        })
        localStorage.removeItem.mockImplementation((key) => {
            storage.delete(key)
        })
        localStorage.clear.mockImplementation(() => {
            storage.clear()
        })

        localStorage.clear()

        docs.forEach((doc) => doc.destroy())
        docs.clear()
        providerInstances.length = 0
        deletedDatabaseCalls.length = 0
        providerMockState.hasLocalChangesToPush = false
    })

    it('hands disconnected local edits to Drive on reconnect', async () => {
        const store = new YjsStore()
        await store.initialize()

        // Use sync mode so dirty docs are cleared on connect
        store.setDriveSyncPreferences(true, 'sync')

        const project = new Y.Map()
        project.set('id', 'project-1')
        project.set('title', 'Offline project')

        docs.get('core').getMap('projects').set('project-1', project)

        expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(['core'])

        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]

        expect(provider.markDocsForFullStateUpload).toHaveBeenCalledWith(['core'])
        expect(localStorage.getItem(STORAGE_KEY)).toBeUndefined()

        store.destroy()
    })

    it('keeps disconnected dirty docs queued after manual-mode reconnect', async () => {
        const store = new YjsStore()
        await store.initialize()

        // Default mode is manual — don't change it

        const project = new Y.Map()
        project.set('id', 'project-1')
        project.set('title', 'Offline project')

        docs.get('core').getMap('projects').set('project-1', project)

        expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(['core'])

        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]

        // Dirty docs are handed to provider but stay queued until a manual sync
        expect(provider.markDocsForFullStateUpload).toHaveBeenCalledWith(['core'])
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(['core'])

        store.destroy()
    })

    it('bootstraps a pristine manual-mode device with a remote pull check on connect', async () => {
        const store = new YjsStore()
        await store.initialize()

        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]

        expect(provider.connect).toHaveBeenCalledWith('manual', { bootstrapPullIfPristine: true })

        store.destroy()
    })

    it('skips manual-mode bootstrap pull when local entity data already exists', async () => {
        const store = new YjsStore()
        await store.initialize()

        docs.get('core').getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Local only project',
        }))

        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]

        expect(provider.connect).toHaveBeenCalledWith('manual', { bootstrapPullIfPristine: false })

        store.destroy()
    })

    it('keeps disconnected dirty docs queued when reconnect leaves provider work pending', async () => {
        const store = new YjsStore()
        await store.initialize()

        store.setDriveSyncPreferences(true, 'sync')

        docs.get('core').getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Imported while disconnected',
        }))

        expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(['core'])

        providerMockState.hasLocalChangesToPush = true

        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]

        expect(provider.markDocsForFullStateUpload).toHaveBeenCalledWith(['core'])
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(['core'])

        store.destroy()
    })

    it('keeps disconnected dirty docs queued when manual sync fails', async () => {
        const store = new YjsStore()
        await store.initialize()

        docs.get('core').getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Manual dirty project',
        }))

        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]
        provider.getState.mockReturnValue('error')
        provider.hasLocalChangesToPush.mockReturnValue(true)

        await expect(store.forceDriveSync({ allowPull: true })).rejects.toThrow('Drive sync failed')

        expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(['core'])

        store.destroy()
    })

    it('uses full-state verification for default manual sync now', async () => {
        const store = new YjsStore()
        await store.initialize()
        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]

        await store.forceDriveSync()

        expect(provider.sync).toHaveBeenCalledWith(true, {
            allowPull: undefined,
            forceFullState: true,
        })

        store.destroy()
    })

    it('does not default forced push-only syncs to full-state verification', async () => {
        const store = new YjsStore()
        await store.initialize()
        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]

        await store.forceDriveSync({ allowPull: false })

        expect(provider.sync).toHaveBeenCalledWith(true, {
            allowPull: false,
            forceFullState: false,
        })

        store.destroy()
    })

    it('clears disconnected dirty docs after manual sync succeeds with no provider work pending', async () => {
        const store = new YjsStore()
        await store.initialize()

        docs.get('core').getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Manual dirty project',
        }))

        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]
        provider.getState.mockReturnValue('idle')
        provider.hasLocalChangesToPush.mockReturnValue(false)

        await store.forceDriveSync({ allowPull: true })

        expect(localStorage.getItem(STORAGE_KEY)).toBeUndefined()

        store.destroy()
    })

    it('keeps lazy disconnected dirty docs queued when their on-demand sync leaves provider work pending', async () => {
        storage.set(STORAGE_KEY, JSON.stringify(['tasks-archived']))

        const store = new YjsStore()
        await store.initialize()

        store.setDriveSyncPreferences(true, 'sync')
        await store.connectDrive('worker-placeholder', 'session-1')

        expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(['tasks-archived'])

        providerMockState.hasLocalChangesToPush = true

        await store.loadArchivedTasks()

        const provider = providerInstances[0]

        expect(provider.markDocsForFullStateUpload).toHaveBeenCalledWith(['tasks-archived'])
        expect(provider.syncAndSubscribeDoc).toHaveBeenCalledWith('tasks-archived', undefined)
        expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(['tasks-archived'])

        store.destroy()
    })

    it('clears lazy disconnected dirty docs after their on-demand sync succeeds', async () => {
        storage.set(STORAGE_KEY, JSON.stringify(['tasks-archived']))

        const store = new YjsStore()
        await store.initialize()

        store.setDriveSyncPreferences(true, 'sync')
        await store.connectDrive('worker-placeholder', 'session-1')

        expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual(['tasks-archived'])

        await store.loadArchivedTasks()

        const provider = providerInstances[0]

        expect(provider.markDocsForFullStateUpload).toHaveBeenCalledWith(['tasks-archived'])
        expect(provider.syncAndSubscribeDoc).toHaveBeenCalledWith('tasks-archived', undefined)
        expect(localStorage.getItem(STORAGE_KEY)).toBeUndefined()

        store.destroy()
    })

    it('does not force-upload clean docs on reconnect', async () => {
        const store = new YjsStore()
        await store.initialize()

        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]

        expect(provider.markDocsForFullStateUpload).not.toHaveBeenCalled()
        expect(localStorage.getItem(STORAGE_KEY)).toBeUndefined()

        store.destroy()
    })

    it('does not create a manual export when connected cloud refresh fails', async () => {
        const store = new YjsStore()
        await store.initialize()
        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]
        provider.getState.mockReturnValue('error')

        await expect(store.exportBackupData({
            backupType: 'manual',
            refreshFromCloud: true,
        })).rejects.toThrow('Unable to refresh cloud data before export')

        expect(provider.sync).toHaveBeenCalledWith(true, { allowPull: true, forceFullState: false })
        expect(provider.syncAndSubscribeDoc).not.toHaveBeenCalled()

        store.destroy()
    })

    it('clears discovered persisted docs outside the default year range', async () => {
        const store = new YjsStore()
        await store.initialize()

        docs.set('entries-2019', new Y.Doc())
        docs.set('entries-2035', new Y.Doc())

        await store.clearAllData()

        expect(deletedDatabaseCalls).toHaveLength(1)
        expect(deletedDatabaseCalls[0]).toEqual(expect.arrayContaining([
            'core',
            'entries-active',
            'entries-2019',
            'entries-2035',
        ]))
    })
})

describe('YjsStore timer reconciliation', () => {
    beforeEach(() => {
        storage.clear()
        localStorage.getItem.mockImplementation((key) => storage.get(key))
        localStorage.setItem.mockImplementation((key, value) => {
            storage.set(key, String(value))
        })
        localStorage.removeItem.mockImplementation((key) => {
            storage.delete(key)
        })
        localStorage.clear.mockImplementation(() => {
            storage.clear()
        })

        localStorage.clear()

        docs.forEach((doc) => doc.destroy())
        docs.clear()
        providerInstances.length = 0
        deletedDatabaseCalls.length = 0
        providerMockState.hasLocalChangesToPush = false
    })

    it('deletes orphaned timers that have a matching stopped timer instance', async () => {
        const store = new YjsStore()
        await store.initialize()

        const coreDoc = docs.get('core')
        const entriesDoc = docs.get('entries-active')

        // Simulate: timer still exists in core (delete didn't sync yet)
        coreDoc.getMap('timers').set('project-1', objectToYMap({
            projectId: 'project-1',
            taskId: 'task-1',
            timerInstanceId: 'timer-1',
            startTime: 1000,
            paused: false,
        }))

        // Simulate: entry from stopping that timer already arrived
        entriesDoc.getMap('timeEntries').set('entry-1', objectToYMap({
            id: 'entry-1',
            taskId: 'task-1',
            start: 1000,
            end: 2000,
            _stoppedTimerKey: 'project-1',
            _stoppedTimerInstanceId: 'timer-1',
        }))

        expect(coreDoc.getMap('timers').has('project-1')).toBe(true)

        store.reconcileOrphanedTimers()

        expect(coreDoc.getMap('timers').has('project-1')).toBe(false)
        // Entry is preserved
        expect(entriesDoc.getMap('timeEntries').has('entry-1')).toBe(true)

        store.destroy()
    })

    it('still deletes legacy orphaned timers when task and start time match', async () => {
        const store = new YjsStore()
        await store.initialize()

        const coreDoc = docs.get('core')
        const entriesDoc = docs.get('entries-active')

        coreDoc.getMap('timers').set('project-1', objectToYMap({
            projectId: 'project-1',
            taskId: 'task-1',
            startTime: 1000,
            paused: false,
        }))

        entriesDoc.getMap('timeEntries').set('entry-1', objectToYMap({
            id: 'entry-1',
            taskId: 'task-1',
            start: 1000,
            end: 2000,
            _stoppedTimerKey: 'project-1',
        }))

        store.reconcileOrphanedTimers()

        expect(coreDoc.getMap('timers').has('project-1')).toBe(false)

        store.destroy()
    })

    it('does not delete a fresh timer just because the project has older stopped entries', async () => {
        const store = new YjsStore()
        await store.initialize()

        const coreDoc = docs.get('core')
        const entriesDoc = docs.get('entries-active')

        coreDoc.getMap('timers').set('project-1', objectToYMap({
            projectId: 'project-1',
            taskId: 'task-1',
            timerInstanceId: 'timer-new',
            startTime: 3000,
            paused: false,
        }))

        entriesDoc.getMap('timeEntries').set('entry-old', objectToYMap({
            id: 'entry-old',
            taskId: 'task-1',
            start: 1000,
            end: 2000,
            _stoppedTimerKey: 'project-1',
        }))

        store.reconcileOrphanedTimers()

        expect(coreDoc.getMap('timers').has('project-1')).toBe(true)

        store.destroy()
    })

    it('does not delete timers without matching _stoppedTimerKey entries', async () => {
        const store = new YjsStore()
        await store.initialize()

        const coreDoc = docs.get('core')
        const entriesDoc = docs.get('entries-active')

        // Active timer - no matching entry
        coreDoc.getMap('timers').set('project-1', objectToYMap({
            projectId: 'project-1',
            taskId: 'task-1',
            timerInstanceId: 'timer-1',
            startTime: 1000,
            paused: false,
        }))

        // Unrelated entry (no _stoppedTimerKey)
        entriesDoc.getMap('timeEntries').set('entry-1', objectToYMap({
            id: 'entry-1',
            taskId: 'task-1',
            start: 500,
            end: 900,
        }))

        store.reconcileOrphanedTimers()

        expect(coreDoc.getMap('timers').has('project-1')).toBe(true)

        store.destroy()
    })

    it('handles multiple orphaned timers in a single pass', async () => {
        const store = new YjsStore()
        await store.initialize()

        const coreDoc = docs.get('core')
        const entriesDoc = docs.get('entries-active')

        coreDoc.getMap('timers').set('project-1', objectToYMap({
            projectId: 'project-1',
            taskId: 'task-1',
            timerInstanceId: 'timer-1',
            startTime: 1000,
        }))
        coreDoc.getMap('timers').set('project-2', objectToYMap({
            projectId: 'project-2',
            taskId: 'task-2',
            timerInstanceId: 'timer-2',
            startTime: 2000,
        }))
        // project-3 has no matching entry — should survive
        coreDoc.getMap('timers').set('project-3', objectToYMap({
            projectId: 'project-3',
            taskId: 'task-3',
            timerInstanceId: 'timer-3',
            startTime: 3000,
        }))

        entriesDoc.getMap('timeEntries').set('e1', objectToYMap({
            id: 'e1', taskId: 'task-1', start: 1000, end: 2000,
            _stoppedTimerKey: 'project-1',
            _stoppedTimerInstanceId: 'timer-1',
        }))
        entriesDoc.getMap('timeEntries').set('e2', objectToYMap({
            id: 'e2', taskId: 'task-2', start: 2000, end: 3000,
            _stoppedTimerKey: 'project-2',
            _stoppedTimerInstanceId: 'timer-2',
        }))

        store.reconcileOrphanedTimers()

        expect(coreDoc.getMap('timers').has('project-1')).toBe(false)
        expect(coreDoc.getMap('timers').has('project-2')).toBe(false)
        expect(coreDoc.getMap('timers').has('project-3')).toBe(true)

        store.destroy()
    })

    it('cleans up orphaned planner attachments for missing projects and clients on init', async () => {
        const store = new YjsStore()
        await store.initialize()

        const coreDoc = docs.get('core')

        // Set up a valid project and client
        coreDoc.getMap('projects').set('p1', objectToYMap({ id: 'p1', title: 'Valid' }))
        coreDoc.getMap('clients').set('c1', objectToYMap({ id: 'c1', title: 'Valid Client' }))

        // Planner attachments — some valid, some orphaned
        const atts = coreDoc.getMap('plannerAttachments')
        atts.set('att-valid-project', objectToYMap({ id: 'att-valid-project', type: 'project', referenceId: 'p1' }))
        atts.set('att-valid-client', objectToYMap({ id: 'att-valid-client', type: 'client', referenceId: 'c1' }))
        atts.set('att-valid-task', objectToYMap({ id: 'att-valid-task', type: 'task', referenceId: 'task-whatever' }))
        atts.set('att-orphan-project', objectToYMap({ id: 'att-orphan-project', type: 'project', referenceId: 'deleted-project' }))
        atts.set('att-orphan-client', objectToYMap({ id: 'att-orphan-client', type: 'client', referenceId: 'deleted-client' }))

        // Re-run the private cleanup method
        store.cleanupOrphanedPlannerAttachments()

        // Valid attachments survive
        expect(atts.has('att-valid-project')).toBe(true)
        expect(atts.has('att-valid-client')).toBe(true)
        // Task attachments are NOT scrubbed (archived tasks may not be loaded)
        expect(atts.has('att-valid-task')).toBe(true)
        // Orphaned project and client attachments are removed
        expect(atts.has('att-orphan-project')).toBe(false)
        expect(atts.has('att-orphan-client')).toBe(false)

        store.destroy()
    })

    it('exports email templates plus archived and historical backup data', async () => {
        const store = new YjsStore()
        await store.initialize()

        const coreDoc = docs.get('core')
        const activeEntriesDoc = docs.get('entries-active')
        const archivedTasksDoc = new Y.Doc()
        const archivedInvoicesDoc = new Y.Doc()
        const archivedExpensesDoc = new Y.Doc()
        const historicalEntriesDoc = new Y.Doc()

        docs.set('tasks-archived', archivedTasksDoc)
        docs.set('invoices-archived', archivedInvoicesDoc)
        docs.set('expenses-archived', archivedExpensesDoc)
        docs.set('entries-2024', historicalEntriesDoc)

        coreDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Project One',
            taskView: 'kanban',
            taskSort: 'manual',
            statusMode: 'quote',
            deadline: '2026-05-30',
            budgetAmount: 2500,
            notes: {
                version: 1,
                type: 'tiptap-json',
                content: {
                    type: 'doc',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Project note' }] }],
                },
                plainTextPreview: 'Project note',
                updatedAt: Date.UTC(2026, 3, 22),
            },
        }))
        coreDoc.getMap('tasks').set('task-active', objectToYMap({ id: 'task-active', title: 'Active Task', projectId: 'project-1', sortOrder: 1000, sortOrderUpdatedAt: Date.UTC(2026, 3, 20), estimatedHours: 3.5, estimatedFlatAmount: 500 }))
        coreDoc.getMap('clients').set('client-1', objectToYMap({ id: 'client-1', title: 'Client One' }))
        coreDoc.getMap('businessInfos').set('business-1', objectToYMap({ id: 'business-1', title: 'Business One' }))
        coreDoc.getMap('invoiceTemplates').set('invoice-template-1', objectToYMap({ id: 'invoice-template-1', name: 'Invoice Template' }))
        coreDoc.getMap('emailTemplates').set('email-template-1', objectToYMap({ id: 'email-template-1', name: 'Email Template', type: 'quote', subject: 'Hello', body: 'World', isDefault: true }))
        coreDoc.getMap('paymentMethods').set('payment-1', objectToYMap({ id: 'payment-1', title: 'Wise' }))
        coreDoc.getMap('expenses').set('expense-active', objectToYMap({ id: 'expense-active', title: 'Active Expense', date: '2026-04-01', amount: 10, currency: 'EUR', paymentStatus: 'paid', billingStatus: 'unbilled', isPersonal: true, billable: false }))
        coreDoc.getMap('expenseRecurrences').set('recurrence-1', objectToYMap({ id: 'recurrence-1', title: 'Recurring Expense', currency: 'EUR', amount: 10, amountType: 'fixed', paymentMode: 'manual', repeat: 'monthly', monthlyType: 'specific', monthlyDay: 1, startDate: '2026-01-01', isPersonal: true, billable: false, active: true }))
        coreDoc.getMap('plannerAttachments').set('attachment-1', objectToYMap({ id: 'attachment-1', type: 'project', referenceId: 'project-1', mode: 'weekday', weekday: 1, sortOrder: 1 }))
        coreDoc.getMap('dailyGoals').set('goal-1', objectToYMap({ id: 'goal-1', weekday: 1, targetHours: 4 }))
        coreDoc.getMap('invoices').set('invoice-active', objectToYMap({ id: 'invoice-active', projectId: 'project-1', clientId: 'client-1', date: '2026-04-01', dueDate: '2026-04-15', status: 'draft', subtotal: 10, tax: 0, total: 10, currency: 'EUR', items: [] }))
        coreDoc.getMap('preferences').set('currency', 'EUR')

        activeEntriesDoc.getMap('timeEntries').set('entry-active', objectToYMap({ id: 'entry-active', taskId: 'task-active', start: Date.UTC(2026, 3, 1), end: Date.UTC(2026, 3, 1, 1) }))
        archivedTasksDoc.getMap('tasks').set('task-archived', objectToYMap({ id: 'task-archived', title: 'Archived Task', projectId: 'project-1', archived: true, sortOrder: 2000, sortOrderUpdatedAt: Date.UTC(2026, 3, 21) }))
        archivedInvoicesDoc.getMap('invoices').set('invoice-archived', objectToYMap({ id: 'invoice-archived', projectId: 'project-1', clientId: 'client-1', date: '2025-01-01', dueDate: '2025-01-15', status: 'paid', subtotal: 20, tax: 0, total: 20, currency: 'EUR', items: [] }))
        archivedExpensesDoc.getMap('expenses').set('expense-archived', objectToYMap({ id: 'expense-archived', title: 'Archived Expense', date: '2025-01-01', amount: 20, currency: 'EUR', paymentStatus: 'paid', billingStatus: 'unbilled', isPersonal: true, billable: false }))
        historicalEntriesDoc.getMap('timeEntries').set('entry-2024', objectToYMap({ id: 'entry-2024', taskId: 'task-active', start: Date.UTC(2024, 0, 1), end: Date.UTC(2024, 0, 1, 1) }))

        const payload = await store.exportBackupData({ backupType: 'manual', exportDate: '2026-04-22T00:00:00.000Z' })

        expect(payload.emailTemplates).toEqual([
            expect.objectContaining({ id: 'email-template-1' }),
        ])
        expect(payload.projects).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'project-1',
                taskView: 'kanban',
                taskSort: 'manual',
                statusMode: 'quote',
                deadline: '2026-05-30',
                budgetAmount: 2500,
                notes: expect.objectContaining({
                    type: 'tiptap-json',
                    plainTextPreview: 'Project note',
                }),
            }),
        ]))
        expect(payload.tasks).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'task-active', sortOrder: 1000, estimatedHours: 3.5, estimatedFlatAmount: 500 }),
            expect.objectContaining({ id: 'task-archived', sortOrder: 2000 }),
        ]))
        expect(payload.invoices).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'invoice-active' }),
            expect.objectContaining({ id: 'invoice-archived' }),
        ]))
        expect(payload.expenses).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'expense-active' }),
            expect.objectContaining({ id: 'expense-archived' }),
        ]))
        expect(payload.timeEntries).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'entry-active' }),
            expect.objectContaining({ id: 'entry-2024' }),
        ]))
        expect(payload.backupType).toBe('manual')

        store.destroy()
    })

    it('imports email templates plus archived and historical backup data into the correct docs', async () => {
        const store = new YjsStore()
        await store.initialize()
        const activeExpenseDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const archivedExpenseDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

        await store.importBackupData({
            projects: [{
                id: 'project-1',
                title: 'Project One',
                taskView: 'kanban',
                taskSort: 'manual',
                statusMode: 'quote',
                deadline: '2026-05-31',
                budgetAmount: 1800,
                notes: {
                    version: 1,
                    type: 'tiptap-json',
                    content: {
                        type: 'doc',
                        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Imported note' }] }],
                    },
                    plainTextPreview: 'Imported note',
                    updatedAt: Date.UTC(2026, 3, 22),
                },
            }],
            tasks: [
                { id: 'task-active', title: 'Active Task', projectId: 'project-1', sortOrder: 1000, sortOrderUpdatedAt: Date.UTC(2026, 3, 20), estimatedHours: 2.25, estimatedFlatAmount: 400 },
                { id: 'task-archived', title: 'Archived Task', projectId: 'project-1', archived: true, archivedOnDate: '2026-04-22', sortOrder: 2000, sortOrderUpdatedAt: Date.UTC(2026, 3, 21), estimatedHours: 1 },
            ],
            timeEntries: [
                { id: 'entry-active', taskId: 'task-active', start: Date.now(), end: Date.now() + 1_000 },
                { id: 'entry-2024', taskId: 'task-active', start: Date.UTC(2024, 0, 1), end: Date.UTC(2024, 0, 1, 1) },
            ],
            invoices: [
                { id: 'invoice-active', invoiceNumber: 'INV-1000', projectId: 'project-1', clientId: 'client-1', date: '2026-04-01', dueDate: '2026-04-15', status: 'draft', subtotal: 10, tax: 0, total: 10, currency: 'EUR', items: [] },
                { id: 'invoice-archived', invoiceNumber: 'INV-1001', projectId: 'project-1', clientId: 'client-1', date: '2025-01-01', dueDate: '2025-01-15', status: 'paid', paidAt: Date.UTC(2025, 0, 15), subtotal: 20, tax: 0, total: 20, currency: 'EUR', items: [] },
            ],
            paymentMethods: [],
            businessInfos: [],
            clients: [],
            invoiceTemplates: [],
            emailTemplates: [{ id: 'email-template-1', name: 'Email Template', type: 'quote', subject: 'Hello', sendBody: 'World', reminderBody: '', attachmentTitle: 'quote.pdf', isDefault: true }],
            expenses: [
                { id: 'expense-active', title: 'Active Expense', date: activeExpenseDate, amount: 10, currency: 'EUR', paymentStatus: 'paid', billingStatus: 'unbilled', isPersonal: true, billable: false, isRecurring: false, isTaxExempt: false },
                { id: 'expense-archived', title: 'Archived Expense', date: archivedExpenseDate, amount: 20, currency: 'EUR', paymentStatus: 'paid', billingStatus: 'unbilled', isPersonal: true, billable: false, isRecurring: false, isTaxExempt: false },
            ],
            expenseRecurrences: [],
            dailyGoals: [],
            plannerAttachments: [],
            preferences: { currency: 'EUR' },
        })

        expect(store.emailTemplates.has('email-template-1')).toBe(true)
        expect(store.projects.get('project-1').get('notes')).toEqual(expect.objectContaining({
            type: 'tiptap-json',
            plainTextPreview: 'Imported note',
        }))
        expect(store.projects.get('project-1').get('taskView')).toBe('kanban')
        expect(store.projects.get('project-1').get('taskSort')).toBe('manual')
        expect(store.projects.get('project-1').toJSON()).toEqual(expect.objectContaining({
            statusMode: 'quote',
            deadline: '2026-05-31',
            budgetAmount: 1800,
        }))
        expect(store.tasks.has('task-active')).toBe(true)
        expect(store.tasks.get('task-active').get('sortOrder')).toBe(1000)
        expect(store.tasks.get('task-active').toJSON()).toEqual(expect.objectContaining({
            estimatedHours: 2.25,
            estimatedFlatAmount: 400,
        }))
        expect((await store.loadArchivedTasks()).has('task-archived')).toBe(true)
        expect((await store.loadArchivedTasks()).get('task-archived').get('sortOrder')).toBe(2000)
        expect((await store.loadArchivedTasks()).get('task-archived').toJSON()).toEqual(expect.objectContaining({
            estimatedHours: 1,
        }))
        expect(store.activeTimeEntries.has('entry-active')).toBe(true)
        expect((await store.loadEntriesForYear(2024)).has('entry-2024')).toBe(true)
        expect(store.invoices.has('invoice-active')).toBe(true)
        expect((await store.loadArchivedInvoices()).has('invoice-archived')).toBe(true)
        expect(store.expenses.has('expense-active')).toBe(true)
        expect((await store.loadArchivedExpenses()).has('expense-archived')).toBe(true)

        store.destroy()
    })

    it('refreshes connected cloud docs before manual export when requested', async () => {
        const store = new YjsStore()
        await store.initialize()
        await store.connectDrive('worker-placeholder', 'session-1')

        const provider = providerInstances[0]
        provider.getEntryYears.mockReturnValue([2024])

        await store.exportBackupData({
            backupType: 'manual',
            refreshFromCloud: true,
        })

        expect(provider.sync).toHaveBeenCalledWith(true, { allowPull: true, forceFullState: false })
        expect(provider.syncAndSubscribeDoc).toHaveBeenCalledWith('tasks-archived', { allowPull: true })
        expect(provider.syncAndSubscribeDoc).toHaveBeenCalledWith('invoices-archived', { allowPull: true })
        expect(provider.syncAndSubscribeDoc).toHaveBeenCalledWith('expenses-archived', { allowPull: true })
        expect(provider.syncAndSubscribeDoc).toHaveBeenCalledWith('entries-2024', { allowPull: true })

        store.destroy()
    })
})

describe('YjsStore task hierarchy archiving', () => {
    beforeEach(() => {
        storage.clear()
        localStorage.getItem.mockImplementation((key) => storage.get(key))
        localStorage.setItem.mockImplementation((key, value) => {
            storage.set(key, String(value))
        })
        localStorage.removeItem.mockImplementation((key) => {
            storage.delete(key)
        })
        localStorage.clear.mockImplementation(() => {
            storage.clear()
        })

        localStorage.clear()

        docs.forEach((doc) => doc.destroy())
        docs.clear()
        providerInstances.length = 0
        providerMockState.hasLocalChangesToPush = false
    })

    it('archives a parent task together with descendant subtasks', async () => {
        const store = new YjsStore()
        await store.initialize()

        const coreDoc = docs.get('core')
        coreDoc.getMap('tasks').set('parent', objectToYMap({
            id: 'parent',
            title: 'Parent task',
            projectId: null,
            parentTaskId: null,
            archived: false,
        }))
        coreDoc.getMap('tasks').set('child', objectToYMap({
            id: 'child',
            title: 'Child task',
            projectId: null,
            parentTaskId: 'parent',
            archived: false,
        }))

        await store.archiveTask('parent')

        const archivedMap = await store.loadArchivedTasks()

        expect(coreDoc.getMap('tasks').has('parent')).toBe(false)
        expect(coreDoc.getMap('tasks').has('child')).toBe(false)
        expect(archivedMap.has('parent')).toBe(true)
        expect(archivedMap.has('child')).toBe(true)
        expect(archivedMap.get('parent').get('archived')).toBe(true)
        expect(archivedMap.get('child').get('parentTaskId')).toBe('parent')

        store.destroy()
    })

    it('unarchives a parent task together with descendant subtasks', async () => {
        const store = new YjsStore()
        await store.initialize()

        const archivedMap = await store.loadArchivedTasks()
        archivedMap.set('parent', objectToYMap({
            id: 'parent',
            title: 'Parent task',
            projectId: null,
            parentTaskId: null,
            archived: true,
            archivedOnDate: '2026-05-25',
        }))
        archivedMap.set('child', objectToYMap({
            id: 'child',
            title: 'Child task',
            projectId: null,
            parentTaskId: 'parent',
            archived: true,
            archivedOnDate: '2026-05-25',
        }))

        await store.unarchiveTask('parent')

        const coreDoc = docs.get('core')

        expect(archivedMap.has('parent')).toBe(false)
        expect(archivedMap.has('child')).toBe(false)
        expect(coreDoc.getMap('tasks').has('parent')).toBe(true)
        expect(coreDoc.getMap('tasks').has('child')).toBe(true)
        expect(coreDoc.getMap('tasks').get('parent').get('archived')).toBe(false)
        expect(coreDoc.getMap('tasks').get('child').get('parentTaskId')).toBe('parent')

        store.destroy()
    })
})
