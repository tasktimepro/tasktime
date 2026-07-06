import { describe, expect, it } from 'vitest';

import {
    PUBLIC_STATIC_ROUTE_DENYLIST,
    matchesPublicStaticRoute,
} from './publicRoutes';

describe('matchesPublicStaticRoute', () => {
    it.each([
        '/blog',
        '/blog/',
        '/blog/privacy-first-invoicing-tool',
        '/agents',
        '/agents/tools/',
        '/agents/mcp-tools.json',
        '/llms.txt',
        '/privacy',
        '/privacy?ref=footer',
        '/terms',
        '/contact',
    ])('matches %s', (pathname) => {
        expect(matchesPublicStaticRoute(pathname)).toBe(true);
    });

    it.each([
        '/',
        '/projects',
        '/projects/123',
        '/blogroll',
        '/agentship',
        '/llms.txtx',
        '/privacy-policy',
        '/contacts',
    ])('does not match %s', (pathname) => {
        expect(matchesPublicStaticRoute(pathname)).toBe(false);
    });
});

describe('PUBLIC_STATIC_ROUTE_DENYLIST', () => {
    it('includes a pattern for each static public route family', () => {
        expect(PUBLIC_STATIC_ROUTE_DENYLIST).toHaveLength(6);

        expect(PUBLIC_STATIC_ROUTE_DENYLIST.every((pattern) => pattern instanceof RegExp)).toBe(true);
    });
});
