import DOMPurify from 'dompurify';

import type { BrandAssetMimeType, BusinessBrandAsset } from '@/stores/yjs/types';

export const BRAND_LOGO_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const BRAND_LOGO_MAX_STORED_BYTES = 250 * 1024;
export const BRAND_LOGO_TARGET_MAX_WIDTH = 800;
export const BRAND_LOGO_TARGET_MAX_HEIGHT = 240;

const SUPPORTED_LOGO_MIME_TYPES: BrandAssetMimeType[] = [
    'image/svg+xml',
    'image/png',
    'image/jpeg',
    'image/webp',
];

type PreparedBusinessBrandAsset = Omit<BusinessBrandAsset, 'id' | 'businessInfoId' | 'createdAt' | 'updatedAt' | 'archivedAt'>;

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function fileToText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Unable to read the selected file.'));
        reader.readAsText(file);
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Unable to decode the selected image.'));
        image.src = src;
    });
}

function getDataUrlByteSize(dataUrl: string): number {
    const separatorIndex = dataUrl.indexOf(',');

    if (separatorIndex === -1) {
        return 0;
    }

    const metadata = dataUrl.slice(0, separatorIndex);
    const payload = dataUrl.slice(separatorIndex + 1);

    if (metadata.includes(';base64')) {
        const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
        return Math.floor((payload.length * 3) / 4) - padding;
    }

    return new TextEncoder().encode(decodeURIComponent(payload)).length;
}

async function hashDataUrl(dataUrl: string): Promise<string> {
    const separatorIndex = dataUrl.indexOf(',');

    if (separatorIndex === -1) {
        return `${dataUrl.length}`;
    }

    const metadata = dataUrl.slice(0, separatorIndex);
    const payload = dataUrl.slice(separatorIndex + 1);
    let bytes: Uint8Array;

    if (metadata.includes(';base64')) {
        const binary = atob(payload);
        bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
    } else {
        bytes = new TextEncoder().encode(decodeURIComponent(payload));
    }

    if (!crypto?.subtle) {
        return `${bytes.length}`;
    }

    const hashBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(hashBuffer).set(bytes);

    const digest = await crypto.subtle.digest('SHA-256', hashBuffer);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function encodeSvgDataUrl(svgMarkup: string): string {
    const utf8 = unescape(encodeURIComponent(svgMarkup));
    const base64 = btoa(utf8);
    return `data:image/svg+xml;base64,${base64}`;
}

function sanitizeSvgMarkup(svgMarkup: string): string {
    const sanitized = DOMPurify.sanitize(svgMarkup, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ['script', 'foreignObject'],
        FORBID_ATTR: ['onload', 'onclick', 'onerror'],
    });

    if (!sanitized.includes('<svg')) {
        throw new Error('The selected SVG is not valid after sanitization.');
    }

    return sanitized;
}

function getScaledDimensions(width: number, height: number) {
    if (width <= BRAND_LOGO_TARGET_MAX_WIDTH && height <= BRAND_LOGO_TARGET_MAX_HEIGHT) {
        return { width, height };
    }

    const ratio = Math.min(
        BRAND_LOGO_TARGET_MAX_WIDTH / width,
        BRAND_LOGO_TARGET_MAX_HEIGHT / height,
    );

    return {
        width: Math.max(1, Math.round(width * ratio)),
        height: Math.max(1, Math.round(height * ratio)),
    };
}

function canvasToDataUrl(canvas: HTMLCanvasElement, mimeType: BrandAssetMimeType, quality?: number): string {
    return canvas.toDataURL(mimeType, quality);
}

async function prepareSvgLogo(file: File): Promise<PreparedBusinessBrandAsset> {
    const rawSvg = await fileToText(file);
    const sanitizedSvg = sanitizeSvgMarkup(rawSvg);
    const dataUrl = encodeSvgDataUrl(sanitizedSvg);
    const image = await loadImage(dataUrl);
    const byteSize = getDataUrlByteSize(dataUrl);

    if (byteSize > BRAND_LOGO_MAX_STORED_BYTES) {
        throw new Error('The processed logo is still too large. Please use a simpler SVG.');
    }

    return {
        kind: 'logo',
        dataUrl,
        mimeType: 'image/svg+xml',
        fileName: file.name || null,
        width: image.naturalWidth || BRAND_LOGO_TARGET_MAX_WIDTH,
        height: image.naturalHeight || BRAND_LOGO_TARGET_MAX_HEIGHT,
        byteSize,
        contentHash: await hashDataUrl(dataUrl),
    };
}

async function prepareRasterLogo(file: File): Promise<PreparedBusinessBrandAsset> {
    const objectUrl = URL.createObjectURL(file);

    try {
        const image = await loadImage(objectUrl);
        const { width, height } = getScaledDimensions(image.naturalWidth, image.naturalHeight);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error('Unable to process the selected image.');
        }

        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0, width, height);

        const preferredMimeType: BrandAssetMimeType = 'image/webp';
        let dataUrl = canvasToDataUrl(canvas, preferredMimeType, 0.92);
        let mimeType: BrandAssetMimeType = dataUrl.startsWith('data:image/webp')
            ? 'image/webp'
            : file.type === 'image/jpeg'
                ? 'image/jpeg'
                : 'image/png';

        if (mimeType !== 'image/webp') {
            dataUrl = canvasToDataUrl(canvas, mimeType, mimeType === 'image/jpeg' ? 0.9 : undefined);
        }

        let byteSize = getDataUrlByteSize(dataUrl);

        if (byteSize > BRAND_LOGO_MAX_STORED_BYTES && mimeType !== 'image/png') {
            for (const quality of [0.82, 0.72, 0.62, 0.52]) {
                dataUrl = canvasToDataUrl(canvas, mimeType, quality);
                byteSize = getDataUrlByteSize(dataUrl);

                if (byteSize <= BRAND_LOGO_MAX_STORED_BYTES) {
                    break;
                }
            }
        }

        if (byteSize > BRAND_LOGO_MAX_STORED_BYTES) {
            throw new Error('The processed logo is still too large. Please use a smaller image.');
        }

        return {
            kind: 'logo',
            dataUrl,
            mimeType,
            fileName: file.name || null,
            width,
            height,
            byteSize,
            contentHash: await hashDataUrl(dataUrl),
        };
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

export function normalizeBrandColor(value: string | null | undefined): string | null {
    const trimmed = value?.trim();

    if (!trimmed) {
        return null;
    }

    const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;

    if (!HEX_COLOR_REGEX.test(normalized)) {
        return null;
    }

    if (normalized.length === 4) {
        return `#${normalized.slice(1).split('').map((part) => `${part}${part}`).join('').toLowerCase()}`;
    }

    return normalized.toLowerCase();
}

export function isSupportedLogoMimeType(mimeType: string | null | undefined): mimeType is BrandAssetMimeType {
    return Boolean(mimeType && SUPPORTED_LOGO_MIME_TYPES.includes(mimeType as BrandAssetMimeType));
}

export async function prepareBusinessLogoAsset(file: File): Promise<PreparedBusinessBrandAsset> {
    if (!isSupportedLogoMimeType(file.type)) {
        throw new Error('Please upload an SVG, PNG, JPEG, or WebP logo.');
    }

    if (file.size > BRAND_LOGO_MAX_FILE_SIZE_BYTES) {
        throw new Error('The selected logo is too large. Please choose a file smaller than 5 MB.');
    }

    if (file.type === 'image/svg+xml') {
        return prepareSvgLogo(file);
    }

    return prepareRasterLogo(file);
}

export type { PreparedBusinessBrandAsset };