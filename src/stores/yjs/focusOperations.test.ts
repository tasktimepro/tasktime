import * as Y from 'yjs';
import { describe, expect, it } from 'vitest';
import type { YjsStore } from './YjsStore';
import { objectToYMap, readEntity } from './entityUtils';
import {
    addFocusTasks,
    createFocusTask,
    moveFocusTask,
    readFocusItems,
    removeFocusTask,
    restoreFocusTask,
    retireCompletedFocusTasks,
} from './focusOperations';

function createStore() {
    const coreDoc = new Y.Doc();
    const store = {
        coreDoc,
        tasks: coreDoc.getMap('tasks'),
        projects: coreDoc.getMap('projects'),
        focusItems: coreDoc.getMap('focusItems'),
        archivedTasks: null,
    } as unknown as YjsStore;
    store.projects.set('project', objectToYMap({ id: 'project', title: 'Project' }) as any);
    store.tasks.set('one', objectToYMap({ id: 'one', title: 'One', projectId: 'project', sortOrder: 7 }) as any);
    store.tasks.set('two', objectToYMap({ id: 'two', title: 'Two', projectId: 'project', sortOrder: 8 }) as any);
    return store;
}

describe('Focus persistence operations', () => {
    it('adds a batch atomically, with idempotent retries and no partial invalid batch', () => {
        const store = createStore();
        expect(() => addFocusTasks(store, [{ taskId: 'one' }, { taskId: 'missing' }])).toThrow();
        expect(readFocusItems(store)).toEqual([]);
        expect(addFocusTasks(store, [{ taskId: 'one' }, { taskId: 'two' }], { now: 100, generateId: () => 'selection' })).toHaveLength(2);
        expect(addFocusTasks(store, [{ taskId: 'one' }])).toEqual([]);
        expect(readFocusItems(store)).toHaveLength(2);
    });

    it('creates a real task and selection in one core update without altering other task order', () => {
        const store = createStore();
        const updates: Uint8Array[] = [];
        store.coreDoc.on('update', update => updates.push(update));
        const task = createFocusTask(store, 'New work', 'project', { now: 100, taskId: 'new', selectionId: 'generation' });
        expect(task.title).toBe('New work');
        expect(readFocusItems(store)[0].taskId).toBe('new');
        expect(updates).toHaveLength(1);
        moveFocusTask(store, 'new', 'up', 'generation');
        expect(readEntity<{ sortOrder: number }>(store.tasks.get('one'))?.sortOrder).toBe(7);
    });

    it('protects a later add from stale removal and retires only completed selection', () => {
        const store = createStore();
        const [first] = addFocusTasks(store, [{ taskId: 'one' }], { now: 100, generateId: () => 'first' });
        expect(removeFocusTask(store, 'one', 'wrong')).toBeNull();
        expect(removeFocusTask(store, 'one', first.selectionId)).toEqual(first);
        const [second] = addFocusTasks(store, [{ taskId: 'one' }], { now: 101, generateId: () => 'second' });
        expect(restoreFocusTask(store, first)).toBe(false);
        expect(removeFocusTask(store, 'one', first.selectionId)).toBeNull();
        expect(readFocusItems(store)[0].selectionId).toBe(second.selectionId);

        (store.tasks.get('one') as Y.Map<unknown>).set('completed', true);
        expect(retireCompletedFocusTasks(store)).toBe(1);
        expect(retireCompletedFocusTasks(store)).toBe(0);
        expect(readFocusItems(store)).toEqual([]);
    });

    it('keeps a concurrent selection as one atomic envelope', () => {
        const store = createStore();
        const [first] = addFocusTasks(store, [{ taskId: 'one' }, { taskId: 'two' }], { now: 100, generateId: () => 'first' });
        const otherDoc = new Y.Doc();
        Y.applyUpdate(otherDoc, Y.encodeStateAsUpdate(store.coreDoc));
        const other = {
            coreDoc: otherDoc,
            tasks: otherDoc.getMap('tasks'),
            projects: otherDoc.getMap('projects'),
            focusItems: otherDoc.getMap('focusItems'),
        } as unknown as YjsStore;
        removeFocusTask(store, 'one', first.selectionId);
        const [second] = addFocusTasks(store, [{ taskId: 'one' }], { now: 200, generateId: () => 'second' });
        moveFocusTask(other, 'one', 'down', first.selectionId);
        Y.applyUpdate(store.coreDoc, Y.encodeStateAsUpdate(otherDoc));
        Y.applyUpdate(otherDoc, Y.encodeStateAsUpdate(store.coreDoc));
        const left = readEntity<{ selectionId: string; addedAt: number }>(store.focusItems.get('one'));
        const right = readEntity<{ selectionId: string; addedAt: number }>(other.focusItems.get('one'));
        expect(left).toEqual(right);
        expect([first, second]).toContainEqual(expect.objectContaining({ selectionId: left?.selectionId, addedAt: left?.addedAt }));
    });
});
