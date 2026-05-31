import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DOMPurify from 'dompurify';

import {
    BRAND_LOGO_MAX_FILE_SIZE_BYTES,
    BRAND_LOGO_TARGET_MAX_HEIGHT,
    BRAND_LOGO_TARGET_MAX_WIDTH,
    isSupportedLogoMimeType,
    normalizeBrandColor,
    prepareBusinessLogoAsset,
} from './businessBranding';

vi.mock('dompurify', () => ({
    default: {
        sanitize: vi.fn((markup) => markup),
    },
}));

const sanitizeMock = DOMPurify.sanitize;
const originalCreateElement = document.createElement.bind(document);
const originalFileReader = globalThis.FileReader;
const originalImage = globalThis.Image;
const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

const makeDataUrl = (mimeType, content) => `data:${mimeType};base64,${Buffer.from(content).toString('base64')}`;

let canvasContext;
let canvasToDataUrl;
let imageDimensions;

class MockFileReader {
    constructor() {
        this.result = '';
        this.onload = null;
        this.onerror = null;
    }

    readAsText(file) {
        Promise.resolve(typeof file.text === 'function' ? file.text() : new Response(file).text())
            .then((text) => {
                this.result = text;
                this.onload?.();
            })
            .catch((error) => {
                this.onerror?.(error);
            });
    }
}

class MockImage {
    constructor() {
        this.onload = null;
        this.onerror = null;
        this.naturalWidth = 0;
        this.naturalHeight = 0;
    }

    set src(value) {
        queueMicrotask(() => {
            if (value === 'bad-image') {
                this.onerror?.(new Error('Unable to decode the selected image.'));
                return;
            }

            this.naturalWidth = imageDimensions.width;
            this.naturalHeight = imageDimensions.height;
            this.onload?.();
        });
    }
}

const setCrypto = (subtle) => {
    Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: subtle ? { subtle } : {},
    });
};

describe('businessBranding', () => {
    beforeEach(() => {
        sanitizeMock.mockReset();
        sanitizeMock.mockImplementation((markup) => markup);

        canvasContext = { drawImage: vi.fn() };
        canvasToDataUrl = vi.fn((mimeType) => makeDataUrl(mimeType, 'processed-logo'));
        imageDimensions = { width: 320, height: 120 };

        globalThis.FileReader = MockFileReader;
        globalThis.Image = MockImage;

        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:brand-logo');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
            if (tagName === 'canvas') {
                return {
                    width: 0,
                    height: 0,
                    getContext: vi.fn(() => canvasContext),
                    toDataURL: canvasToDataUrl,
                };
            }

            return originalCreateElement(tagName, options);
        });

        setCrypto({
            digest: vi.fn(async () => Uint8Array.from([1, 2, 3, 4]).buffer),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        globalThis.FileReader = originalFileReader;
        globalThis.Image = originalImage;

        if (originalCryptoDescriptor) {
            Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
        } else {
            delete globalThis.crypto;
        }
    });

    it('normalizes valid brand colors and rejects invalid values', () => {
        expect(normalizeBrandColor('abc')).toBe('#aabbcc');
        expect(normalizeBrandColor('#A1B2C3')).toBe('#a1b2c3');
        expect(normalizeBrandColor('')).toBeNull();
        expect(normalizeBrandColor('not-a-color')).toBeNull();
    });

    it('recognizes supported logo mime types', () => {
        expect(isSupportedLogoMimeType('image/png')).toBe(true);
        expect(isSupportedLogoMimeType('image/webp')).toBe(true);
        expect(isSupportedLogoMimeType('image/gif')).toBe(false);
        expect(isSupportedLogoMimeType(null)).toBe(false);
    });

    it('rejects unsupported logo files and oversized uploads', async () => {
        const gifFile = new File(['gif'], 'logo.gif', { type: 'image/gif' });
        const hugeFile = new File(['logo'], 'huge.png', { type: 'image/png' });

        Object.defineProperty(hugeFile, 'size', { value: BRAND_LOGO_MAX_FILE_SIZE_BYTES + 1 });

        await expect(prepareBusinessLogoAsset(gifFile)).rejects.toThrow('Please upload an SVG, PNG, JPEG, or WebP logo.');
        await expect(prepareBusinessLogoAsset(hugeFile)).rejects.toThrow('The selected logo is too large. Please choose a file smaller than 5 MB.');
    });

    it('prepares and sanitizes svg business logos', async () => {
        sanitizeMock.mockImplementation((markup) => markup.replace('<script>alert(1)</script>', ''));

        const file = {
            name: 'logo.svg',
            type: 'image/svg+xml',
            size: 120,
            text: () => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="100" height="50" /></svg>'),
        };

        const asset = await prepareBusinessLogoAsset(file);

        expect(asset).toEqual(expect.objectContaining({
            kind: 'logo',
            mimeType: 'image/svg+xml',
            fileName: 'logo.svg',
            width: 320,
            height: 120,
            contentHash: '01020304',
        }));
        expect(asset.dataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
        expect(sanitizeMock).toHaveBeenCalled();
    });

    it('rejects svg logos that are invalid after sanitization', async () => {
        sanitizeMock.mockReturnValue('<div>not-an-svg</div>');

        const file = {
            name: 'logo.svg',
            type: 'image/svg+xml',
            size: 32,
            text: () => Promise.resolve('<svg></svg>'),
        };

        await expect(prepareBusinessLogoAsset(file)).rejects.toThrow('The selected SVG is not valid after sanitization.');
    });

    it('prepares raster logos, rescales them, and falls back from webp when needed', async () => {
        imageDimensions = { width: 1600, height: 480 };
        canvasToDataUrl = vi.fn((mimeType) => {
            if (mimeType === 'image/webp') {
                return makeDataUrl('image/png', 'browser-fallback');
            }

            return makeDataUrl(mimeType, 'jpeg-logo');
        });

        const file = new File(['jpeg'], 'logo.jpg', { type: 'image/jpeg' });
        const asset = await prepareBusinessLogoAsset(file);

        expect(asset).toEqual(expect.objectContaining({
            kind: 'logo',
            mimeType: 'image/jpeg',
            fileName: 'logo.jpg',
            width: BRAND_LOGO_TARGET_MAX_WIDTH,
            height: BRAND_LOGO_TARGET_MAX_HEIGHT,
        }));
        expect(URL.createObjectURL).toHaveBeenCalledWith(file);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:brand-logo');
        expect(canvasContext.drawImage).toHaveBeenCalled();
    });

    it('rejects raster logos when canvas processing is unavailable', async () => {
        canvasContext = null;

        const file = new File(['png'], 'logo.png', { type: 'image/png' });

        await expect(prepareBusinessLogoAsset(file)).rejects.toThrow('Unable to process the selected image.');
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:brand-logo');
    });

    it('rejects raster logos that stay too large after compression attempts', async () => {
        const oversizedContent = 'x'.repeat(280 * 1024);
        canvasToDataUrl = vi.fn((mimeType) => makeDataUrl(mimeType, oversizedContent));

        const file = new File(['webp'], 'logo.webp', { type: 'image/webp' });

        await expect(prepareBusinessLogoAsset(file)).rejects.toThrow('The processed logo is still too large. Please use a smaller image.');
    });

    it('falls back to a byte-length hash when crypto.subtle is unavailable', async () => {
        setCrypto(null);

        const file = {
            name: 'logo.svg',
            type: 'image/svg+xml',
            size: 96,
            text: () => Promise.resolve('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" /></svg>'),
        };
        const asset = await prepareBusinessLogoAsset(file);

        expect(asset.contentHash).toBe(String(asset.byteSize));
    });
});