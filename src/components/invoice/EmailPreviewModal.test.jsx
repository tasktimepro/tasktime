import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EmailPreviewModal from './EmailPreviewModal';

// ---- Mocks ----

const { captureDebugBundleIncidentSpy } = vi.hoisted(() => ({
    captureDebugBundleIncidentSpy: vi.fn(),
}));

const mockUpdateInvoice = vi.fn();
const mockShowSuccess = vi.fn();
const mockOnClose = vi.fn();
const mockGeneratePDFBase64 = vi.fn(async () => 'bW9ja3BkZg==');
let mockHostedServiceSessionId = 'sess-abc';
let mockActiveStorageProvider = 'google-drive';
let mockActiveStorageGeneration = 4;
let mockActiveStorageSessionId = 'sess-abc';
let mockEmailEntitlementEnforcement = false;
let mockBillingSandbox = false;
let mockBillingResolution = { kind: 'unresolved', reason: 'lifecycle' };
let mockEmailTemplates = [];
const mockUpdateUrl = vi.fn();
const mockCheckEmailAttemptStatus = vi.fn();
const mockFindBoundUnreconciledEmailAttempt = vi.fn();
const mockMarkEmailAttemptMetadataApplied = vi.fn();
const mockGetByType = vi.fn((type) => mockEmailTemplates.filter((template) => template.type === type));
const mockGetDefaultForType = vi.fn((type) => mockEmailTemplates.find((template) => template.type === type && template.isDefault) || null);
const mockDefaultTemplate = {
    id: 'tpl-default',
    name: 'Default Invoice Template',
    type: 'invoice',
    fromName: 'Jane at Acme',
    replyTo: 'billing@acme.com',
    subject: 'Invoice {invoiceNumber} from {businessName}',
    sendBody: 'Hi {clientName},',
    reminderBody: 'Reminder for {clientName}',
    attachmentTitle: 'invoice-{invoiceNumber}',
    isDefault: true,
};
const mockCreatedTemplate = {
    id: 'tpl-new',
    name: 'Fresh Template',
    type: 'invoice',
    fromName: 'Fresh Sender',
    replyTo: 'fresh@acme.com',
    subject: 'Custom subject {invoiceNumber}',
    sendBody: 'Hello {clientName}',
    reminderBody: 'Reminder {clientName}',
    attachmentTitle: 'fresh-{invoiceNumber}',
};

vi.mock('../Modal', () => ({
    default: ({ isOpen, title, children, footer, size }) => (
        isOpen ? (
            <div role="dialog" aria-label={title} data-size={size}>
                <div>{title}</div>
                <div>{children}</div>
                <div data-testid="modal-footer">{footer}</div>
            </div>
        ) : null
    ),
}));

vi.mock('../modals/EmailTemplateModal.jsx', () => ({
    default: ({ isOpen, onClose, onSaved, initialType = 'invoice' }) => (
        isOpen ? (
            <div data-testid="email-template-modal">
                <button
                    type="button"
                    onClick={() => {
                        const createdTemplate = { ...mockCreatedTemplate, type: initialType };
                        mockEmailTemplates = [...mockEmailTemplates, createdTemplate];
                        onSaved?.(createdTemplate);
                        onClose?.();
                    }}
                >
                    Save New Template
                </button>
            </div>
        ) : null
    ),
}));

vi.mock('@/contexts/YjsContext', () => ({
    useYjs: () => ({
        hostedServiceSessionId: mockHostedServiceSessionId,
        activeStorageProvider: mockActiveStorageProvider,
        activeStorageGeneration: mockActiveStorageGeneration,
        activeStorageSessionId: mockActiveStorageSessionId,
    }),
}));

vi.mock('@/contexts/BillingContext', () => ({
    useBilling: () => ({ resolution: mockBillingResolution }),
}));

vi.mock('@/config/billingFeatures', () => ({
    BILLING_FEATURES: {
        get emailEntitlementEnforcement() {
            return mockEmailEntitlementEnforcement;
        },
        get sandbox() {
            return mockBillingSandbox;
        },
    },
}));

vi.mock('@/hooks/useUrlState', () => ({
    useUrlState: () => ({ updateUrl: mockUpdateUrl }),
}));

vi.mock('@/utils/emailAttemptStorage', () => ({
    findBoundUnreconciledEmailAttempt: (...args) => mockFindBoundUnreconciledEmailAttempt(...args),
    markEmailAttemptMetadataApplied: (...args) => mockMarkEmailAttemptMetadataApplied(...args),
}));

vi.mock('@/hooks/useInvoices.ts', () => ({
    useInvoices: () => ({ updateInvoice: mockUpdateInvoice }),
}));

vi.mock('@/hooks/useEmailTemplates.ts', () => ({
    useEmailTemplates: () => ({
        getByType: mockGetByType,
        getDefaultForType: mockGetDefaultForType,
    }),
}));

vi.mock('@/hooks/useToast.ts', () => ({
    useToast: () => ({ showSuccess: mockShowSuccess }),
}));

vi.mock('@/utils/debugbundle', () => ({
    captureDebugBundleIncident: captureDebugBundleIncidentSpy,
}));

const mockSendInvoiceEmail = vi.fn();

vi.mock('@/utils/emailService', () => ({
    sendInvoiceEmail: (...args) => mockSendInvoiceEmail(...args),
    checkEmailAttemptStatus: (...args) => mockCheckEmailAttemptStatus(...args),
    isEmailSendError: (err) => typeof err === 'object' && err !== null && 'type' in err && 'message' in err,
}));

vi.mock('@/utils/pdfUtils.ts', () => ({
    getCurrentInvoiceHtmlContent: () => '<html>mock pdf html</html>',
    generatePDFBase64: (...args) => mockGeneratePDFBase64(...args),
}));

vi.mock('@/utils/currencyUtils.ts', () => ({
    getCurrencySymbol: () => '$',
    getPreferredCurrency: () => 'USD',
    normalizeCurrencyCode: (currency) => currency || 'USD',
}));

vi.mock('@/utils/invoiceUtils.ts', () => ({
    getInvoiceTotal: (inv) => inv.total || 0,
    isInvoiceCanceled: (inv) => inv?.status === 'canceled',
}));

vi.mock('@/utils/dateUtils.ts', () => ({
    toDisplayDate: (d) => d,
}));

vi.mock('@/hooks/usePreferences.ts', () => ({
    usePreferences: () => ({ preferences: { currency: 'USD' } }),
}));

// ---- Test data ----

const invoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-001',
    projectId: 'proj-1',
    clientId: 'client-1',
    date: '2026-04-01',
    dueDate: '2026-04-30',
    status: 'sent',
    items: [],
    subtotal: 500,
    total: 500,
    currency: 'USD',
};

const quoteDocument = {
    id: 'quote-project-1-2026-05-28',
    invoiceNumber: '28123045',
    projectId: 'proj-1',
    clientId: 'client-1',
    date: '2026-05-28',
    dueDate: null,
    total: 800,
    subtotal: 800,
    currency: 'USD',
    documentMode: 'quote',
    tasks: [],
    additionalTasks: [],
};

const client = {
    id: 'client-1',
    title: 'Acme Corp',
    clientName: 'Acme Corp',
    email: 'billing@acme.com',
};

const businessInfo = {
    id: 'biz-1',
    businessName: 'MyBiz',
    email: 'me@mybiz.com',
};

const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    invoice,
    client,
    businessInfo,
    clients: [client],
    sendType: 'invoice',
};

describe('EmailPreviewModal', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        mockHostedServiceSessionId = 'sess-abc';
        mockActiveStorageProvider = 'google-drive';
        mockActiveStorageGeneration = 4;
        mockActiveStorageSessionId = 'sess-abc';
        mockEmailEntitlementEnforcement = false;
        mockBillingSandbox = false;
        mockBillingResolution = { kind: 'unresolved', reason: 'lifecycle' };
        mockEmailTemplates = [];
        mockSendInvoiceEmail.mockReset();
        mockCheckEmailAttemptStatus.mockReset();
        mockFindBoundUnreconciledEmailAttempt.mockReset();
        mockFindBoundUnreconciledEmailAttempt.mockResolvedValue(null);
        mockMarkEmailAttemptMetadataApplied.mockReset();
        mockMarkEmailAttemptMetadataApplied.mockResolvedValue(true);
        mockGeneratePDFBase64.mockReset();
        mockGeneratePDFBase64.mockResolvedValue('bW9ja3BkZg==');
        mockGetByType.mockClear();
        mockGetDefaultForType.mockClear();
    });

    it('renders email preview with correct fields', () => {

        mockEmailTemplates = [mockDefaultTemplate];

        render(<EmailPreviewModal {...defaultProps} />);

        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.getByRole('dialog').dataset.size).toBe('2xl');

        // To field pre-filled with client email
        const toInput = screen.getByLabelText('To');
        expect(toInput.value).toBe('billing@acme.com');

        // Subject resolved from defaults
        const subjectInput = screen.getByLabelText('Subject');
        expect(subjectInput.value).toContain('Invoice INV-001 from MyBiz');

        expect(screen.getByLabelText('From Name').value).toBe('Jane at Acme');
        expect(screen.getByLabelText('Reply-To').value).toBe('billing@acme.com');

        // Attachment filename
        const attachInput = screen.getByLabelText('Attachment Filename');
        expect(attachInput.value).toContain('invoice-INV-001');
        expect(attachInput.value).not.toContain('.pdf');
    });

    it('prefills reply-to from business email when no template override is available', () => {

        mockEmailTemplates = [{
            ...mockDefaultTemplate,
            replyTo: '',
        }];

        render(<EmailPreviewModal {...defaultProps} />);

        expect(screen.getByLabelText('Reply-To').value).toBe('me@mybiz.com');
    });

    it('leaves reply-to empty when neither template nor business email provides it', () => {

        mockEmailTemplates = [{
            ...mockDefaultTemplate,
            replyTo: '',
        }];

        render(
            <EmailPreviewModal
                {...defaultProps}
                businessInfo={{ id: 'biz-1', businessName: 'NoBiz' }}
            />
        );

        expect(screen.getByLabelText('Reply-To').value).toBe('');
    });

    it('shows the template row with a no-template option and leaves subject/body empty when no email templates exist', () => {

        render(<EmailPreviewModal {...defaultProps} />);

        expect(screen.getByText('Email Template')).toBeTruthy();
        expect(screen.getByText('No email template')).toBeTruthy();
        expect(screen.getByRole('button', { name: '+ New Template' })).toBeTruthy();
        expect(screen.getByLabelText('Subject').value).toBe('');
        expect(screen.getByLabelText('Message').value).toBe('');
    });

    it('shows the forward copy checkbox in the footer', () => {

        mockEmailTemplates = [mockDefaultTemplate];

        render(<EmailPreviewModal {...defaultProps} />);

        expect(screen.getByRole('checkbox', { name: 'Forward this email to me' })).toBeTruthy();
    });

    it('shows a provider-neutral warning when no active cloud session is available', () => {

        mockHostedServiceSessionId = null;

        render(<EmailPreviewModal {...defaultProps} />);

        expect(screen.getByText(/Cloud provider required/)).toBeTruthy();
    });

    it('blocks canceled invoices before generating or sending an email', async () => {
        const user = userEvent.setup();

        mockEmailTemplates = [mockDefaultTemplate];
        render(
            <EmailPreviewModal
                {...defaultProps}
                invoice={{
                    ...invoice,
                    status: 'canceled',
                    canceledAt: 2,
                    cancellationReason: 'Duplicate invoice',
                }}
            />
        );

        await user.click(screen.getByRole('button', { name: 'Send Invoice' }));

        expect(screen.getByText('Canceled invoices cannot be sent by email.')).toBeTruthy();
        expect(mockGeneratePDFBase64).not.toHaveBeenCalled();
        expect(mockSendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('resolves the clientName placeholder from the contact person', () => {

        mockEmailTemplates = [mockDefaultTemplate];

        render(
            <EmailPreviewModal
                {...defaultProps}
                client={{
                    ...client,
                    clientName: 'Acme Corp',
                    contactPerson: 'Jane Doe',
                }}
            />
        );

        const bodyInput = screen.getByLabelText('Message');
        expect(bodyInput.value).toContain('Hi Jane Doe,');
        expect(bodyInput.value).not.toContain('Hi Acme Corp,');
    });

    it('opens the new template modal and applies the newly created template', async () => {

        const user = userEvent.setup();

        render(<EmailPreviewModal {...defaultProps} />);

        await user.click(screen.getByRole('button', { name: '+ New Template' }));

        expect(screen.queryByRole('dialog', { name: /Send Invoice/i })).toBeNull();
        expect(screen.getByTestId('email-template-modal')).toBeTruthy();

        await user.click(screen.getByRole('button', { name: 'Save New Template' }));

        await waitFor(() => {
            expect(screen.queryByTestId('email-template-modal')).toBeNull();
        });

        expect(screen.getByLabelText('Subject').value).toBe('Custom subject INV-001');
        expect(screen.getByLabelText('Message').value).toBe('Hello Acme Corp');
        expect(screen.getByLabelText('From Name').value).toBe('Fresh Sender');
        expect(screen.getByLabelText('Reply-To').value).toBe('fresh@acme.com');
        expect(screen.getByLabelText('Attachment Filename').value).toBe('fresh-INV-001');
    });

    it('strips .pdf from the attachment filename before sending', async () => {

        const user = userEvent.setup();

        mockEmailTemplates = [mockDefaultTemplate];
        mockSendInvoiceEmail.mockResolvedValue({ success: true, remaining: 9 });

        render(<EmailPreviewModal {...defaultProps} />);

        fireEvent.change(screen.getByLabelText('Attachment Filename'), { target: { value: 'custom-file.pdf' } });
        expect(screen.getByLabelText('Attachment Filename').value).toBe('custom-file');
        await user.click(screen.getByRole('button', { name: /Send Invoice/i }));

        await waitFor(() => {
            expect(mockSendInvoiceEmail).toHaveBeenCalledOnce();
        });

        expect(mockSendInvoiceEmail.mock.calls[0][0].attachmentTitle).toBe('custom-file');
    });

    it('sends invoice email on confirm and updates state', async () => {

        const user = userEvent.setup();

        mockEmailTemplates = [mockDefaultTemplate];

        mockSendInvoiceEmail.mockResolvedValue({ success: true, remaining: 9 });

        render(<EmailPreviewModal {...defaultProps} />);

        const sendButton = screen.getByRole('button', { name: /Send Invoice/i });
        await user.click(sendButton);

        await waitFor(() => {
            expect(mockSendInvoiceEmail).toHaveBeenCalledOnce();
        });

        const call = mockSendInvoiceEmail.mock.calls[0][0];
        expect(call.sessionId).toBe('sess-abc');
        expect(call.invoiceId).toBe('inv-1');
        expect(call.to).toBe('billing@acme.com');
        expect(call.sendType).toBe('invoice');
        expect(call.fromName).toBe('Jane at Acme');
        expect(call.replyTo).toBe('billing@acme.com');
        expect(call.pdfBase64).toBe('bW9ja3BkZg==');
        expect(call.attachmentTitle).toContain('invoice-INV-001');

        // Should update invoice locally
        await waitFor(() => {
            expect(mockUpdateInvoice).toHaveBeenCalledWith('inv-1', expect.objectContaining({
                sentToEmail: 'billing@acme.com',
            }));
        });

        // Should show success toast
        expect(mockShowSuccess).toHaveBeenCalledWith(
            expect.stringContaining('billing@acme.com')
        );

        // Should close modal
        expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('forwards a copy to the sender address when selected', async () => {

        const user = userEvent.setup();

        mockEmailTemplates = [mockDefaultTemplate];
        mockSendInvoiceEmail.mockResolvedValue({ success: true, remaining: 8, forwarded: true });

        render(<EmailPreviewModal {...defaultProps} />);

        await user.click(screen.getByRole('checkbox', { name: 'Forward this email to me' }));
        await user.click(screen.getByRole('button', { name: /Send Invoice/i }));

        await waitFor(() => {
            expect(mockSendInvoiceEmail).toHaveBeenCalledOnce();
        });

        expect(mockSendInvoiceEmail).toHaveBeenCalledWith(expect.objectContaining({
            forwardTo: 'billing@acme.com',
        }));
        expect(mockShowSuccess).toHaveBeenCalledWith(
            expect.stringContaining('forwarded to billing@acme.com')
        );
    });

    it('uses the business email for the forwarded copy when reply-to is blank', async () => {

        const user = userEvent.setup();

        mockEmailTemplates = [{
            ...mockDefaultTemplate,
            replyTo: '',
        }];
        mockSendInvoiceEmail.mockResolvedValue({ success: true, remaining: 8, forwarded: true });

        render(<EmailPreviewModal {...defaultProps} />);

        await user.click(screen.getByRole('checkbox', { name: 'Forward this email to me' }));
        await user.click(screen.getByRole('button', { name: /Send Invoice/i }));

        await waitFor(() => {
            expect(mockSendInvoiceEmail).toHaveBeenCalledOnce();
        });

        expect(mockSendInvoiceEmail).toHaveBeenCalledWith(expect.objectContaining({
            forwardTo: 'me@mybiz.com',
        }));
    });

    it('shows a clear error when forwarding is selected without a sender address', async () => {

        const user = userEvent.setup();

        mockEmailTemplates = [{
            ...mockDefaultTemplate,
            replyTo: '',
        }];

        render(
            <EmailPreviewModal
                {...defaultProps}
                businessInfo={{ id: 'biz-1', businessName: 'NoBiz' }}
            />
        );

        await user.click(screen.getByRole('checkbox', { name: 'Forward this email to me' }));
        await user.click(screen.getByRole('button', { name: /Send Invoice/i }));

        await waitFor(() => {
            expect(screen.getByText((content) => content.includes('Add a Reply-To or business email'))).toBeTruthy();
        });

        expect(mockSendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('keeps the invoice send successful when the forwarded copy fails', async () => {

        const user = userEvent.setup();

        mockEmailTemplates = [mockDefaultTemplate];
        mockSendInvoiceEmail.mockResolvedValue({ success: true, remaining: 9, forwarded: false });

        render(<EmailPreviewModal {...defaultProps} />);

        await user.click(screen.getByRole('checkbox', { name: 'Forward this email to me' }));
        await user.click(screen.getByRole('button', { name: /Send Invoice/i }));

        await waitFor(() => {
            expect(mockSendInvoiceEmail).toHaveBeenCalledOnce();
        });

        expect(mockShowSuccess).toHaveBeenCalledWith(
            expect.stringContaining('The copy to billing@acme.com could not be sent')
        );
        expect(mockUpdateInvoice).toHaveBeenCalledWith('inv-1', expect.objectContaining({
            sentToEmail: 'billing@acme.com',
        }));
        expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('does not claim the email was forwarded when the worker does not confirm it', async () => {

        const user = userEvent.setup();

        mockEmailTemplates = [mockDefaultTemplate];
        mockSendInvoiceEmail.mockResolvedValue({ success: true, remaining: 9 });

        render(<EmailPreviewModal {...defaultProps} />);

        await user.click(screen.getByRole('checkbox', { name: 'Forward this email to me' }));
        await user.click(screen.getByRole('button', { name: /Send Invoice/i }));

        await waitFor(() => {
            expect(mockShowSuccess).toHaveBeenCalled();
        });

        expect(mockShowSuccess).toHaveBeenCalledWith('Invoice emailed to billing@acme.com (9 emails remaining this month)');
    });

    it('uses reminder template and sendType for reminders', () => {

        mockEmailTemplates = [mockDefaultTemplate];

        render(
            <EmailPreviewModal
                {...defaultProps}
                sendType="reminder"
            />
        );

        expect(screen.getByRole('button', { name: /Send Reminder/i })).toBeTruthy();

        const subjectInput = screen.getByLabelText('Subject');
        expect(subjectInput.value).toContain('Reminder:');
    });

    it('uses quote wording and defaults without invoice templates', () => {

        render(
            <EmailPreviewModal
                {...defaultProps}
                invoice={quoteDocument}
                sendType="quote"
            />
        );

        expect(screen.getByRole('dialog', { name: /Send Quote/i })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Send Quote/i })).toBeTruthy();
        expect(screen.getByText('Email Template')).toBeTruthy();
        expect(screen.getByText('No email template')).toBeTruthy();
        expect(screen.getByLabelText('Subject').value).toBe('Quote 28123045 from MyBiz');
        expect(screen.getByLabelText('Message').value).toContain('Please find attached quote 28123045');
        expect(screen.getByLabelText('Attachment Filename').value).toBe('quote-28123045');
    });

    it('filters quote sends to quote templates only', () => {

        mockEmailTemplates = [
            mockDefaultTemplate,
            {
                id: 'tpl-quote',
                name: 'Default Quote Template',
                type: 'quote',
                fromName: 'Quotes at Acme',
                replyTo: 'quotes@acme.com',
                subject: 'Quote {invoiceNumber} from {businessName}',
                sendBody: 'Quote body for {clientName}',
                reminderBody: '',
                attachmentTitle: 'quote-{invoiceNumber}',
                isDefault: true,
            },
        ];

        render(
            <EmailPreviewModal
                {...defaultProps}
                invoice={quoteDocument}
                sendType="quote"
            />
        );

        expect(screen.getByLabelText('From Name').value).toBe('Quotes at Acme');
        expect(screen.getByLabelText('Reply-To').value).toBe('quotes@acme.com');
        expect(screen.getByLabelText('Subject').value).toBe('Quote 28123045 from MyBiz');
        expect(screen.getByLabelText('Message').value).toBe('Quote body for Acme Corp');
    });

    it('sends a quote without updating invoice state', async () => {

        const user = userEvent.setup();

        mockSendInvoiceEmail.mockResolvedValue({ success: true, remaining: 9 });

        render(
            <EmailPreviewModal
                {...defaultProps}
                invoice={quoteDocument}
                sendType="quote"
            />
        );

        await user.click(screen.getByRole('button', { name: /Send Quote/i }));

        await waitFor(() => {
            expect(mockSendInvoiceEmail).toHaveBeenCalledOnce();
        });

        expect(mockSendInvoiceEmail).toHaveBeenCalledWith(expect.objectContaining({
            invoiceId: 'quote-project-1-2026-05-28',
            invoiceNumber: '28123045',
            sendType: 'quote',
            attachmentTitle: 'quote-28123045',
        }));
        expect(mockUpdateInvoice).not.toHaveBeenCalled();
        expect(mockShowSuccess).toHaveBeenCalledWith(expect.stringContaining('Quote emailed to billing@acme.com'));
        expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('displays error from service and keeps modal open', async () => {

        const user = userEvent.setup();

        mockEmailTemplates = [mockDefaultTemplate];
        mockSendInvoiceEmail.mockRejectedValue({
            type: 'quota_exceeded',
            message: 'Forwarding a copy requires 2 emails, but only 1 email remains this month.',
            remaining: 1,
        });

        render(<EmailPreviewModal {...defaultProps} />);

        await user.click(screen.getByRole('checkbox', { name: 'Forward this email to me' }));

        const sendButton = screen.getByRole('button', { name: /Send Invoice/i });
        await user.click(sendButton);

        await waitFor(() => {
            expect(screen.getByText((content) => content.includes('Forwarding a copy requires 2 emails'))).toBeTruthy();
        });

        // Modal should still be open (onClose not called)
        expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('displays already_sent error with guidance', async () => {

        const user = userEvent.setup();

        mockEmailTemplates = [mockDefaultTemplate];
        mockSendInvoiceEmail.mockRejectedValue({
            type: 'already_sent',
            message: 'This invoice has already been emailed',
        });

        render(<EmailPreviewModal {...defaultProps} />);

        await user.click(screen.getByRole('button', { name: /Send Invoice/i }));

        await waitFor(() => {
            expect(screen.getByText((content) => content.includes('already been emailed'))).toBeTruthy();
        });
    });

    it('captures unexpected non-pdf send-flow failures as incidents', async () => {

        const user = userEvent.setup();

        mockEmailTemplates = [mockDefaultTemplate];
        mockSendInvoiceEmail.mockImplementation(() => {
            throw new Error('Unexpected worker response shape');
        });

        render(<EmailPreviewModal {...defaultProps} />);

        await user.click(screen.getByRole('button', { name: /Send Invoice/i }));

        await waitFor(() => {
            expect(screen.getByText((content) => content.includes('Unexpected error: Unexpected worker response shape'))).toBeTruthy();
        });

        expect(captureDebugBundleIncidentSpy).toHaveBeenCalledWith(expect.objectContaining({
            incidentKey: 'invoice.email_send_unexpected_failed',
            context: expect.objectContaining({
                stage: 'send',
                sendType: 'invoice',
            }),
        }));
    });

    it('does not duplicate incidents for pdf generation failures already captured in pdfUtils', async () => {

        const user = userEvent.setup();

        mockEmailTemplates = [mockDefaultTemplate];
        mockGeneratePDFBase64.mockRejectedValueOnce(new Error('PDF generation failed'));

        render(<EmailPreviewModal {...defaultProps} />);

        await user.click(screen.getByRole('button', { name: /Send Invoice/i }));

        await waitFor(() => {
            expect(screen.getByText((content) => content.includes('Unexpected error: PDF generation failed'))).toBeTruthy();
        });

        expect(captureDebugBundleIncidentSpy).not.toHaveBeenCalled();
    });

    it('does not call send when no session', async () => {

        const user = userEvent.setup();
        mockHostedServiceSessionId = null;

        render(<EmailPreviewModal {...defaultProps} />);

        const sendButton = screen.getByRole('button', { name: /Send Invoice/i });
        await user.click(sendButton);

        await waitFor(() => {
            expect(screen.getAllByText((content) => content.includes('Connect a cloud provider')).length).toBeGreaterThan(0);
        });

        expect(mockSendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('keeps draft and manual delivery controls available while hosted Send is locked on Free', async () => {
        const user = userEvent.setup();
        mockEmailEntitlementEnforcement = true;
        mockBillingResolution = {
            kind: 'canonical',
            snapshot: {
                accessStatus: 'free',
                entitlements: [],
            },
        };
        mockEmailTemplates = [mockDefaultTemplate];

        render(<EmailPreviewModal {...defaultProps} />);

        expect(screen.getByText('Hosted Send is a Pro feature')).toBeTruthy();
        const upgradeNotice = screen.getByText('Hosted Send is a Pro feature').closest('.rounded-md');
        const upgradeButton = screen.getByRole('button', { name: 'View Pro options' });

        expect(upgradeNotice).toHaveClass('bg-muted', 'border-border');
        expect(upgradeNotice).not.toHaveClass('status-warning-surface');
        expect(screen.getByTestId('modal-footer')).toContainElement(upgradeButton);
        expect(upgradeButton).toHaveClass('bg-primary');
        expect(upgradeButton.querySelector('svg')).not.toBeNull();
        expect(screen.queryByRole('button', { name: /Send Invoice/i })).toBeNull();
        expect(screen.getByLabelText('Subject')).not.toBeDisabled();
        expect(screen.getByLabelText('Message')).not.toBeDisabled();
        expect(screen.getByRole('checkbox', { name: 'Forward this email to me' })).not.toBeDisabled();

        await user.click(upgradeButton);

        expect(mockOnClose).toHaveBeenCalledOnce();
        expect(mockUpdateUrl).toHaveBeenCalledWith({ view: 'account', section: 'billing' });
        expect(mockSendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('keeps hosted email disabled while real billing runs in the local sandbox', () => {
        mockEmailEntitlementEnforcement = true;
        mockBillingSandbox = true;
        mockBillingResolution = {
            kind: 'canonical',
            snapshot: {
                accessStatus: 'active',
                entitlements: ['invoice.email.send'],
            },
        };
        mockEmailTemplates = [mockDefaultTemplate];

        render(<EmailPreviewModal {...defaultProps} />);

        expect(screen.getByText('Hosted Send is disabled in the billing sandbox')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Send Invoice/i })).toBeDisabled();
        expect(screen.getByLabelText('Subject')).not.toBeDisabled();
        expect(screen.getByLabelText('Message')).not.toBeDisabled();
        expect(mockFindBoundUnreconciledEmailAttempt).not.toHaveBeenCalled();
        expect(mockSendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('reconciles an ambiguous delivery without starting a second send', async () => {
        const user = userEvent.setup();
        mockEmailEntitlementEnforcement = true;
        mockBillingResolution = {
            kind: 'canonical',
            snapshot: {
                accessStatus: 'active',
                entitlements: ['invoice.email.send'],
            },
        };
        mockEmailTemplates = [mockDefaultTemplate];
        mockFindBoundUnreconciledEmailAttempt.mockResolvedValue({ attemptId: 'attempt-existing' });
        mockCheckEmailAttemptStatus.mockResolvedValue({
            state: 'completed',
            primary: { outcome: 'accepted', acceptedAt: '2026-08-30T08:00:00.000Z', reason: null },
            forward: null,
            quota: {
                entitled: true,
                effectiveRemaining: 9,
                periodEnd: '2026-09-01T00:00:00.000Z',
                awaitingConfirmation: 0,
            },
        });

        render(<EmailPreviewModal {...defaultProps} />);

        await screen.findByText(/previous hosted send needs delivery confirmation/i);
        await user.click(screen.getByRole('button', { name: 'Check status' }));

        await waitFor(() => {
            expect(mockUpdateInvoice).toHaveBeenCalledWith('inv-1', {
                sentAt: expect.any(Number),
                sentToEmail: 'billing@acme.com',
            });
        });
        expect(mockCheckEmailAttemptStatus).toHaveBeenCalledWith({
            sessionId: 'sess-abc',
            billingLifecycle: {
                provider: 'google-drive',
                generation: 4,
                sessionId: 'sess-abc',
            },
            attemptId: 'attempt-existing',
        });
        expect(mockMarkEmailAttemptMetadataApplied).toHaveBeenCalledWith(
            'attempt-existing',
            expect.objectContaining({ sessionId: 'sess-abc' }),
        );
        expect(mockSendInvoiceEmail).not.toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalledOnce();
    });

    it('shows clear error when sending with blank subject (no template selected)', async () => {

        const user = userEvent.setup();

        render(<EmailPreviewModal {...defaultProps} />);

        // No templates loaded → subject is blank
        expect(screen.getByLabelText('Subject').value).toBe('');

        await user.click(screen.getByRole('button', { name: /Send Invoice/i }));

        await waitFor(() => {
            expect(screen.getByText((content) => content.includes('Subject is required'))).toBeTruthy();
        });

        expect(mockSendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('returns null when no invoice', () => {

        const { container } = render(
            <EmailPreviewModal {...defaultProps} invoice={null} />
        );

        expect(container.innerHTML).toBe('');
    });

    it('does not promote status when sendType is reminder', async () => {

        const user = userEvent.setup();

        mockEmailTemplates = [mockDefaultTemplate];
        mockSendInvoiceEmail.mockResolvedValue({ success: true, remaining: 8 });

        render(
            <EmailPreviewModal
                {...defaultProps}
                sendType="reminder"
                invoice={{ ...invoice, status: 'overdue', sentAt: 1000 }}
            />
        );

        await user.click(screen.getByRole('button', { name: /Send Reminder/i }));

        await waitFor(() => {
            expect(mockUpdateInvoice).toHaveBeenCalledWith(
                'inv-1',
                expect.not.objectContaining({ status: 'sent' })
            );
        });
    });

    it('rejects emailing an unfinalized draft before PDF generation or sending', async () => {
        const user = userEvent.setup();
        mockEmailTemplates = [mockDefaultTemplate];

        render(<EmailPreviewModal {...defaultProps} invoice={{ ...invoice, status: 'draft' }} />);

        await user.click(screen.getByRole('button', { name: /Send Invoice/i }));

        expect(await screen.findByText(/Finalize this draft/)).toBeTruthy();
        expect(mockGeneratePDFBase64).not.toHaveBeenCalled();
        expect(mockSendInvoiceEmail).not.toHaveBeenCalled();
    });
});
