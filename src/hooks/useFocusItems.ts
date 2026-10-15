import { useCallback } from 'react';
import { useYjs } from '@/contexts/YjsContext';
import { useYjsCollection } from './useYjsCollection';
import type { FocusItem } from '@/stores/yjs/types';
import {
    addFocusTasks,
    createFocusTask,
    moveFocusTask,
    readFocusItems,
    removeFocusTask,
    restoreFocusTask,
    type FocusSelectionInput,
} from '@/stores/yjs/focusOperations';

const getFocusMap = (store: ReturnType<typeof useYjs>['store']) => store.focusItems;

/** Reactive Focus selections; task and project details stay in their canonical collections. */
export function useFocusItems() {
    const { store } = useYjs();
    const { isLoading } = useYjsCollection<FocusItem>(getFocusMap, { collectionName: 'focusItems' });
    const validItems = isLoading ? [] : readFocusItems(store);
    return {
        items: validItems,
        invalidCount: isLoading ? 0 : Math.max(0, store.focusItems.size - validItems.length),
        isLoading,
        add: useCallback((selection: FocusSelectionInput[]) => addFocusTasks(store, selection), [store]),
        create: useCallback((title: string, projectId?: string | null) => createFocusTask(store, title, projectId), [store]),
        remove: useCallback((taskId: string, selectionId: string) => removeFocusTask(store, taskId, selectionId), [store]),
        restore: useCallback((item: FocusItem) => restoreFocusTask(store, item), [store]),
        move: useCallback((taskId: string, direction: 'up' | 'down', selectionId: string) => moveFocusTask(store, taskId, direction, selectionId), [store]),
    };
}
