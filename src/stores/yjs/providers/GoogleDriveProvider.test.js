// @ts-nocheck

import * as Y from 'yjs'
import { describe, expect, it, vi } from 'vitest'
import { YjsDriveProvider } from './GoogleDriveProvider.ts'

function objectToYMap(data) {
    const map = new Y.Map()

    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            map.set(key, value)
        }
    })

    return map
}

function createProviderWithCoreDoc(coreDoc) {
    const docManager = {
        getLoadedDocs: () => ['core'],
        getDocSync: (name) => (name === 'core' ? coreDoc : null),
    }

    return new YjsDriveProvider(docManager, 'playwright-access-token')
}

describe('YjsDriveProvider', () => {
    it('pushes queued reconnect changes during manual-mode connect when Drive is empty', async () => {
        const liveDoc = new Y.Doc()
        liveDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Offline edit',
        }))

        const provider = createProviderWithCoreDoc(liveDoc)

        provider.isOnline = () => true
        provider.manifest = {
            load: vi.fn(async () => {}),
            getManifest: vi.fn(() => ({ documents: {} })),
            isDirty: vi.fn(() => false),
            save: vi.fn(async () => {}),
        }
        provider.syncDoc = vi.fn(async () => {})
        provider.subscribeToDoc = vi.fn()

        provider.markDocsForFullStateUpload(['core'])

        await provider.connect('manual')

        expect(provider.syncDoc).toHaveBeenCalledWith('core', false)
        expect(provider.subscribeToDoc).toHaveBeenCalledWith('core')
    })

    it('rejects remote updates that would break validated references', () => {
        const liveDoc = new Y.Doc()

        const remoteDoc = new Y.Doc()
        remoteDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Broken Project',
            preferredClientId: 'missing-client',
        }))

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const provider = createProviderWithCoreDoc(liveDoc)

        const applied = provider.applyValidatedRemoteUpdate(
            'core',
            liveDoc,
            Y.encodeStateAsUpdate(remoteDoc),
            'test invalid state',
        )

        expect(applied).toBe(false)
        expect(liveDoc.getMap('projects').get('project-1')).toBeUndefined()
        expect(warnSpy).toHaveBeenCalled()

        warnSpy.mockRestore()
    })

    it('applies remote updates that keep the projected state valid', () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        const remoteDoc = new Y.Doc()
        remoteDoc.getMap('clients').set('client-1', objectToYMap({
            id: 'client-1',
            title: 'Client One',
        }))
        remoteDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Valid Project',
            preferredClientId: 'client-1',
        }))

        const applied = provider.applyValidatedRemoteUpdate(
            'core',
            liveDoc,
            Y.encodeStateAsUpdate(remoteDoc),
            'test valid state',
        )

        expect(applied).toBe(true)
        expect(liveDoc.getMap('projects').get('project-1').get('preferredClientId')).toBe('client-1')
    })

    it('migrates remote legacy invoices before validating project invoice references', () => {
        const liveDoc = new Y.Doc()
        const provider = createProviderWithCoreDoc(liveDoc)

        const remoteDoc = new Y.Doc()
        remoteDoc.getMap('projects').set('project-1', objectToYMap({
            id: 'project-1',
            title: 'Valid Project',
            invoiceIds: ['invoice-1'],
        }))
        remoteDoc.getMap('clients').set('client-1', objectToYMap({
            id: 'client-1',
            title: 'Client One',
        }))
        remoteDoc.getMap('invoices').set('invoice-1', objectToYMap({
            id: 'invoice-1',
            projectId: 'project-1',
            clientId: 'client-1',
            invoiceNumber: 'INV-001',
            date: '2026-04-08',
            status: 'sent',
            subtotal: 225,
            total: 225,
            tasks: [
                { id: 'task-1', title: 'Consulting', hours: 2, hourlyRate: 100 },
            ],
            expenseItems: [
                { id: 'expense-1', title: 'Travel', amount: 25 },
            ],
        }))

        const applied = provider.applyValidatedRemoteUpdate(
            'core',
            liveDoc,
            Y.encodeStateAsUpdate(remoteDoc),
            'test legacy invoice state',
        )

        expect(applied).toBe(true)
        expect(liveDoc.getMap('projects').get('project-1').get('invoiceIds')).toEqual(['invoice-1'])
        expect(liveDoc.getMap('invoices').get('invoice-1').get('items')).toEqual([
            {
                description: 'Travel',
                quantity: 1,
                rate: 25,
                amount: 25,
                expenseId: 'expense-1',
                supplierName: null,
                originalAmount: undefined,
                originalCurrency: undefined,
                exchangeRate: undefined,
            },
            {
                description: 'Consulting',
                quantity: 2,
                rate: 100,
                amount: 200,
                taskId: 'task-1',
            }
        ])
    })
})