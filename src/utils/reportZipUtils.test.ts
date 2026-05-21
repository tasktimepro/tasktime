import { describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { createZipBlob, createZipData, downloadBlobFile, downloadZipFile } from './reportZipUtils';

const readBlob = (blob: Blob) => {
    return new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });
};

describe('reportZipUtils', () => {
    it('creates zip data from text and binary files', async () => {
        const zipData = await createZipData([
            { filename: 'alpha.txt', content: 'Hello world' },
            { filename: 'beta.bin', content: new Uint8Array([1, 2, 3]) },
        ]);

        const archive = unzipSync(zipData);

        expect(strFromU8(archive['alpha.txt'])).toBe('Hello world');
        expect(Array.from(archive['beta.bin'])).toEqual([1, 2, 3]);
    });

    it('creates zip blobs from browser Blob inputs', async () => {
        const zipBlob = await createZipBlob([
            { filename: 'receipt.txt', content: new Blob(['Receipt data'], { type: 'text/plain' }) },
        ]);
        const archive = unzipSync(await readBlob(zipBlob));

        expect(zipBlob.type).toBe('application/zip');
        expect(strFromU8(archive['receipt.txt'])).toBe('Receipt data');
    });

    it('uses arrayBuffer when the Blob implementation provides it', async () => {
        const modernBlob = new Blob(['ignored']);
        const arrayBuffer = new TextEncoder().encode('Modern data').buffer;
        Object.defineProperty(modernBlob, 'arrayBuffer', {
            value: vi.fn(() => Promise.resolve(arrayBuffer)),
        });

        const zipData = await createZipData([
            { filename: 'modern.txt', content: modernBlob },
        ]);
        const archive = unzipSync(zipData);

        expect(modernBlob.arrayBuffer).toHaveBeenCalled();
        expect(strFromU8(archive['modern.txt'])).toBe('Modern data');
    });

    it('downloads a blob file through an object url', () => {
        const appendChildSpy = vi.spyOn(document.body, 'appendChild');
        const removeChildSpy = vi.spyOn(document.body, 'removeChild');
        const link = document.createElement('a');
        const clickSpy = vi.spyOn(link, 'click').mockImplementation(() => {});
        const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(link);
        const createObjectUrlSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:report');
        const revokeObjectUrlSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

        downloadBlobFile('pack.zip', new Blob(['data'], { type: 'application/zip' }));

        expect(createObjectUrlSpy).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
        expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:report');

        appendChildSpy.mockRestore();
        removeChildSpy.mockRestore();
        createElementSpy.mockRestore();
        createObjectUrlSpy.mockRestore();
        revokeObjectUrlSpy.mockRestore();
        clickSpy.mockRestore();
    });

    it('downloads a zip file after creating the archive blob', async () => {
        const link = document.createElement('a');
        const clickSpy = vi.spyOn(link, 'click').mockImplementation(() => {});
        const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(link);
        const createObjectUrlSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:zip-report');
        const revokeObjectUrlSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

        await downloadZipFile('reports.zip', [
            { filename: 'report.csv', content: 'value' },
        ]);

        expect(link.getAttribute('download')).toBe('reports.zip');
        expect(clickSpy).toHaveBeenCalled();
        expect(createObjectUrlSpy).toHaveBeenCalledWith(expect.any(Blob));
        expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:zip-report');

        createElementSpy.mockRestore();
        createObjectUrlSpy.mockRestore();
        revokeObjectUrlSpy.mockRestore();
        clickSpy.mockRestore();
    });
});
