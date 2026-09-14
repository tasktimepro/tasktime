import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Europe/Ljubljana' });
const runCommand = async (page, name, input) => {
    await page.waitForFunction(() => window.__TASKTIME_STORE__?.isReady);
    return page.evaluate(async ({ name, input }) => {
        const { executeAgentCommand } = await import('/src/agent/commands/registry.ts');
        const result = await executeAgentCommand({ store: window.__TASKTIME_STORE__, isReady: true, permissions: new Set(['read', 'write', 'billing']), now: () => Date.now() }, name, input);
        if (!result.ok) throw new Error(JSON.stringify(result.error));
        return result.data;
    }, { name, input });
};
const readState = page => page.evaluate(async () => {
    const { collectEntities } = await import('/src/stores/yjs/entityUtils.ts');
    const store = window.__TASKTIME_STORE__;
    return { invoices: collectEntities(store.invoices), entries: store.getAllTimeEntries(), expenses: collectEntities(store.expenses), templates: collectEntities(store.invoiceTemplates), projects: collectEntities(store.projects) };
});
const createDraft = page => runCommand(page, 'create_invoice_draft', { projectId: 'draft-project', billingPeriodStart: '2026-09-01', billingPeriodEnd: '2026-09-30', templateId: 'draft-template' });

for (const width of [1440, 390]) {
    test.describe(`${width}px saved invoice drafts`, () => {
        test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.clock.setFixedTime(new Date('2026-09-14T12:00:00+02:00'));
            await page.addInitScript(width => {
                localStorage.setItem('tasktime-onboarding-completed', 'true');
                localStorage.setItem('tasktime-dark-mode', String(width === 390));
            }, width);
            await page.goto('/');
            await expect(page.getByTestId('dashboard-hours-chart')).toBeVisible();
            await expect(page.locator('html')).toHaveClass(width === 390 ? /dark/ : /^(?!.*dark).*$/);
            await page.evaluate(async () => {
                const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
                const store = window.__TASKTIME_STORE__;
                store.preferences.set('currency', 'EUR');
                store.clients.set('draft-client', objectToYMap({ id: 'draft-client', title: 'Studio', clientName: 'Studio', defaultCurrency: 'EUR', hourlyRate: 50 }));
                store.projects.set('draft-project', objectToYMap({ id: 'draft-project', title: 'Website', preferredClientId: 'draft-client', hourlyRate: 50, invoiceIds: [] }));
                store.tasks.set('draft-task', objectToYMap({ id: 'draft-task', title: 'Design website', projectId: 'draft-project', billable: true }));
                store.invoiceTemplates.set('draft-template', objectToYMap({ id: 'draft-template', name: 'Studio invoice', isDefault: true, useSequentialNumbers: true, currentSequentialNumber: 1, sequentialNumberDigits: 3, invoiceNumberFormat: 'ST-{sequential}', dueDateType: 'fixed-days', dueDateDays: 14 }));
                const start = new Date('2026-09-10T10:00:00+02:00').getTime();
                store.activeTimeEntries.set('draft-entry', objectToYMap({ id: 'draft-entry', taskId: 'draft-task', start, end: start + 3600000 }));
                await store.docManager.flushPersistence();
            });
        });

        test('continues an agent draft in the UI, refreshes deliberately, and finalizes once', async ({ page }, testInfo) => {
            const { invoice } = await createDraft(page);
            await page.goto('/invoices?section=invoices&tab=draft');
            await expect(page.getByRole('tab', { name: 'Drafts (1)' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Mark as Paid' })).toHaveCount(0);
            await page.getByRole('button', { name: 'Continue Draft' }).click();
            const dialog = page.getByRole('dialog', { name: 'Edit Invoice' });
            await dialog.getByRole('button', { name: /^Tasks & Time/ }).click();
            await expect(dialog.getByText('Design website', { exact: true })).toBeVisible();
            await expect(dialog.getByRole('button', { name: 'Save Draft' })).toBeVisible();
            await dialog.getByRole('button', { name: 'Save Draft' }).click();
            await expect(dialog).not.toBeVisible();
            let state = await readState(page);
            expect(state.invoices[0].total).toBe(50);
            expect(state.invoices[0].billingSelectionSnapshot.entries).toEqual(invoice.billingSelectionSnapshot.entries);
            expect(state.entries[0].billedInvoiceId).toBeUndefined();
            expect(state.templates[0].currentSequentialNumber).toBe(1);
            await page.reload();
            await page.getByRole('button', { name: 'Continue Draft' }).click();
            await page.evaluate(async () => {
                const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
                const start = new Date('2026-09-11T10:00:00+02:00').getTime();
                window.__TASKTIME_STORE__.activeTimeEntries.set('later-entry', objectToYMap({ id: 'later-entry', taskId: 'draft-task', start, end: start + 3600000 }));
            });
            await dialog.getByRole('button', { name: 'Refresh Work', exact: true }).click();
            await page.getByRole('dialog', { name: 'Refresh draft work?' }).getByRole('button', { name: 'Refresh Work', exact: true }).click();
            await expect(page.getByRole('dialog', { name: 'Refresh draft work?' })).not.toBeVisible();
            state = await readState(page);
            expect(state.invoices[0].total).toBe(100);
            expect(state.invoices[0].billingSelectionSnapshot.entries).toHaveLength(2);
            expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
            await dialog.screenshot({ path: testInfo.outputPath('saved-draft-editor.png') });
            await dialog.getByRole('button', { name: 'Finalize Invoice', exact: true }).click();
            await expect(dialog).not.toBeVisible();
            state = await readState(page);
            expect(state.invoices).toHaveLength(1);
            expect(state.invoices[0]).toMatchObject({ id: invoice.id, status: 'sent', total: 100, invoiceNumber: 'ST-001' });
            expect(state.entries.every(entry => entry.billedInvoiceId === invoice.id)).toBe(true);
            expect(state.templates[0].currentSequentialNumber).toBe(2);
            await page.reload();
            await expect(page.getByRole('tab', { name: 'Outstanding (1)' })).toBeVisible();
        });

        test('keeps mobile closing available and marks unsaved previews as drafts', async ({ page }) => {
            if (width === 390) await page.setViewportSize({ width: 320, height: 740 });
            await page.goto('/projects/draft-project');
            await page.getByRole('button', { name: /^Generate Invoice/ }).first().click();
            const dialog = page.getByRole('dialog', { name: 'New Invoice', exact: true });
            await expect(dialog.getByRole('button', { name: 'Close dialog', exact: true })).toBeVisible();
            const footerClose = dialog.getByRole('button', { name: 'Close', exact: true });
            if (width === 390) await expect(footerClose).toBeHidden();
            else await expect(footerClose).toBeVisible();
            for (const name of ['Preview invoice', 'Save Draft', 'Finalize Invoice']) {
                await expect(dialog.getByRole('button', { name, exact: true })).toBeInViewport();
            }
            expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
            await dialog.getByRole('button', { name: 'Preview invoice', exact: true }).click();
            const preview = page.getByRole('dialog', { name: /Invoice Preview/ });
            await expect(preview.locator('[data-invoice-draft="true"]')).toContainText('Not issued or payable');
            await preview.getByRole('button', { name: 'Close dialog', exact: true }).click();
            await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
            await expect(dialog).not.toBeVisible();
            const state = await readState(page);
            expect(state.invoices).toHaveLength(0);
            expect(state.entries[0].billedInvoiceId).toBeUndefined();
            expect(state.templates[0].currentSequentialNumber).toBe(1);
        });

        test('refreshes a client-only expense draft in the UI and finalizes it through the agent', async ({ page }) => {
            const { invoice } = await createDraft(page);
            await runCommand(page, 'delete_invoice_draft', { invoiceId: invoice.id, confirmDelete: true });
            await page.evaluate(async invoice => {
                const { objectToYMap } = await import('/src/stores/yjs/entityUtils.ts');
                const { saveInvoiceDraft } = await import('/src/stores/yjs/invoiceDraftOperations.ts');
                const store = window.__TASKTIME_STORE__;
                await saveInvoiceDraft(store, { ...invoice, projectId: null, projectIds: [], project: null, projectBreakdowns: [],
                    agentDraft: undefined, billingSelectionSnapshot: undefined, tasks: [], items: [], subtotal: 0, total: 0 }, null);
                store.expenses.set('client-travel', objectToYMap({ id: 'client-travel', title: 'Client travel', date: '2026-09-12', amount: 30,
                    currency: 'EUR', clientId: 'draft-client', billable: true, billingStatus: 'unbilled', paymentStatus: 'unpaid', isPersonal: false }));
                await store.docManager.flushPersistence();
            }, invoice);
            await page.goto('/invoices?tab=draft');
            await page.getByRole('button', { name: 'Continue Draft' }).click();
            const dialog = page.getByRole('dialog', { name: 'Edit Invoice' });
            await dialog.getByRole('button', { name: 'Refresh Work', exact: true }).click();
            await page.getByRole('dialog', { name: 'Refresh draft work?' }).getByRole('button', { name: 'Refresh Work', exact: true }).click();
            await expect(page.getByRole('dialog', { name: 'Refresh draft work?' })).not.toBeVisible();
            let state = await readState(page);
            expect(state.invoices[0].total).toBe(30);
            expect(state.invoices[0].billingSelectionSnapshot.expenses.map(expense => expense.expenseId)).toEqual(['client-travel']);
            await dialog.getByRole('button', { name: 'Save Draft' }).click();
            await expect(dialog).not.toBeVisible();
            await runCommand(page, 'finalize_invoice', { invoiceId: invoice.id, confirmFinalize: true, idempotencyKey: 'client-expense-finalize' });
            state = await readState(page);
            expect(state.invoices[0]).toMatchObject({ status: 'sent', total: 30 });
            expect(state.expenses[0]).toMatchObject({ billingStatus: 'billed', invoiceId: invoice.id });
            expect(state.entries[0].billedInvoiceId).toBeUndefined();
        });

        test('creates a UI draft that the agent can finalize, and rejects stale UI saves', async ({ page }) => {
            await page.goto('/projects/draft-project');
            await page.getByRole('button', { name: /^Generate Invoice/ }).first().click();
            const dialog = page.getByRole('dialog', { name: 'New Invoice' });
            await dialog.getByRole('button', { name: 'Save Draft', exact: true }).click();
            await expect(dialog).not.toBeVisible();
            let state = await readState(page);
            expect(state.invoices).toHaveLength(1);
            expect(state.invoices[0].status).toBe('draft');
            expect(state.entries[0].billedInvoiceId).toBeUndefined();
            await page.goto('/invoices?tab=draft');
            await page.getByRole('button', { name: 'Continue Draft' }).click();
            const edit = page.getByRole('dialog', { name: 'Edit Invoice' });
            await runCommand(page, 'update_invoice_draft', { invoiceId: state.invoices[0].id, updates: { notes: 'Changed by agent' } });
            await edit.getByRole('button', { name: 'Save Draft' }).click();
            await expect(page.getByText('This invoice changed while it was open. Reopen it to review the latest version.')).toBeVisible();
            expect((await readState(page)).invoices[0].notes).toBe('Changed by agent');
            await page.reload();
            await runCommand(page, 'finalize_invoice', { invoiceId: state.invoices[0].id, confirmFinalize: true, idempotencyKey: 'draft-e2e-finalize' });
            state = await readState(page);
            expect(state.invoices[0].status).toBe('sent');
            expect(state.entries[0].billedInvoiceId).toBe(state.invoices[0].id);
        });

        test('reflects agent pricing and refresh in the UI and deletes drafts only after confirmation', async ({ page }) => {
            const { invoice } = await createDraft(page);
            await expect(runCommand(page, 'refresh_invoice_draft', { invoiceId: invoice.id, confirmRefresh: false })).rejects.toThrow(/confirmRefresh/);
            await runCommand(page, 'update_invoice_draft', { invoiceId: invoice.id, updates: { taskHourlyRates: { 'draft-task': 75 }, discount: 5, taxRate: 10 } });
            let state = await readState(page);
            expect(state.invoices[0]).toMatchObject({ subtotal: 75, discount: 5, tax: 7, total: 77 });
            await page.goto('/invoices?tab=draft');
            await page.getByRole('button', { name: 'Continue Draft' }).click();
            const dialog = page.getByRole('dialog', { name: 'Edit Invoice' });
            await dialog.getByRole('button', { name: 'Save Draft' }).click();
            await expect(dialog).not.toBeVisible();
            expect((await readState(page)).invoices[0].total).toBe(77);
            await runCommand(page, 'refresh_invoice_draft', { invoiceId: invoice.id, confirmRefresh: true });
            expect((await readState(page)).invoices[0].total).toBe(49.5);
            await page.getByRole('button', { name: 'More actions', exact: true }).click();
            await page.getByRole('menuitem', { name: 'Delete draft', exact: true }).click();
            const confirm = page.getByRole('dialog', { name: 'Delete draft?' });
            await confirm.getByRole('button', { name: 'Keep Draft' }).click();
            expect((await readState(page)).invoices).toHaveLength(1);
            await page.getByRole('button', { name: 'More actions', exact: true }).click();
            await page.getByRole('menuitem', { name: 'Delete draft', exact: true }).click();
            await confirm.getByRole('button', { name: 'Delete Draft', exact: true }).click();
            await expect.poll(async () => (await readState(page)).invoices.length).toBe(0);
            await expect(confirm).not.toBeVisible();
            state = await readState(page);
            expect(state.invoices).toHaveLength(0);
            expect(state.entries[0].billedInvoiceId).toBeUndefined();
            expect(state.templates[0].currentSequentialNumber).toBe(1);
            const next = await createDraft(page);
            await expect(runCommand(page, 'delete_invoice_draft', { invoiceId: next.invoice.id, confirmDelete: false })).rejects.toThrow(/confirmDelete/);
            await runCommand(page, 'delete_invoice_draft', { invoiceId: next.invoice.id, confirmDelete: true });
            expect((await readState(page)).invoices).toHaveLength(0);
        });
    });
}
