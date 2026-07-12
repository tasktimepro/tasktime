import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { buildInvoiceTaskData } from './InvoiceCalculations'

const loadLegacyBillingParityFixture = () => JSON.parse(readFileSync(
    path.resolve(process.cwd(), 'test-data/backups/tasktime-legacy-billing-parity-v1.4.json'),
    'utf8'
))

describe('buildInvoiceTaskData', () => {

    const project = { id: 'project-1' }

    it('returns null when no billable entries or manually billable tasks', () => {

        const result = buildInvoiceTaskData({
            projectForData: project,
            selectedProject: null,
            tasks: [{ id: 'task-1', projectId: 'project-1', billable: false }],
            timeEntries: [],
            editableHours: {}
        })

        expect(result).toBeNull()
    })

    it('uses explicit billing markers while keeping markerless backdated work eligible', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Billable', billable: true, lastBilledAt: 1000 },
            { id: 'task-2', projectId: 'project-1', title: 'Non-billable', billable: false }
        ]

        const timeEntries = [
            { id: 'entry-billed', taskId: 'task-1', start: 900, end: 1100, billedInvoiceId: 'invoice-old' },
            { taskId: 'task-1', start: 2000, end: 2600 },
            { taskId: 'task-2', start: 2000, end: 2600 }
        ]

        const result = buildInvoiceTaskData({
            projectForData: project,
            selectedProject: null,
            tasks,
            timeEntries,
            editableHours: {}
        })

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('task-1')
        expect(result[0].originalTimeMs).toBe(600)
    })

    it('excludes invoice adjustment entries from billable time', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Billable', billable: true }
        ]

        const timeEntries = [
            { taskId: 'task-1', start: 1, end: 3600001 },
            { taskId: 'task-1', start: 3600001, end: 7200001, source: 'invoice-adjustment' }
        ]

        const result = buildInvoiceTaskData({
            projectForData: project,
            selectedProject: null,
            tasks,
            timeEntries,
            editableHours: {}
        })

        expect(result).toHaveLength(1)
        expect(result[0].originalTimeMs).toBe(3600000)
    })

    it('includes manually billable tasks with zero time', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Manual', billable: true }
        ]

        const result = buildInvoiceTaskData({
            projectForData: project,
            selectedProject: null,
            tasks,
            timeEntries: [],
            editableHours: {}
        })

        expect(result).toHaveLength(1)
        expect(result[0].originalTimeMs).toBe(0)
        expect(result[0].billable).toBe(true)
    })

    it('excludes archived manually billable tasks and subtasks with zero time', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Archived Task', billable: true, archived: true },
            { id: 'parent', projectId: 'project-1', title: 'Parent', billable: false },
            { id: 'child', projectId: 'project-1', title: 'Archived Subtask', parentTaskId: 'parent', billable: true, archived: true }
        ]

        const result = buildInvoiceTaskData({
            projectForData: project,
            selectedProject: null,
            tasks,
            timeEntries: [],
            editableHours: {}
        })

        expect(result).toBeNull()
    })

    it('includes archived billable tasks when they still have unbilled time', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Archived Task', billable: true, archived: true }
        ]

        const timeEntries = [
            { taskId: 'task-1', start: 0, end: 3600000 }
        ]

        const result = buildInvoiceTaskData({
            projectForData: project,
            selectedProject: null,
            tasks,
            timeEntries,
            editableHours: {}
        })

        expect(result).toHaveLength(1)
        expect(result[0]).toEqual(expect.objectContaining({
            id: 'task-1',
            originalHours: 1,
        }))
    })

    it('excludes tasks toggled to non-billable', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Non-billable', billable: false }
        ]

        const timeEntries = [
            { taskId: 'task-1', start: 0, end: 3600000 }
        ]

        const result = buildInvoiceTaskData({
            projectForData: project,
            selectedProject: null,
            tasks,
            timeEntries,
            editableHours: {}
        })

        expect(result).toBeNull()
    })

    it('includes billable subtasks even when parent is non-billable', () => {

        const tasks = [
            { id: 'parent', projectId: 'project-1', title: 'Parent', billable: false },
            { id: 'child', projectId: 'project-1', title: 'Child', parentTaskId: 'parent', billable: true }
        ]

        const timeEntries = [
            { taskId: 'child', start: 0, end: 1800000 }
        ]

        const result = buildInvoiceTaskData({
            projectForData: project,
            selectedProject: null,
            tasks,
            timeEntries,
            editableHours: {}
        })

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('child')
    })

    it('excludes explicitly billed entries independently of lastBilledAt', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Billable', billable: true, lastBilledAt: 1000 }
        ]

        const timeEntries = [
            { id: 'entry-billed', taskId: 'task-1', start: 500, end: 900, billedInvoiceId: 'invoice-old' },
            { taskId: 'task-1', start: 2000, end: 2600 }
        ]

        const result = buildInvoiceTaskData({
            projectForData: project,
            selectedProject: null,
            tasks,
            timeEntries,
            editableHours: {}
        })

        expect(result).toHaveLength(1)
        expect(result[0].originalTimeMs).toBe(600)
    })

    it('matches the preview for markerless entries exactly accounted for by a legacy invoice', () => {

        const fixture = loadLegacyBillingParityFixture()
        const result = buildInvoiceTaskData({
            projectForData: fixture.projects[0],
            selectedProject: null,
            tasks: fixture.tasks,
            timeEntries: fixture.timeEntries,
            invoices: fixture.invoices,
            editableHours: {},
            billingPeriodStart: '2026-05-01',
            billingPeriodEnd: '2026-05-31'
        })

        expect(result).toHaveLength(2)
        expect(result.map((task) => task.originalTimeMs)).toEqual([0, 0])
        expect(result.map((task) => task.originalHours)).toEqual([0, 0])
    })

    it('honors editable hours when provided', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Billable', billable: true }
        ]

        const timeEntries = [
            { taskId: 'task-1', start: 0, end: 3600000 }
        ]

        const result = buildInvoiceTaskData({
            projectForData: project,
            selectedProject: null,
            tasks,
            timeEntries,
            editableHours: { 'task-1': 3.5 }
        })

        expect(result).toHaveLength(1)
        expect(result[0].hours).toBe(3.5)
        expect(result[0].isEdited).toBe(true)
    })

    it('uses billed duration overrides for invoice totals when present', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Billable', billable: true }
        ]

        const timeEntries = [
            { taskId: 'task-1', start: 1, end: (5 * 60 * 1000) + 1, billedDurationMs: 15 * 60 * 1000 }
        ]

        const result = buildInvoiceTaskData({
            projectForData: project,
            selectedProject: null,
            tasks,
            timeEntries,
            editableHours: {}
        })

        expect(result).toHaveLength(1)
        expect(result[0].originalTimeMs).toBe(15 * 60 * 1000)
        expect(result[0].originalHours).toBe(0.25)
    })

    it('filters billable time entries to the selected billing period', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Billable', billable: true }
        ]

        const timeEntries = [
            {
                taskId: 'task-1',
                start: new Date(2026, 3, 10, 9, 0, 0).getTime(),
                end: new Date(2026, 3, 10, 11, 0, 0).getTime()
            },
            {
                taskId: 'task-1',
                start: new Date(2026, 4, 2, 9, 0, 0).getTime(),
                end: new Date(2026, 4, 2, 10, 0, 0).getTime()
            }
        ]

        const result = buildInvoiceTaskData({
            projectForData: project,
            selectedProject: null,
            tasks,
            timeEntries,
            editableHours: {},
            billingPeriodStart: '2026-04-01',
            billingPeriodEnd: '2026-04-30'
        })

        expect(result).toHaveLength(1)
        expect(result[0].originalTimeMs).toBe(2 * 60 * 60 * 1000)
        expect(result[0].originalHours).toBe(2)
    })
})
