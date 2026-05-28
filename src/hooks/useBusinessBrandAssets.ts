import { useCallback, useMemo } from 'react';

import { useYjsCollection } from './useYjsCollection';
import type { BusinessBrandAsset } from '@/stores/yjs/types';

type CreateBusinessBrandAssetInput = Omit<BusinessBrandAsset, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'> & {
    createdAt?: number;
    updatedAt?: number | null;
    archivedAt?: number | null;
};

export function useBusinessBrandAssets() {
    const { items, isLoading, get, create, update, remove } = useYjsCollection<BusinessBrandAsset>(
        (store) => store.businessBrandAssets,
        { collectionName: 'businessBrandAssets' }
    );

    const activeAssets = useMemo(
        () => items.filter((asset) => !asset.archivedAt),
        [items]
    );

    const getBusinessBrandAsset = useCallback((id: string) => get(id), [get]);

    const getAssetsForBusiness = useCallback((businessInfoId: string, options?: { includeArchived?: boolean }) => {
        const source = options?.includeArchived ? items : activeAssets;
        return source.filter((asset) => asset.businessInfoId === businessInfoId);
    }, [activeAssets, items]);

    const findLogoAssetByHash = useCallback((businessInfoId: string, contentHash: string) => {
        return items.find((asset) => asset.businessInfoId === businessInfoId && asset.contentHash === contentHash);
    }, [items]);

    const createBusinessBrandAsset = useCallback((data: CreateBusinessBrandAssetInput) => {
        return create(data as Omit<BusinessBrandAsset, 'id'> & { id?: string });
    }, [create]);

    return {
        businessBrandAssets: items,
        activeBusinessBrandAssets: activeAssets,
        isLoading,
        getBusinessBrandAsset,
        getAssetsForBusiness,
        findLogoAssetByHash,
        createBusinessBrandAsset,
        updateBusinessBrandAsset: update,
        deleteBusinessBrandAsset: remove,
    };
}