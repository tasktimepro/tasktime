import { expect, test } from '@playwright/test';

test.describe('Hosted email attempt durability', () => {

    test.beforeEach(async ({ page }) => {
        // Model a busy browser: non-IDB work may complete after auto-commit.
        await page.addInitScript(() => {
            const digest = crypto.subtle.digest.bind(crypto.subtle);
            crypto.subtle.digest = async (...args) => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return digest(...args);
            };
        });
    });

    test('releases an attempt when the Worker confirms that no send started', async ({ page }) => {

        await page.route('**/email/attempt/status', route => route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ version: 1, code: 'ATTEMPT_NOT_FOUND' }),
        }));
        await page.goto('/');
        const result = await page.evaluate(async () => {
            const storage = await import('/src/utils/emailAttemptStorage.ts');
            const lifecycle = { provider: 'google-drive', generation: 1, sessionId: 'browser-email-release' };
            const attemptId = crypto.randomUUID();
            await storage.storeEmailAttempt({
                lifecycle,
                attemptId,
                sendType: 'invoice',
                idempotencyKey: attemptId,
                documentId: 'browser-email-release',
                serializedPayload: '{}',
                documentSnapshot: { id: 'browser-email-release' },
            });
            const { checkEmailAttemptStatus } = await import('/src/utils/emailService.ts');
            const errorTypes = [];
            for (let check = 0; check < 2; check += 1) {
                try {
                    await checkEmailAttemptStatus({ sessionId: lifecycle.sessionId, billingLifecycle: lifecycle, attemptId });
                } catch (error) {
                    errorTypes.push(error.type);
                }
            }
            return { errorTypes, records: await storage.listBoundEmailAttempts(lifecycle) };
        });

        expect(result.errorTypes).toEqual(['attempt_not_found', 'attempt_not_found']);
        expect(result.records).toHaveLength(1);
        expect(result.records[0].state).toBe('rejected');
    });

    test('persists provider acceptance and applied invoice metadata', async ({ page }) => {

        await page.goto('/');
        const result = await page.evaluate(async () => {
            const storage = await import('/src/utils/emailAttemptStorage.ts');
            const lifecycle = { provider: 'google-drive', generation: 1, sessionId: 'browser-email-completed' };
            const attemptId = crypto.randomUUID();
            await storage.storeEmailAttempt({
                lifecycle,
                attemptId,
                sendType: 'invoice',
                idempotencyKey: attemptId,
                documentId: 'browser-email-completed',
                serializedPayload: '{}',
                documentSnapshot: { id: 'browser-email-completed' },
            });
            const updated = await storage.updateEmailAttemptState(attemptId, lifecycle, 'completed');
            const applied = await storage.markEmailAttemptMetadataApplied(attemptId, lifecycle);
            return { updated, applied, records: await storage.listBoundEmailAttempts(lifecycle) };
        });

        expect(result.updated).toBe(true);
        expect(result.applied).toBe(true);
        expect(result.records).toHaveLength(1);
        expect(result.records[0].state).toBe('completed');
        expect(result.records[0].metadataAppliedAt).toEqual(expect.any(Number));
    });
    test('defers automatic status checks while another tab is sending the same attempt', async ({ page, context }) => {
        const attemptId = 'f85f92e3-1584-4d77-8292-3a9977adcf99';
        const statusRequests = [];
        await context.route('**/email/attempt/status', route => {
            statusRequests.push(route.request().url());
            return route.abort();
        });
        await page.goto('/');
        await page.evaluate(attempt => new Promise(resolve => {
            void navigator.locks.request(`tasktime-email-attempt:${attempt}`, async () => {
                await new Promise(release => {
                    window.releaseEmailTestLock = release;
                    resolve();
                });
            });
        }), attemptId);
        const otherTab = await context.newPage();
        try {
            await otherTab.goto('/');
            const errorType = await otherTab.evaluate(async attempt => {
                const { checkEmailAttemptStatus } = await import('/src/utils/emailService.ts');
                try {
                    await checkEmailAttemptStatus({
                        sessionId: 'cross-tab-test',
                        billingLifecycle: { provider: 'google-drive', generation: 1, sessionId: 'cross-tab-test' },
                        attemptId: attempt,
                    });
                } catch (error) {
                    return error.type;
                }
            }, attemptId);
            expect(errorType).toBe('pending');
            expect(statusRequests).toEqual([]);
        } finally {
            await page.evaluate(() => window.releaseEmailTestLock());
            await otherTab.close();
        }
    });

});
