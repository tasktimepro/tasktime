export const SITE_URL = 'https://tasktime.pro';
export const SITE_NAME = 'TaskTime';
export const SITE_DESCRIPTION = 'Local-first task management, time tracking, expenses, and invoicing for freelancers and solo professionals.';
export const BLOG_BASE_PATH = '/blog';
export const DEFAULT_SOCIAL_IMAGE = '/icons/web-app-manifest-512x512.png';
export const DEFAULT_SOCIAL_IMAGE_ALT = 'TaskTime app icon';
export const TASKTIME_SOCIAL_URL = 'https://x.com/tasktimepro';

export function toCanonicalUrl(pathname, baseUrl = SITE_URL) {
    const url = new URL(pathname, baseUrl);

    if (url.pathname !== '/' && !url.pathname.endsWith('/')) {
        url.pathname = `${url.pathname}/`;
    }

    return url.toString();
}

export function toAbsoluteUrl(pathname, baseUrl = SITE_URL) {
    return new URL(pathname, baseUrl).toString();
}

export function toJsonLd(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

export const BLOG_CATEGORY_VALUES = [
    'privacy',
    'workflow',
    'invoicing',
    'expenses',
    'time-tracking',
    'planning',
];

export const BLOG_CATEGORY_LABELS = {
    privacy: 'Privacy',
    workflow: 'Workflow',
    invoicing: 'Invoicing',
    expenses: 'Expenses',
    'time-tracking': 'Time Tracking',
    planning: 'Planning',
};
