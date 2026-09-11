const PUBLIC_STATIC_ROUTE_PREFIXES = [
    '/blog',
    '/product',
    '/pricing',
    '/agents',
    '/llms.txt',
    '/privacy',
    '/terms',
    '/contact',
];

const PUBLIC_FILES = ['/llms.txt', '/sitemap.xml', '/mcp-registry-auth', '/tasktime-agent.json', '/.well-known/mcp-registry-auth', '/.well-known/tasktime-agent.json'];

/** Preserve old app-origin public links after the site moves to its own host. */
export function publicPageRedirect(requestUrl, marketingOrigin) {
    const pathname = requestUrl.split('?')[0];
    return matchesPublicStaticRoute(pathname) || PUBLIC_FILES.includes(pathname)
        ? `${marketingOrigin}${requestUrl}` : null;
}

export function publicPageRedirectRules(marketingOrigin) {
    const routes = PUBLIC_STATIC_ROUTE_PREFIXES.filter(route => route !== '/llms.txt');
    return [
        ...routes.flatMap(route => [`${route} ${marketingOrigin}${route}/ 302`, `${route}/* ${marketingOrigin}${route}/:splat 302`]),
        ...PUBLIC_FILES.map(route => `${route} ${marketingOrigin}${route} 302`),
        '/* /index.html 200',
        '',
    ].join('\n');
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createPublicStaticRoutePattern(prefix) {
    return new RegExp(`^${escapeRegex(prefix)}(?:$|/|\\?)`);
}

export const PUBLIC_STATIC_ROUTE_DENYLIST = [
    ...PUBLIC_STATIC_ROUTE_PREFIXES.map(createPublicStaticRoutePattern),
    ...PUBLIC_FILES.filter(route => route !== '/llms.txt').map(route => new RegExp(`^${escapeRegex(route)}(?:$|\\?)`)),
];

export function matchesPublicStaticRoute(pathname) {
    return PUBLIC_STATIC_ROUTE_DENYLIST.some((pattern) => pattern.test(pathname));
}
