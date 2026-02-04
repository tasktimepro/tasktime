import { describe, it, expect } from 'vitest';
import React from 'react';
import { linkifyParts, linkifyNodes } from './linkifyUtils';

describe('linkifyUtils', () => {

    it('returns empty array for empty text', () => {

        expect(linkifyParts('')).toEqual([]);
        expect(linkifyParts(null)).toEqual([]);
    });

    it('returns text parts for plain text', () => {

        const result = linkifyParts('Hello');
        expect(result).toEqual([{ type: 'text', value: 'Hello' }]);
    });

    it('converts http links into link parts', () => {

        const result = linkifyParts('Visit https://example.com now');
        expect(result).toEqual([
            { type: 'text', value: 'Visit ' },
            { type: 'link', value: 'https://example.com', href: 'https://example.com' },
            { type: 'text', value: ' now' }
        ]);
    });

    it('adds https protocol for www links', () => {

        const result = linkifyParts('Go to www.example.com');
        expect(result).toEqual([
            { type: 'text', value: 'Go to ' },
            { type: 'link', value: 'www.example.com', href: 'https://www.example.com' }
        ]);
    });

    it('creates React nodes with createElement', () => {

        const result = linkifyNodes('See https://example.com', React.createElement);
        expect(result).toHaveLength(2);
        expect(result?.[0]?.type).toBe('span');
        expect(result?.[1]?.type).toBe('a');
        expect(result?.[1]?.props.href).toBe('https://example.com');
    });
});
