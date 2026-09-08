import { expect, test } from '@playwright/test';
import { createPersonalProject, projectsHeadingName } from './helpers/tasktime.js';

const publicRouteExpectations = [
    {
        path: '/product/',
        title: 'TaskTime Pro — Local-first work and invoicing for freelancers',
        heading: 'Run your freelance work. From task to invoice.',
    },
    {
        path: '/pricing/',
        title: 'TaskTime Pro Pricing — Free and Pro',
        heading: 'Start free. Go Pro when it saves you time.',
    },
    {
        path: '/blog/',
        title: 'TaskTime Pro Blog',
        heading: 'Our Blog',
    },
    {
        path: '/privacy/',
        title: 'Privacy Policy | TaskTime Pro',
        heading: 'Privacy Policy',
    },
    {
        path: '/terms/',
        title: 'Terms & Conditions | TaskTime Pro',
        heading: 'Terms & Conditions',
    },
    {
        path: '/contact/',
        title: 'Contact | TaskTime Pro',
        heading: 'Contact',
    },
];

async function waitForActiveServiceWorker(page) {
    await expect.poll(async () => {
        return page.evaluate(async () => {
            const registration = await navigator.serviceWorker.ready;
            return Boolean(registration.active);
        });
    }).toBe(true);

    await page.goto(page.url(), { waitUntil: 'domcontentloaded' });

    await expect.poll(() => {
        return page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    }).toBe(true);
}

async function expectStaticPublicRoute(page, { path, title, heading }) {
    await page.goto(path);

    await expect(page).toHaveTitle(title);
    await expect(page.locator('#root')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
}

test.describe('PWA smoke', () => {
    test('keeps the product page usable at a narrow mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 800 });
        await page.goto('/product/');

        const hero = page.locator('.product-hero');

        await expect(page.getByText('Built for independent professionals', { exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Run your freelance work. From task to invoice.', level: 1 })).toBeVisible();
        await expect(hero).toContainText('with optional help from your own AI assistant');
        await expect(hero.getByRole('link', { name: 'Open TaskTime Pro', exact: true })).toBeVisible();
        await expect(hero.getByRole('link', { name: /GitHub/i })).toHaveCount(0);
        await expect(hero).toContainText('Start free. No signup.');
        await expect(hero.getByLabel('TaskTime Pro essentials').locator('li')).toHaveText([
            'Local-first',
            'Open source',
            'Works offline',
        ]);
        await expect(page.getByRole('heading', { name: 'You’re solo. Your workload isn’t.', level: 2 })).toBeVisible();
        await expect(page.locator('.product-capability-card')).toHaveCount(6);
        await expect(page.locator('.product-capability-card', { hasText: 'Optional local agent access' })).toHaveCount(0);
        const cardIcons = page.locator('.product-capability-card svg, .product-principle-list article svg');

        await expect(cardIcons).toHaveCount(9);
        for (const icon of await cardIcons.all()) {
            await expect(icon).toHaveAttribute('aria-hidden', 'true');
            await expect(icon).toHaveAttribute('focusable', 'false');
        }
        await expect(page.getByRole('heading', { name: 'Take your work with you', level: 3 })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Privacy boundaries stay explicit' })).toHaveCount(0);
        await expect(page.locator('[data-screenshot-slot]')).toHaveCount(3);
        const agentSection = page.getByRole('region', { name: 'Let your AI help with the admin.' });

        await expect(agentSection.getByRole('list', { name: 'Example requests for your AI assistant' })).toContainText('Prepare a draft invoice for this project.');
        await expect(agentSection).toContainText('compatible AI assistant');
        await expect(agentSection).toContainText('approve sensitive actions');

        const horizontalLayout = await page.evaluate(() => {
            const viewportWidth = window.innerWidth;
            const offenders = Array.from(document.querySelectorAll('body *'))
                .map((element) => {
                    const bounds = element.getBoundingClientRect();

                    return {
                        tag: element.tagName.toLowerCase(),
                        className: element.className || '',
                        left: Math.round(bounds.left),
                        right: Math.round(bounds.right),
                    };
                })
                .filter(({ left, right }) => left < 0 || right > viewportWidth)
                .slice(0, 10);

            return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth,
                offenders,
            };
        });

        expect(horizontalLayout).toEqual({
            documentWidth: 320,
            viewportWidth: 320,
            offenders: [],
        });

        const footer = page.locator('footer');

        await expect(footer.getByRole('link', { name: 'TaskTime Pro on GitHub' })).toBeVisible();
        await expect(footer.getByRole('link', { name: 'Blog' })).toBeVisible();
        await expect(footer.getByRole('link', { name: 'Contact' })).toBeVisible();
        await expect(footer.getByRole('link', { name: 'Terms' })).toBeVisible();
        await expect(footer.getByRole('link', { name: 'Privacy' })).toBeVisible();

        const workflowLink = agentSection.getByRole('link', { name: 'See how it works' });

        await workflowLink.focus();
        await expect(workflowLink).toBeFocused();
        await workflowLink.press('Enter');
        await expect(page.getByRole('heading', { name: 'AI Invoicing for Freelancers: Let an Agent Prepare the Draft', level: 1 })).toBeVisible();
    });

    test('keeps the product hero centered above its full-width visual on desktop', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/product/');

        const heroLineMetrics = await page.locator('.product-hero h1 span').evaluateAll((lines) => {
            return lines.map((line) => {
                const styles = window.getComputedStyle(line);

                return {
                    height: Math.round(line.getBoundingClientRect().height),
                    lineHeight: Math.round(Number.parseFloat(styles.lineHeight)),
                };
            });
        });

        expect(heroLineMetrics).toHaveLength(2);
        expect(heroLineMetrics.every(({ height, lineHeight }) => height <= lineHeight + 1)).toBe(true);

        const heroComposition = await page.locator('.product-hero').evaluate((hero) => {
            const copy = hero.querySelector('.product-hero-copy');
            const media = hero.querySelector('.product-media-placeholder--hero');
            const heroBounds = hero.getBoundingClientRect();
            const copyBounds = copy.getBoundingClientRect();
            const mediaBounds = media.getBoundingClientRect();

            return {
                copyCenterOffset: Math.round(Math.abs(
                    copyBounds.left + (copyBounds.width / 2)
                    - (heroBounds.left + (heroBounds.width / 2)),
                )),
                mediaFollowsCopy: mediaBounds.top > copyBounds.bottom,
                mediaWidthRatio: mediaBounds.width / heroBounds.width,
            };
        });

        expect(heroComposition.copyCenterOffset).toBeLessThanOrEqual(2);
        expect(heroComposition.mediaFollowsCopy).toBe(true);
        expect(heroComposition.mediaWidthRatio).toBeGreaterThanOrEqual(0.95);

        // Keep the positioning next to the product and the AI example next to billing.
        const sectionOrder = await page.locator('.product-main section').evaluateAll((sections) => {
            return sections.map((section) => section.getAttribute('aria-labelledby'));
        });

        expect(sectionOrder).toEqual([
            'product-title',
            'solo-title',
            'capabilities-title',
            'planning-title',
            'billing-title',
            'agent-title',
            'ownership-title',
            'open-source-title',
            'final-cta-title',
        ]);

        const githubIcon = page.getByRole('contentinfo').getByRole('link', { name: 'TaskTime Pro on GitHub' }).locator('svg');

        await expect(githubIcon).toHaveAttribute('viewBox', '0 0 16 16');
    });

    test('stays usable offline after the production service worker is active', async ({ browser }) => {
        const context = await browser.newContext();

        try {
            const page = await context.newPage();
            const projectTitle = `Playwright Cached Boot Project ${Date.now()}`;

            await page.goto('/projects');
            await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();

            await createPersonalProject(page, projectTitle);

            await waitForActiveServiceWorker(page);

            await context.setOffline(true);

            await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
            await expect(page.getByRole('heading', { name: projectTitle })).toBeVisible();
            await expect(page.getByText("You're offline")).toBeVisible();
        } finally {
            await context.close();
        }
    });

    test('opens the dashboard chart offline before its first dashboard visit', async ({ page, context }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => localStorage.setItem('tasktime-onboarding-completed', 'true'));
        await page.goto('/projects');
        await expect(page.getByRole('heading', { name: projectsHeadingName })).toBeVisible();
        await expect(page.getByTestId('dashboard-hours-chart')).toHaveCount(0);
        await waitForActiveServiceWorker(page);
        await context.setOffline(true);
        await page.goto('/');
        await expect(page.getByTestId('dashboard-hours-chart')).toBeVisible();
        await expect(page.getByText('Daily values', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('table', { name: 'Actual time tracked each day' })).toHaveCount(1);
        await page.getByRole('application', { name: 'Daily tracked hours, split into billable and non-billable time' }).focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.recharts-tooltip-wrapper')).toContainText('Non-billable');
        await expect(page.locator('.recharts-tooltip-wrapper')).toContainText('Total');
        expect(errors).toEqual([]);
    });

    test('keeps static public routes out of the app shell after the production service worker is active', async ({ browser }) => {
        const context = await browser.newContext();

        try {
            const page = await context.newPage();

            await page.goto('/');
            await waitForActiveServiceWorker(page);

            for (const routeExpectation of publicRouteExpectations) {
                await test.step(`serves static html for ${routeExpectation.path}`, async () => {
                    await expectStaticPublicRoute(page, routeExpectation);
                });
            }
        } finally {
            await context.close();
        }
    });
});
