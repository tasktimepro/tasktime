import * as Y from 'yjs';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { YjsStore } from '@/stores/yjs/YjsStore';
import type { FocusItem } from '@/stores/yjs/types';
import { objectToYMap } from '@/stores/yjs/entityUtils';
import { useFocusItems } from './useFocusItems';

const coreDoc = new Y.Doc();
const store = {
    coreDoc,
    tasks: coreDoc.getMap('tasks'),
    projects: coreDoc.getMap('projects'),
    focusItems: coreDoc.getMap('focusItems'),
    archivedTasks: null,
} as unknown as YjsStore;

const readiness = vi.hoisted(() => ({ isReady: true }));
vi.mock('@/contexts/YjsContext', () => ({ useYjs: () => ({ store, isReady: readiness.isReady }) }));

describe('useFocusItems', () => {
    it('keeps reactive selections through add, reorder, remove and restore', async () => {
        store.tasks.clear();
        store.projects.clear();
        store.focusItems.clear();
        store.projects.set('focus-project', objectToYMap({ id: 'focus-project', title: 'Project' }) as any);
        store.tasks.set('one', objectToYMap({ id: 'one', title: 'One', projectId: 'focus-project' }) as any);
        store.tasks.set('two', objectToYMap({ id: 'two', title: 'Two', projectId: 'focus-project' }) as any);
        const { result } = renderHook(() => useFocusItems());
        act(() => { result.current.add([{ taskId: 'one' }, { taskId: 'two' }]); });
        await waitFor(() => expect(result.current.items).toHaveLength(2));
        const second = result.current.items.find(item => item.taskId === 'two')!;
        act(() => { result.current.move('two', 'up', second.selectionId); });
        await waitFor(() => expect(result.current.items.find(item => item.taskId === 'two')?.position).toBe(1));
        const first = result.current.items.find(item => item.taskId === 'one')!;
        let removed: FocusItem | null = null;
        act(() => { removed = result.current.remove('one', first.selectionId); });
        await waitFor(() => expect(result.current.items).toHaveLength(1));
        act(() => { expect(result.current.restore(removed!)).toBe(true); });
        await waitFor(() => expect(result.current.items).toHaveLength(2));
    });

    it('creates a task and selection together', async () => {
        const { result } = renderHook(() => useFocusItems());
        let taskId = '';
        act(() => { taskId = result.current.create('New Focus work').id; });
        await waitFor(() => expect(result.current.items.some(item => item.taskId === taskId)).toBe(true));
    });

    it('keeps a malformed map key out of the list and reports retained data', async () => {
        store.focusItems.clear();
        const { result } = renderHook(() => useFocusItems());
        act(() => {
            store.focusItems.set('wrong-key', { id: 'one', taskId: 'one', selectionId: 'old', position: 1, addedAt: 100 });
        });
        await waitFor(() => expect(result.current.invalidCount).toBe(1));
        expect(result.current.items).toEqual([]);
        expect(store.focusItems.has('wrong-key')).toBe(true);
    });

    it('shows loading without reading retained selections before the store is ready', () => {
        readiness.isReady = false;
        try {
            const { result, unmount } = renderHook(() => useFocusItems());
            expect(result.current.isLoading).toBe(true);
            expect(result.current.items).toEqual([]);
            expect(result.current.invalidCount).toBe(0);
            unmount();
        } finally {
            readiness.isReady = true;
        }
    });
});
