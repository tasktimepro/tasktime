import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as Y from 'yjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { docs } = vi.hoisted(() => ({
    docs: new Map(),
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

            onPersistenceError() {
                return () => {}
            }

            destroy() {
                docs.forEach((doc) => doc.destroy())
                docs.clear()
            }

            async deleteDatabases() {}
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
            this.onPhaseChange = vi.fn(() => () => {})
            this.onPendingChange = vi.fn(() => () => {})
            this.connect = vi.fn(async () => {})
            this.disconnect = vi.fn()
            this.isConnected = vi.fn(() => true)
            this.syncAndSubscribeDoc = vi.fn(async () => {})
            this.getState = vi.fn(() => 'idle')
            this.getPhase = vi.fn(() => 'idle')
            this.getLastSyncedAt = vi.fn(() => null)
            this.hasLocalChangesToPush = vi.fn(() => false)
            this.updateAccessToken = vi.fn()
            this.updateSessionId = vi.fn()
            this.wipeDriveData = vi.fn(async () => {})
            this.getEntryYears = vi.fn(() => [])
        }
    }
}))

vi.mock('./providers/BackupManager', () => ({
    BackupManager: class {
        async maybeCreateBackup() {}
    }
}))

import { YjsStore } from './YjsStore.ts'

const readFixture = (fileName) => JSON.parse(
    readFileSync(path.resolve(process.cwd(), 'docs/test-data', fileName), 'utf8')
)

const fixtures = [
    {
        fileName: 'tasktime-sample-backup-v1.3.json',
        label: 'broad workspace fixture',
        expected: {
            preferences: { currency: 'USD' },
            projects: ['proj-acme-redesign', 'proj-ops-internal'],
            clients: ['client-acme'],
            businessInfos: ['biz-studio'],
            recurrences: ['rec-office-rent'],
            attachments: ['attach-task-northwind-date'],
            activeTasks: ['task-acme-implementation'],
            archivedTasks: ['task-summit-audit'],
            activeEntries: ['entry-2026-acme-implementation-may'],
            historicalEntries: [
                { year: 2025, id: 'entry-2025-summit-closeout' },
                { year: 2024, id: 'entry-2024-summit-audit' },
            ],
            activeInvoices: ['inv-2026-001'],
            archivedInvoices: ['inv-2025-009'],
            activeExpenses: ['expense-acme-stock', 'expense-northwind-hotel'],
            archivedExpenses: ['expense-tax-filing-2025'],
        },
    },
    {
        fileName: 'tasktime-invoice-edge-backup-v1.3.json',
        label: 'invoice edge-case fixture',
        expected: {
            preferences: { currency: 'EUR', defaultView: 'invoices' },
            projects: ['proj-atlas-platform', 'proj-beta-launch'],
            clients: ['client-atlas', 'client-beta'],
            businessInfos: ['biz-edge-main', 'biz-edge-eu'],
            recurrences: [],
            attachments: [],
            activeTasks: ['task-atlas-polish', 'task-beta-release'],
            archivedTasks: ['task-legacy-cleanup'],
            activeEntries: ['entry-atlas-followup', 'entry-beta-release'],
            historicalEntries: [
                { year: 2025, id: 'entry-legacy-cleanup' },
            ],
            activeInvoices: ['inv-edge-001', 'inv-edge-002', 'inv-edge-003', 'inv-edge-004'],
            archivedInvoices: ['inv-edge-archived'],
            activeExpenses: ['expense-beta-travel'],
            archivedExpenses: ['expense-legacy-hosting'],
        },
    },
    {
        fileName: 'tasktime-expenses-tax-backup-v1.3.json',
        label: 'expenses and tax fixture',
        expected: {
            preferences: { currency: 'EUR', defaultView: 'expenses' },
            projects: ['proj-zenith-ops', 'proj-harbor-campaign'],
            clients: ['client-zenith', 'client-harbor'],
            businessInfos: ['biz-tax-main'],
            recurrences: ['rec-cloud-backup', 'rec-studio-rent', 'rec-office-parking'],
            attachments: [],
            activeTasks: ['task-zenith-review', 'task-harbor-assets'],
            archivedTasks: [],
            activeEntries: ['entry-zenith-review', 'entry-harbor-assets'],
            historicalEntries: [],
            activeInvoices: [],
            archivedInvoices: [],
            activeExpenses: ['expense-software-claimed', 'expense-printing-feb'],
            archivedExpenses: ['expense-filing-2025'],
        },
    },
]

describe('backup fixtures', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-05-21T12:00:00Z'))
        docs.forEach((doc) => doc.destroy())
        docs.clear()
    })

    afterEach(() => {
        vi.useRealTimers()
        docs.forEach((doc) => doc.destroy())
        docs.clear()
    })

    for (const fixture of fixtures) {
        it(`imports the ${fixture.label} into active and archived docs`, async () => {
            const store = new YjsStore()
            await store.initialize()

            const { version, exportDate, backupType, ...importPayload } = readFixture(fixture.fileName)

            expect(version).toBe('1.3')
            expect(exportDate).toBe('2026-05-21T12:00:00.000Z')
            expect(backupType).toBe('manual')

            await store.importBackupData(importPayload)

            for (const [key, value] of Object.entries(fixture.expected.preferences)) {
                expect(store.preferences.get(key)).toBe(value)
            }

            fixture.expected.projects.forEach((id) => {
                expect(store.projects.has(id)).toBe(true)
            })

            fixture.expected.clients.forEach((id) => {
                expect(store.clients.has(id)).toBe(true)
            })

            fixture.expected.businessInfos.forEach((id) => {
                expect(store.businessInfos.has(id)).toBe(true)
            })

            fixture.expected.recurrences.forEach((id) => {
                expect(store.expenseRecurrences.has(id)).toBe(true)
            })

            fixture.expected.attachments.forEach((id) => {
                expect(store.plannerAttachments.has(id)).toBe(true)
            })

            fixture.expected.activeTasks.forEach((id) => {
                expect(store.tasks.has(id)).toBe(true)
            })

            if (fixture.expected.archivedTasks.length > 0) {
                const archivedTasks = await store.loadArchivedTasks()
                fixture.expected.archivedTasks.forEach((id) => {
                    expect(archivedTasks.has(id)).toBe(true)
                })
            }

            fixture.expected.activeEntries.forEach((id) => {
                expect(store.activeTimeEntries.has(id)).toBe(true)
            })

            for (const entry of fixture.expected.historicalEntries) {
                expect((await store.loadEntriesForYear(entry.year)).has(entry.id)).toBe(true)
            }

            fixture.expected.activeInvoices.forEach((id) => {
                expect(store.invoices.has(id)).toBe(true)
            })

            if (fixture.expected.archivedInvoices.length > 0) {
                const archivedInvoices = await store.loadArchivedInvoices()
                fixture.expected.archivedInvoices.forEach((id) => {
                    expect(archivedInvoices.has(id)).toBe(true)
                })
            }

            fixture.expected.activeExpenses.forEach((id) => {
                expect(store.expenses.has(id)).toBe(true)
            })

            if (fixture.expected.archivedExpenses.length > 0) {
                const archivedExpenses = await store.loadArchivedExpenses()
                fixture.expected.archivedExpenses.forEach((id) => {
                    expect(archivedExpenses.has(id)).toBe(true)
                })
            }

            store.destroy()
        })
    }
})
