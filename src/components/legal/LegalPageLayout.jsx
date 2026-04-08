import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { ArrowLeftIcon, ClockIcon, MoonIcon, SunIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useDarkModePreference } from '@/hooks/useDarkModePreference.ts';

const PUBLIC_LEGAL_SCROLL_CLASS = 'public-legal-page';
const SITE_URL = 'https://tasktime.pro';
const CANONICAL_PATHS = {
    privacy: '/privacy',
    terms: '/terms',
};

const NAV_ITEMS = [
    {
        href: '/privacy',
        key: 'privacy',
        label: 'Privacy Policy',
    },
    {
        href: '/terms',
        key: 'terms',
        label: 'Terms & Conditions',
    },
];

function setMetaTag(attributeName, attributeValue, content) {
    const selector = `meta[${attributeName}="${attributeValue}"]`;
    let element = document.head.querySelector(selector);
    const created = !element;

    if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attributeName, attributeValue);
        document.head.appendChild(element);
    }

    const previousContent = element.getAttribute('content');
    element.setAttribute('content', content);

    return () => {
        if (created) {
            element.remove();
            return;
        }

        if (previousContent === null) {
            element.removeAttribute('content');
            return;
        }

        element.setAttribute('content', previousContent);
    };
}

function setCanonicalLink(href) {
    let element = document.head.querySelector('link[rel="canonical"]');
    const created = !element;

    if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', 'canonical');
        document.head.appendChild(element);
    }

    const previousHref = element.getAttribute('href');
    element.setAttribute('href', href);

    return () => {
        if (created) {
            element.remove();
            return;
        }

        if (previousHref === null) {
            element.removeAttribute('href');
            return;
        }

        element.setAttribute('href', previousHref);
    };
}

/**
 * Shared shell for public legal pages.
 */
const LegalPageLayout = ({
    pageKey,
    title,
    summary,
    lastUpdated,
    highlights,
    children,
}) => {
    const [darkMode, setDarkMode] = useDarkModePreference();

    useEffect(() => {
        const previousTitle = document.title;
        const canonicalPath = CANONICAL_PATHS[pageKey] ?? '/';
        const canonicalUrl = `${SITE_URL}${canonicalPath}`;
        const pageTitle = `${title} | TaskTime`;
        const restoreHead = [
            setMetaTag('name', 'description', summary),
            setMetaTag('name', 'robots', 'index,follow'),
            setMetaTag('property', 'og:title', pageTitle),
            setMetaTag('property', 'og:description', summary),
            setMetaTag('property', 'og:type', 'website'),
            setMetaTag('property', 'og:url', canonicalUrl),
            setMetaTag('name', 'twitter:title', pageTitle),
            setMetaTag('name', 'twitter:description', summary),
            setCanonicalLink(canonicalUrl),
        ];

        document.title = pageTitle;

        return () => {
            document.title = previousTitle;
            restoreHead.reverse().forEach((restore) => restore());
        };
    }, [pageKey, summary, title]);

    useEffect(() => {
        document.documentElement.classList.add(PUBLIC_LEGAL_SCROLL_CLASS);
        document.body.classList.add(PUBLIC_LEGAL_SCROLL_CLASS);

        return () => {
            document.documentElement.classList.remove(PUBLIC_LEGAL_SCROLL_CLASS);
            document.body.classList.remove(PUBLIC_LEGAL_SCROLL_CLASS);
        };
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
                <header className="mb-6 rounded-[1.75rem] border border-border/80 bg-card/95 p-4 shadow-sm backdrop-blur sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
                                    <ClockIcon className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">TaskTime</p>
                                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
                                </div>
                            </div>
                            <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                                {summary}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDarkMode(!darkMode)}
                                leadingIcon={darkMode ? SunIcon : MoonIcon}
                            >
                                {darkMode ? 'Light mode' : 'Dark mode'}
                            </Button>
                        </div>
                    </div>
                </header>

                <div className="grid flex-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
                    <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
                        <Card className="rounded-[1.5rem] border-border/80 shadow-sm">
                            <CardHeader className="space-y-3">
                                <CardTitle className="text-base">Legal pages</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {NAV_ITEMS.map((item) => (
                                    <a
                                        key={item.key}
                                        href={item.href}
                                        aria-current={item.key === pageKey ? 'page' : undefined}
                                        className={cn(
                                            'block rounded-xl border px-3 py-2 text-sm transition-colors',
                                            item.key === pageKey
                                                ? 'border-foreground/15 bg-accent text-accent-foreground'
                                                : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                        )}
                                    >
                                        {item.label}
                                    </a>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="rounded-[1.5rem] border-border/80 shadow-sm">
                            <CardHeader className="space-y-2">
                                <CardTitle className="text-base">At a glance</CardTitle>
                                <CardDescription>Last updated {lastUpdated}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                                    {highlights.map((item) => (
                                        <li key={item} className="rounded-xl bg-muted/60 px-3 py-2">
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </aside>

                    <Card className="rounded-[1.75rem] border-border/80 shadow-sm">
                        <CardContent className="p-6 sm:p-8">
                            <article className="space-y-8">
                                {children}
                            </article>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

LegalPageLayout.propTypes = {
    pageKey: PropTypes.oneOf(['privacy', 'terms']).isRequired,
    title: PropTypes.string.isRequired,
    summary: PropTypes.string.isRequired,
    lastUpdated: PropTypes.string.isRequired,
    highlights: PropTypes.arrayOf(PropTypes.string).isRequired,
    children: PropTypes.node.isRequired,
};

export default LegalPageLayout;