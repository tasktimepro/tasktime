import { expect, test } from '@playwright/test';
import { createPersonalProject, projectsHeadingName } from './helpers/tasktime.js';

const publicRouteExpectations = [
    {
        path: '/product/',
        title: 'TaskTime Pro — Local-first work and invoicing for freelancers',
        heading: 'From task to paid. Without an account.',
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

        await expect(page.getByRole('heading', { name: 'From task to paid. Without an account.', level: 1 })).toBeVisible();
        await expect(hero.getByRole('link', { name: 'Open TaskTime' })).toBeVisible();
        await expect(hero.getByRole('link', { name: /GitHub/i })).toHaveCount(0);
        await expect(page.getByLabel('TaskTime Pro essentials')).toContainText('Free to use');
        await expect(page.getByLabel('TaskTime Pro essentials')).toContainText('No signup');
        await expect(page.getByLabel('TaskTime Pro essentials')).toContainText('Works offline');
        await expect(page.getByLabel('TaskTime Pro essentials')).toContainText('Open source');
        await expect(page.getByRole('heading', { name: 'Built for one professional, not a team.', level: 2 })).toBeVisible();
        await expect(page.locator('.product-capability-card')).toHaveCount(6);
        await expect(page.locator('.product-capability-card', { hasText: 'Optional local agent access' })).toHaveCount(0);
        await expect(page.locator('[data-screenshot-slot]')).toHaveCount(3);

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
    });

    test('keeps the product hero and secondary callouts balanced on desktop', async ({ page }) => {
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

        const secondaryList = page.locator('.product-secondary-list');

        await expect(secondaryList.locator(':scope > section')).toHaveCount(2);

        const secondarySpacing = await secondaryList.evaluate((list) => {
            const [agentSection, openSourceSection] = Array.from(list.children);
            const agentBounds = agentSection.getBoundingClientRect();
            const openSourceBounds = openSourceSection.getBoundingClientRect();

            return {
                gap: Math.round(openSourceBounds.top - agentBounds.bottom),
                agentBottomBorder: window.getComputedStyle(agentSection).borderBottomWidth,
                openSourceTopBorder: window.getComputedStyle(openSourceSection).borderTopWidth,
            };
        });

        expect(secondarySpacing).toEqual({
            gap: 0,
            agentBottomBorder: '0px',
            openSourceTopBorder: '1px',
        });

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
