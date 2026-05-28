import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useYjsCollection } from './useYjsCollection';
import { useBusinessBrandAssets } from './useBusinessBrandAssets';

vi.mock('./useYjsCollection', () => ({ useYjsCollection: vi.fn() }));

const mockUseYjsCollection = useYjsCollection;

describe('useBusinessBrandAssets', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns raw and active business brand assets', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'asset-1', businessInfoId: 'biz-1', contentHash: 'hash-1' },
                { id: 'asset-2', businessInfoId: 'biz-1', contentHash: 'hash-2', archivedAt: 123 },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        });

        const { result } = renderHook(() => useBusinessBrandAssets());

        expect(result.current.businessBrandAssets).toHaveLength(2);
        expect(result.current.activeBusinessBrandAssets).toEqual([
            { id: 'asset-1', businessInfoId: 'biz-1', contentHash: 'hash-1' },
        ]);
        expect(result.current.isLoading).toBe(false);
    });

    it('gets assets for a business with and without archived records', () => {
        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'asset-1', businessInfoId: 'biz-1', contentHash: 'hash-1' },
                { id: 'asset-2', businessInfoId: 'biz-1', contentHash: 'hash-2', archivedAt: 123 },
                { id: 'asset-3', businessInfoId: 'biz-2', contentHash: 'hash-3' },
            ],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        });

        const { result } = renderHook(() => useBusinessBrandAssets());

        expect(result.current.getAssetsForBusiness('biz-1')).toEqual([
            { id: 'asset-1', businessInfoId: 'biz-1', contentHash: 'hash-1' },
        ]);
        expect(result.current.getAssetsForBusiness('biz-1', { includeArchived: true })).toEqual([
            { id: 'asset-1', businessInfoId: 'biz-1', contentHash: 'hash-1' },
            { id: 'asset-2', businessInfoId: 'biz-1', contentHash: 'hash-2', archivedAt: 123 },
        ]);
    });

    it('gets a business brand asset by id and finds one by content hash', () => {
        const get = vi.fn((id) => ({ id, businessInfoId: 'biz-1', contentHash: 'hash-1' }));

        mockUseYjsCollection.mockReturnValue({
            items: [
                { id: 'asset-1', businessInfoId: 'biz-1', contentHash: 'hash-1' },
                { id: 'asset-2', businessInfoId: 'biz-2', contentHash: 'hash-2' },
            ],
            isLoading: false,
            get,
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        });

        const { result } = renderHook(() => useBusinessBrandAssets());

        expect(result.current.getBusinessBrandAsset('asset-1')).toEqual({ id: 'asset-1', businessInfoId: 'biz-1', contentHash: 'hash-1' });
        expect(get).toHaveBeenCalledWith('asset-1');
        expect(result.current.findLogoAssetByHash('biz-2', 'hash-2')).toEqual({ id: 'asset-2', businessInfoId: 'biz-2', contentHash: 'hash-2' });
        expect(result.current.findLogoAssetByHash('biz-2', 'missing')).toBeUndefined();
    });

    it('creates business brand assets through the collection helper', () => {
        const create = vi.fn((data) => ({ id: 'asset-new', ...data }));

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(),
            create,
            update: vi.fn(),
            remove: vi.fn(),
        });

        const { result } = renderHook(() => useBusinessBrandAssets());

        act(() => {
            result.current.createBusinessBrandAsset({
                businessInfoId: 'biz-1',
                kind: 'logo',
                dataUrl: 'data:image/png;base64,AAAA',
                mimeType: 'image/png',
                width: 120,
                height: 40,
                byteSize: 4,
                contentHash: 'hash-1',
            });
        });

        expect(create).toHaveBeenCalledWith(expect.objectContaining({
            businessInfoId: 'biz-1',
            kind: 'logo',
            contentHash: 'hash-1',
        }));
    });

    it('exposes update and delete helpers from the collection', () => {
        const update = vi.fn();
        const remove = vi.fn();

        mockUseYjsCollection.mockReturnValue({
            items: [],
            isLoading: false,
            get: vi.fn(),
            create: vi.fn(),
            update,
            remove,
        });

        const { result } = renderHook(() => useBusinessBrandAssets());

        act(() => {
            result.current.updateBusinessBrandAsset('asset-1', { archivedAt: 123 });
            result.current.deleteBusinessBrandAsset('asset-1');
        });

        expect(update).toHaveBeenCalledWith('asset-1', { archivedAt: 123 });
        expect(remove).toHaveBeenCalledWith('asset-1');
    });
});