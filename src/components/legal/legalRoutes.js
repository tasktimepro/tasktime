function normalizePathname(pathname) {
    if (!pathname || pathname === '/') {
        return '/';
    }

    return pathname.replace(/\/+$/, '') || '/';
}

export function isPublicLegalPath(pathname) {
    const normalizedPathname = normalizePathname(pathname);

    return [
        '/privacy',
        '/privacy-policy',
        '/terms',
        '/terms-and-conditions',
    ].includes(normalizedPathname);
}

export function getNormalizedPublicLegalPath(pathname) {
    return normalizePathname(pathname);
}