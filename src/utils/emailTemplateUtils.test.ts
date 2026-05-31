import { describe, it, expect } from 'vitest';
import {
    resolveTemplate,
    resolveSubject,
    resolveAttachmentTitle,
    DEFAULT_SEND_BODY,
    DEFAULT_REMINDER_BODY,
    DEFAULT_QUOTE_BODY,
    DEFAULT_SUBJECT,
    DEFAULT_QUOTE_SUBJECT,
    DEFAULT_ATTACHMENT_TITLE,
    DEFAULT_QUOTE_ATTACHMENT_TITLE,
    EMAIL_PLACEHOLDER_VARIABLES,
} from './emailTemplateUtils';

const SAMPLE_VALUES = {
    invoiceNumber: 'INV-0042',
    clientName: 'Acme Corp',
    amount: '1,250.00',
    currency: '€',
    dueDate: '2026-05-01',
    businessName: 'Owen Far Studio',
};

describe('resolveTemplate', () => {

    it('replaces all known placeholders', () => {

        const result = resolveTemplate(DEFAULT_SEND_BODY, SAMPLE_VALUES);

        expect(result).toContain('Hi Acme Corp,');
        expect(result).toContain('INV-0042');
        expect(result).toContain('€1,250.00');
        expect(result).toContain('2026-05-01');
        expect(result).toContain('Owen Far Studio');
        expect(result).not.toContain('{');
    });

    it('replaces placeholders in the reminder template', () => {

        const result = resolveTemplate(DEFAULT_REMINDER_BODY, SAMPLE_VALUES);

        expect(result).toContain('friendly reminder');
        expect(result).toContain('INV-0042');
        expect(result).toContain('€1,250.00');
        expect(result).not.toContain('{');
    });

    it('leaves unknown placeholders as-is', () => {

        const template = 'Hello {unknown}, invoice {invoiceNumber}';
        const result = resolveTemplate(template, SAMPLE_VALUES);

        expect(result).toBe('Hello {unknown}, invoice INV-0042');
    });

    it('handles multiple occurrences of the same placeholder', () => {

        const template = '{clientName} owes {amount}. Reminder: {clientName}!';
        const result = resolveTemplate(template, SAMPLE_VALUES);

        expect(result).toBe('Acme Corp owes 1,250.00. Reminder: Acme Corp!');
    });

    it('handles empty string values', () => {

        const values = { ...SAMPLE_VALUES, businessName: '' };
        const result = resolveTemplate('From: {businessName}', values);

        expect(result).toBe('From: ');
    });
});

describe('resolveSubject', () => {

    it('resolves an invoice subject from template', () => {

        const subject = resolveSubject(DEFAULT_SUBJECT, 'invoice', SAMPLE_VALUES);
        expect(subject).toBe('Invoice INV-0042 from Owen Far Studio');
    });

    it('prepends Reminder: for reminder sends', () => {

        const subject = resolveSubject(DEFAULT_SUBJECT, 'reminder', SAMPLE_VALUES);
        expect(subject).toBe('Reminder: Invoice INV-0042 from Owen Far Studio');
    });

    it('resolves a quote subject without reminder prefixing', () => {

        const subject = resolveSubject(DEFAULT_QUOTE_SUBJECT, 'quote', SAMPLE_VALUES);
        expect(subject).toBe('Quote INV-0042 from Owen Far Studio');
    });

    it('resolves a custom subject template', () => {

        const subject = resolveSubject('Payment for {clientName} - {invoiceNumber}', 'invoice', SAMPLE_VALUES);
        expect(subject).toBe('Payment for Acme Corp - INV-0042');
    });
});

describe('resolveAttachmentTitle', () => {

    it('resolves the default attachment title and appends .pdf', () => {

        const title = resolveAttachmentTitle(DEFAULT_ATTACHMENT_TITLE, SAMPLE_VALUES);
        expect(title).toBe('invoice-INV-0042.pdf');
    });

    it('does not double-append .pdf', () => {

        const title = resolveAttachmentTitle('report.pdf', SAMPLE_VALUES);
        expect(title).toBe('report.pdf');
    });

    it('resolves the default quote attachment title', () => {

        const title = resolveAttachmentTitle(DEFAULT_QUOTE_ATTACHMENT_TITLE, SAMPLE_VALUES);
        expect(title).toBe('quote-INV-0042.pdf');
    });

    it('resolves placeholders in a custom title', () => {

        const title = resolveAttachmentTitle('{clientName}-{invoiceNumber}', SAMPLE_VALUES);
        expect(title).toBe('Acme Corp-INV-0042.pdf');
    });
});

describe('default templates', () => {

    it('DEFAULT_SEND_BODY contains all expected placeholders', () => {

        expect(DEFAULT_SEND_BODY).toContain('{clientName}');
        expect(DEFAULT_SEND_BODY).toContain('{invoiceNumber}');
        expect(DEFAULT_SEND_BODY).toContain('{currency}');
        expect(DEFAULT_SEND_BODY).toContain('{amount}');
        expect(DEFAULT_SEND_BODY).toContain('{dueDate}');
        expect(DEFAULT_SEND_BODY).toContain('{businessName}');
    });

    it('DEFAULT_REMINDER_BODY contains all expected placeholders', () => {

        expect(DEFAULT_REMINDER_BODY).toContain('{clientName}');
        expect(DEFAULT_REMINDER_BODY).toContain('{invoiceNumber}');
        expect(DEFAULT_REMINDER_BODY).toContain('{currency}');
        expect(DEFAULT_REMINDER_BODY).toContain('{amount}');
        expect(DEFAULT_REMINDER_BODY).toContain('{dueDate}');
        expect(DEFAULT_REMINDER_BODY).toContain('{businessName}');
    });

    it('DEFAULT_QUOTE_BODY contains quote placeholders', () => {

        expect(DEFAULT_QUOTE_BODY).toContain('{clientName}');
        expect(DEFAULT_QUOTE_BODY).toContain('{invoiceNumber}');
        expect(DEFAULT_QUOTE_BODY).toContain('{currency}');
        expect(DEFAULT_QUOTE_BODY).toContain('{amount}');
        expect(DEFAULT_QUOTE_BODY).toContain('{businessName}');
    });

    it('DEFAULT_SUBJECT contains invoice placeholders', () => {

        expect(DEFAULT_SUBJECT).toContain('{invoiceNumber}');
        expect(DEFAULT_SUBJECT).toContain('{businessName}');
    });

    it('DEFAULT_QUOTE_SUBJECT contains quote placeholders', () => {

        expect(DEFAULT_QUOTE_SUBJECT).toContain('{invoiceNumber}');
        expect(DEFAULT_QUOTE_SUBJECT).toContain('{businessName}');
    });

    it('DEFAULT_ATTACHMENT_TITLE contains invoice number placeholder', () => {

        expect(DEFAULT_ATTACHMENT_TITLE).toContain('{invoiceNumber}');
    });

    it('DEFAULT_QUOTE_ATTACHMENT_TITLE contains invoice number placeholder', () => {

        expect(DEFAULT_QUOTE_ATTACHMENT_TITLE).toContain('{invoiceNumber}');
    });

    it('EMAIL_PLACEHOLDER_VARIABLES covers all six placeholders', () => {

        const keys = EMAIL_PLACEHOLDER_VARIABLES.map(v => v.key);
        expect(keys).toContain('{invoiceNumber}');
        expect(keys).toContain('{clientName}');
        expect(keys).toContain('{amount}');
        expect(keys).toContain('{currency}');
        expect(keys).toContain('{dueDate}');
        expect(keys).toContain('{businessName}');
        expect(keys).toHaveLength(6);
    });
});
