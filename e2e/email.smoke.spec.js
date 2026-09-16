import { expect, test } from '@playwright/test';
import {
    createTrackedInvoice,
    getInvoiceCardByProject,
} from './helpers/tasktime.js';

test.describe('Invoice email smoke', () => {

    test('shows Send Invoice button on unpaid invoice and opens email modal', async ({ page }) => {

        const sendRequests = [];
        page.on('request', request => {
            if (new URL(request.url()).pathname === '/email/invoice') sendRequests.push(request.url());
        });
        const now = Date.now();
        const projectTitle = `PW Email Invoice Project ${now}`;
        const clientTitle = `PW Email Invoice Client ${now}`;
        const clientName = `Email Invoice Client ${now}`;
        const taskTitle = `PW Email Invoice Task ${now}`;
        const templateName = `PW Email Template ${now}`;

        await createTrackedInvoice(page, {
            projectTitle,
            clientTitle,
            clientName,
            taskTitle,
            templateName,
        });

        const invoiceCard = getInvoiceCardByProject(page, projectTitle);
        await expect(invoiceCard).toBeVisible();

        // Send Invoice button should be visible (envelope icon)
        const sendButton = invoiceCard.getByTitle('Send Invoice by Email');
        await expect(sendButton).toBeVisible();

        // Click it to open the email preview modal
        await sendButton.click();

        const emailModal = page.getByRole('dialog', { name: /Send Invoice/ });
        await expect(emailModal).toBeVisible();

        // Keep both staged states explicit: neither permits a disconnected Send.
        const emailPolicyEnabled = process.env.VITE_EMAIL_ENTITLEMENT_ENFORCEMENT === 'true'
            || process.env.VITE_BILLING_SANDBOX_MODE === 'true';
        const modalSendButton = emailModal.getByRole('button', { name: /Send Invoice/i });
        if (emailPolicyEnabled) {
            await expect(emailModal.getByText(/Your email draft, template editing/i)).toBeVisible();
            await expect(emailModal.getByRole('button', { name: 'View Pro options' })).toBeVisible();
            await expect(modalSendButton).toHaveCount(0);
            await expect(emailModal.getByText(/Cloud provider required/i)).toHaveCount(0);
        } else {
            await expect(emailModal.getByText(/Cloud provider required/i)).toBeVisible();
            await expect(emailModal.getByText(
                /Connect Google Drive or Dropbox in Account settings/i,
            )).toBeVisible();
            await expect(modalSendButton).toBeDisabled();
        }

        await expect(emailModal.getByLabel('Subject')).toBeVisible();
        await expect(emailModal.getByLabel('Attachment Filename')).toHaveValue(/invoice-INV-/);

        // Close the modal
        await emailModal.getByRole('button', { name: /Cancel/ }).click();
        await expect(emailModal).not.toBeVisible();
        expect(sendRequests).toEqual([]);
    });

    test('Send Invoice button is not shown on paid invoices', async ({ page }) => {

        const now = Date.now();
        const projectTitle = `PW Paid No Send Project ${now}`;
        const clientTitle = `PW Paid No Send Client ${now}`;
        const clientName = `Paid No Send Client ${now}`;
        const taskTitle = `PW Paid No Send Task ${now}`;
        const templateName = `PW Paid No Send Template ${now}`;

        await createTrackedInvoice(page, {
            projectTitle,
            clientTitle,
            clientName,
            taskTitle,
            templateName,
        });

        const invoiceCard = getInvoiceCardByProject(page, projectTitle);
        await expect(invoiceCard).toBeVisible();

        // Mark as paid
        await invoiceCard.getByRole('button', { name: 'Mark as Paid' }).click();

        // Switch to paid tab
        const paidTab = page.getByRole('tab', { name: /^Paid \(1\)$/ });
        await expect(paidTab).toBeVisible();
        await paidTab.click();

        const paidCard = getInvoiceCardByProject(page, projectTitle);
        await expect(paidCard).toBeVisible();

        // Send Invoice button should NOT be visible on paid invoices
        await expect(paidCard.getByTitle('Send Invoice by Email')).not.toBeVisible();
    });
});
