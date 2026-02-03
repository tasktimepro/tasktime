import { describe, it, expect } from 'vitest'
import { buildInvoiceTaskData } from './InvoiceCalculations'

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

    it('includes only billable tasks with time after lastBilledAt', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Billable', billable: true, lastBilledAt: 1000 },
            { id: 'task-2', projectId: 'project-1', title: 'Non-billable', billable: false }
        ]

        const timeEntries = [
            { taskId: 'task-1', start: 900, end: 1100 },
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

    it('respects per-task billing windows using lastBilledAt', () => {

        const tasks = [
            { id: 'task-1', projectId: 'project-1', title: 'Billable', billable: true, lastBilledAt: 1000 }
        ]

        const timeEntries = [
            { taskId: 'task-1', start: 500, end: 900 },
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
})
