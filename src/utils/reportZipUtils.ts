import { strToU8, zipSync } from 'fflate';

export type ZipDownloadFile = {
    content: Blob | Uint8Array | string;
    filename: string;
};

const blobToUint8Array = async (blob: Blob) => {
    if (typeof blob.arrayBuffer === 'function') {
        return new Uint8Array(await blob.arrayBuffer());
    }

    return new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve(new Uint8Array(reader.result as ArrayBuffer));
        };
        reader.onerror = () => reject(reader.error || new Error('Failed to read zip file content'));
        reader.readAsArrayBuffer(blob);
    });
};

const normalizeZipContent = async (content: ZipDownloadFile['content']) => {
    if (typeof content === 'string') {
        return strToU8(content);
    }

    if (content instanceof Uint8Array) {
        return content;
    }

    return blobToUint8Array(content);
};

export const createZipData = async (files: ZipDownloadFile[]) => {
    const entries = await Promise.all(files.map(async (file) => {
        return [file.filename, await normalizeZipContent(file.content)] as const;
    }));

    return zipSync(Object.fromEntries(entries));
};

export const createZipBlob = async (files: ZipDownloadFile[]) => {
    const archive = await createZipData(files);
    return new Blob([archive], { type: 'application/zip' });
};

export const downloadBlobFile = (filename: string, blob: Blob) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

export const downloadZipFile = async (filename: string, files: ZipDownloadFile[]) => {
    const blob = await createZipBlob(files);
    downloadBlobFile(filename, blob);
};
