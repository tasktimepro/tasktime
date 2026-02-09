import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the Yjs collection hook
const mockAttachments = vi.hoisted(() => []);
const mockCreate = vi.fn((data) => ({ id: 'new-id', ...data }));
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

vi.mock('./useYjsCollection', () => ({
    useYjsCollection: () => ({
        items: mockAttachments,
        create: mockCreate,
        update: mockUpdate,
        remove: mockRemove,
        isLoading: false,
    })
}));

// Import after mocks
import { usePlannerAttachments } from './usePlannerAttachments';

describe('usePlannerAttachments', () => {

    beforeEach(() => {
        mockAttachments.length = 0;
        mockCreate.mockClear();
        mockUpdate.mockClear();
        mockRemove.mockClear();
    });

    it('returns attachments array', () => {
        const { result } = renderHook(() => usePlannerAttachments());

        expect(Array.isArray(result.current.attachments)).toBe(true);
    });

    it('getForDate returns static attachments created before the date', () => {
        const jan30 = new Date('2026-01-30').getTime();
        mockAttachments.push(
            { id: '1', type: 'client', referenceId: 'c1', mode: 'static', date: null, createdAt: jan30 - 100000 },
            { id: '2', type: 'project', referenceId: 'p1', mode: 'date', date: '2026-01-30', createdAt: jan30 },
        );

        const { result } = renderHook(() => usePlannerAttachments());

        const forDate = result.current.getForDate('2026-01-30');
        expect(forDate).toHaveLength(2);
    });

    it('getForDate filters date-specific attachments', () => {
        const jan30 = new Date('2026-01-30').getTime();
        mockAttachments.push(
            { id: '1', type: 'client', referenceId: 'c1', mode: 'static', date: null, createdAt: jan30 - 100000 },
            { id: '2', type: 'project', referenceId: 'p1', mode: 'date', date: '2026-01-30', createdAt: jan30 },
            { id: '3', type: 'project', referenceId: 'p2', mode: 'date', date: '2026-01-31', createdAt: jan30 },
        );

        const { result } = renderHook(() => usePlannerAttachments());

        const forJan30 = result.current.getForDate('2026-01-30');
        expect(forJan30).toHaveLength(2); // static + 01-30

        const forJan31 = result.current.getForDate('2026-01-31');
        expect(forJan31).toHaveLength(2); // static + 01-31
    });

    it('getForDate includes weekday attachments on matching days', () => {
        const monday = new Date('2026-02-02');
        const mondayStr = '2026-02-02';
        const mondayMs = monday.getTime();
        mockAttachments.push(
            { id: '1', type: 'client', referenceId: 'c1', mode: 'weekday', weekday: 1, createdAt: mondayMs },
            { id: '2', type: 'client', referenceId: 'c2', mode: 'weekday', weekday: 2, createdAt: mondayMs }
        );

        const { result } = renderHook(() => usePlannerAttachments());

        const forMonday = result.current.getForDate(mondayStr);
        expect(forMonday).toHaveLength(1);
        expect(forMonday[0].id).toBe('1');
    });

    it('staticAttachments returns only static attachments', () => {
        const jan30 = new Date('2026-01-30').getTime();
        mockAttachments.push(
            { id: '1', type: 'client', referenceId: 'c1', mode: 'static', date: null, createdAt: jan30 },
            { id: '2', type: 'project', referenceId: 'p1', mode: 'date', date: '2026-01-30', createdAt: jan30 },
        );

        const { result } = renderHook(() => usePlannerAttachments());

        const staticOnly = result.current.staticAttachments;
        expect(staticOnly).toHaveLength(1);
        expect(staticOnly[0].mode).toBe('static');
    });

    it('createAttachment calls create with correct data', () => {
        const { result } = renderHook(() => usePlannerAttachments());

        act(() => {
            result.current.createAttachment({
                type: 'client',
                referenceId: 'c1',
                mode: 'static',
            });
        });

        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            type: 'client',
            referenceId: 'c1',
            mode: 'static',
        }));
    });

    it('deleteByReference removes matching attachments', () => {
        mockAttachments.push(
            { id: '1', type: 'client', referenceId: 'c1', mode: 'static' },
            { id: '2', type: 'client', referenceId: 'c1', mode: 'date', date: '2026-01-30' },
            { id: '3', type: 'project', referenceId: 'p1', mode: 'date', date: '2026-01-30' },
        );

        const { result } = renderHook(() => usePlannerAttachments());

        act(() => {
            result.current.deleteByReference('c1');
        });

        expect(mockRemove).toHaveBeenCalledTimes(2);
        expect(mockRemove).toHaveBeenCalledWith('1');
        expect(mockRemove).toHaveBeenCalledWith('2');
    });

    it('isAttached returns true for existing attachments', () => {
        mockAttachments.push(
            { id: '1', type: 'client', referenceId: 'c1', mode: 'static' },
        );

        const { result } = renderHook(() => usePlannerAttachments());

        expect(result.current.isAttached('client', 'c1')).toBe(true);
        expect(result.current.isAttached('client', 'c2')).toBe(false);
    });

    it('isAttached matches date and weekday options', () => {
        mockAttachments.push(
            { id: '1', type: 'task', referenceId: 't1', mode: 'date', date: '2026-02-02' },
            { id: '2', type: 'task', referenceId: 't1', mode: 'weekday', weekday: 1 },
        );

        const { result } = renderHook(() => usePlannerAttachments());

        expect(result.current.isAttached('task', 't1', { date: '2026-02-02' })).toBe(true);
        expect(result.current.isAttached('task', 't1', { weekday: 1 })).toBe(true);
        expect(result.current.isAttached('task', 't1', { date: '2026-02-03' })).toBe(false);
    });
});
