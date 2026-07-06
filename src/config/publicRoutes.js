const PUBLIC_STATIC_ROUTE_PREFIXES = [
    '/blog',
    '/agents',
    '/llms.txt',
    '/privacy',
    '/terms',
    '/contact',
];

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createPublicStaticRoutePattern(prefix) {
    return new RegExp(`^${escapeRegex(prefix)}(?:$|/|\\?)`);
}

export const PUBLIC_STATIC_ROUTE_DENYLIST = PUBLIC_STATIC_ROUTE_PREFIXES.map(
    createPublicStaticRoutePattern
);

export function matchesPublicStaticRoute(pathname) {
    return PUBLIC_STATIC_ROUTE_DENYLIST.some((pattern) => pattern.test(pathname));
}
