import { readFileSync } from 'node:fs'
import * as Y from 'yjs'
import { describe, expect, it } from 'vitest'
import { validateDocManagerState } from './validation'

const example = JSON.parse(readFileSync('test-data/screenshots/tasktime-paperplane-studio-2026-09-12.json', 'utf8'))

function workspace() {
    const docs = { core: new Y.Doc(), 'entries-2026': new Y.Doc(), 'tasks-archived': new Y.Doc(), 'invoices-archived': new Y.Doc() }
    for (const [collection, records] of Object.entries(example)) {
        if (!Array.isArray(records)) continue
        const target = collection === 'timeEntries' ? docs['entries-2026'] : docs.core
        records.forEach(record => target.getMap(collection).set(record.id, new Y.Map(Object.entries(record))))
    }
    const manager = { getLoadedDocs: () => Object.keys(docs), getDocSync: name => docs[name] ?? null }
    return {
        docs,
        validate: (readiness = { taskReferencesReady: true, invoiceReferencesReady: true }) => validateDocManagerState(manager, 'core', docs.core, readiness),
        first: collection => Array.from(docs.core.getMap(collection).values())[0],
        close: () => Object.values(docs).forEach(doc => doc.destroy()),
    }
}

describe('complete remote reference validation', () => {
    it('accepts the complete screenshot workspace including the reported demo task and entry', () => {
        const state = workspace()
        expect(state.docs.core.getMap('tasks').has('demo-task-moodboard')).toBe(true)
        expect(state.docs['entries-2026'].getMap('timeEntries').get('demo-entry-32-1').get('taskId')).toBe('demo-task-moodboard')
        expect(() => state.validate()).not.toThrow()
        state.close()
    })

    it.each([
        ['projects', 'preferredClientId'],
        ['tasks', 'projectId'], ['tasks', 'parentTaskId'],
        ['invoices', 'projectId'], ['invoices', 'clientId'], ['invoices', 'businessInfoId'], ['invoices', 'paymentMethodId'],
        ['expenses', 'clientId'], ['expenses', 'projectId'], ['expenses', 'businessId'], ['expenses', 'invoiceId'],
        ['expenses', 'recurrenceId'], ['expenses', 'categoryId'], ['expenses', 'taxClaimPeriodId'],
        ['expenseRecurrences', 'clientId'], ['expenseRecurrences', 'projectId'],
        ['expenseRecurrences', 'businessId'], ['expenseRecurrences', 'categoryId'],
    ])('still reports a missing %s.%s after dependencies are ready', (collection, field) => {
        const state = workspace()
        state.first(collection).set(field, 'missing-reference')
        expect(() => state.validate()).toThrow(/references missing .*missing-reference/)
        state.close()
    })

    it.each(['project', 'client', 'task'])('keeps %s planner references checked in a complete workspace', type => {
        const state = workspace()
        state.first('plannerAttachments').set('type', type)
        state.first('plannerAttachments').set('referenceId', 'missing-reference')
        expect(() => state.validate()).toThrow(/references missing .*missing-reference/)
        state.close()
    })

    it('defers invoice references until the archived invoice arrives', () => {
        const state = workspace()
        for (const [id, invoice] of state.docs.core.getMap('invoices')) {
            state.docs['invoices-archived'].getMap('invoices').set(id, new Y.Map(Object.entries(invoice.toJSON())))
        }
        state.docs.core.getMap('invoices').clear()
        const archive = state.docs['invoices-archived']
        delete state.docs['invoices-archived']
        expect(() => state.validate({ taskReferencesReady: true, invoiceReferencesReady: false })).not.toThrow()
        expect(() => state.validate()).toThrow(/references missing invoice/)
        state.docs['invoices-archived'] = archive
        expect(() => state.validate()).not.toThrow()
        state.close()
    })

    it.each(['parent', 'planner', 'timer', 'entry'])('defers %s task references without losing the final integrity check', kind => {
        const state = workspace()
        if (kind === 'parent') state.first('tasks').set('parentTaskId', 'missing-task')
        if (kind === 'planner') {
            state.first('plannerAttachments').set('type', 'task')
            state.first('plannerAttachments').set('referenceId', 'missing-task')
        }
        if (kind === 'timer') state.docs.core.getMap('timers').set('project', new Y.Map(Object.entries({ projectId: 'project', taskId: 'missing-task', startTime: 100 })))
        if (kind === 'entry') state.docs['entries-2026'].getMap('timeEntries').get('demo-entry-32-1').set('taskId', 'missing-task')
        expect(() => state.validate({ taskReferencesReady: false, invoiceReferencesReady: true })).not.toThrow()
        expect(() => state.validate()).toThrow(/references missing .*missing-task/)
        state.close()
    })
})
