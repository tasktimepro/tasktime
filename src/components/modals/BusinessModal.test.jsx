import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BusinessModal from './BusinessModal';

const toastMocks = vi.hoisted(() => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
}));

const businessInfoMocks = vi.hoisted(() => ({
    createBusinessInfo: vi.fn(),
    updateBusinessInfo: vi.fn(),
    setDefault: vi.fn(),
}));

const businessBrandAssetMocks = vi.hoisted(() => ({
    createBusinessBrandAsset: vi.fn(),
    deleteBusinessBrandAsset: vi.fn(),
    findLogoAssetByHash: vi.fn(),
    getAssetsForBusiness: vi.fn(),
    getBusinessBrandAsset: vi.fn(),
}));

const yjsMocks = vi.hoisted(() => {
    const invoicesMap = {};
    const archivedInvoicesSync = {};

    return {
        store: {
            invoices: invoicesMap,
            archivedInvoicesSync,
        },
        loadArchivedInvoices: vi.fn().mockResolvedValue(undefined),
        invoicesMap,
        archivedInvoicesSync,
    };
});

const entityState = vi.hoisted(() => ({
    activeInvoices: [],
    archivedInvoices: [],
}));

const brandingUtilsMocks = vi.hoisted(() => ({
    prepareBusinessLogoAsset: vi.fn(),
}));

vi.mock('../../hooks/useToast.ts', () => ({
    useToast: () => toastMocks,
}));

vi.mock('../../hooks/useBusinessInfos.ts', () => ({
    useBusinessInfos: () => businessInfoMocks,
}));

vi.mock('../../hooks/useBusinessBrandAssets.ts', () => ({
    useBusinessBrandAssets: () => businessBrandAssetMocks,
}));

vi.mock('@/contexts/YjsContext', () => ({
    useYjs: () => ({
        store: yjsMocks.store,
        loadArchivedInvoices: yjsMocks.loadArchivedInvoices,
    }),
}));

vi.mock('@/stores/yjs/entityUtils', () => ({
    collectEntities: vi.fn((source) => {
        if (source === yjsMocks.store.invoices) {
            return entityState.activeInvoices;
        }

        if (source === yjsMocks.store.archivedInvoicesSync) {
            return entityState.archivedInvoices;
        }

        return [];
    }),
}));

vi.mock('@/utils/businessBranding.ts', async () => {
    const actual = await vi.importActual('@/utils/businessBranding.ts');

    return {
        ...actual,
        prepareBusinessLogoAsset: brandingUtilsMocks.prepareBusinessLogoAsset,
    };
});

describe('BusinessModal', () => {
    const editingBusinessInfo = {
        id: 'business-1',
        title: 'Self Employment',
        businessName: 'Owen Farrugia',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        country: '',
        registrationNumber: '',
        vat: '',
        taxNumber: '',
        custom: [],
        isDefault: true,
        taxEnabled: false,
        taxLabel: 'VAT',
        taxRate: 0,
        branding: {
            primaryColor: '#1f2937',
            logoAssetId: 'logo-old',
        },
    };

    const preparedLogoAsset = {
        kind: 'logo',
        dataUrl: 'data:image/webp;base64,BBBB',
        mimeType: 'image/webp',
        fileName: 'new-logo.png',
        width: 240,
        height: 120,
        byteSize: 2048,
        contentHash: 'logo-hash-new',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        entityState.activeInvoices = [];
        entityState.archivedInvoices = [];

        businessBrandAssetMocks.getBusinessBrandAsset.mockImplementation((id) => {
            if (id !== 'logo-old') {
                return null;
            }

            return {
                id: 'logo-old',
                fileName: 'old-logo.png',
                dataUrl: 'data:image/webp;base64,AAAA',
            };
        });
        businessBrandAssetMocks.getAssetsForBusiness.mockReturnValue([
            {
                id: 'logo-old',
                businessInfoId: 'business-1',
                kind: 'logo',
            },
            {
                id: 'logo-new',
                businessInfoId: 'business-1',
                kind: 'logo',
            },
        ]);
        businessBrandAssetMocks.findLogoAssetByHash.mockReturnValue(null);
        businessBrandAssetMocks.createBusinessBrandAsset.mockReturnValue({
            id: 'logo-new',
            businessInfoId: 'business-1',
            ...preparedLogoAsset,
        });
        brandingUtilsMocks.prepareBusinessLogoAsset.mockResolvedValue(preparedLogoAsset);

        if (!HTMLElement.prototype.scrollIntoView) {
            HTMLElement.prototype.scrollIntoView = vi.fn();
        }
    });

    it('deletes the previous logo asset when replacing it and no invoice references it', async () => {
        const user = userEvent.setup();

        render(
            <BusinessModal
                isOpen={true}
                onClose={vi.fn()}
                editingBusinessInfo={editingBusinessInfo}
            />
        );

        await user.click(screen.getByRole('button', { name: 'Branding' }));
        await user.upload(
            screen.getByLabelText('Logo'),
            new File(['new logo'], 'new-logo.png', { type: 'image/png' })
        );
        await user.click(screen.getByRole('button', { name: 'Update Business' }));

        await waitFor(() => {
            expect(businessInfoMocks.updateBusinessInfo).toHaveBeenCalledWith('business-1', expect.objectContaining({
                branding: expect.objectContaining({
                    primaryColor: '#1f2937',
                    logoAssetId: 'logo-new',
                }),
            }));
        });

        expect(yjsMocks.loadArchivedInvoices).toHaveBeenCalledTimes(1);
        expect(businessBrandAssetMocks.deleteBusinessBrandAsset).toHaveBeenCalledWith('logo-old');
    });

    it('keeps the previous logo asset when an invoice snapshot still references it', async () => {
        const user = userEvent.setup();

        entityState.archivedInvoices = [{
            id: 'invoice-1',
            brandingSnapshot: {
                logoAssetId: 'logo-old',
            },
        }];

        render(
            <BusinessModal
                isOpen={true}
                onClose={vi.fn()}
                editingBusinessInfo={editingBusinessInfo}
            />
        );

        await user.click(screen.getByRole('button', { name: 'Branding' }));
        await user.upload(
            screen.getByLabelText('Logo'),
            new File(['new logo'], 'new-logo.png', { type: 'image/png' })
        );
        await user.click(screen.getByRole('button', { name: 'Update Business' }));

        await waitFor(() => {
            expect(businessInfoMocks.updateBusinessInfo).toHaveBeenCalledTimes(1);
        });

        expect(businessBrandAssetMocks.deleteBusinessBrandAsset).not.toHaveBeenCalled();
    });
});