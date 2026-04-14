import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EmailPreviewModal from './EmailPreviewModal';

// ---- Mocks ----

const mockUpdateInvoice = vi.fn();
const mockShowSuccess = vi.fn();
const mockOnClose = vi.fn();
let mockDriveSessionId = 'sess-abc';
let mockEmailTemplates = [];
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
                <div>{footer}</div>
            </div>
        ) : null
    ),
}));

vi.mock('../modals/EmailTemplateModal.jsx', () => ({
    default: ({ isOpen, onClose, onSaved }) => (
        isOpen ? (
            <div data-testid="email-template-modal">
                <button
                    type="button"
                    onClick={() => {
                        mockEmailTemplates = [...mockEmailTemplates, mockCreatedTemplate];
                        onSaved?.(mockCreatedTemplate);
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
    useYjs: () => ({ driveSessionId: mockDriveSessionId }),
}));

vi.mock('@/hooks/useInvoices.ts', () => ({
    useInvoices: () => ({ updateInvoice: mockUpdateInvoice }),
}));

vi.mock('@/hooks/useEmailTemplates.ts', () => ({
    useEmailTemplates: () => ({
        getByType: () => mockEmailTemplates,
        getDefaultForType: () => mockEmailTemplates.find(t => t.isDefault) || null,
    }),
}));

vi.mock('@/hooks/useToast.ts', () => ({
    useToast: () => ({ showSuccess: mockShowSuccess }),
}));

const mockSendInvoiceEmail = vi.fn();

vi.mock('@/utils/emailService', () => ({
    sendInvoiceEmail: (...args) => mockSendInvoiceEmail(...args),
    isEmailSendError: (err) => typeof err === 'object' && err !== null && 'type' in err && 'message' in err,
}));

vi.mock('@/utils/pdfUtils.ts', () => ({
    getCurrentInvoiceHtmlContent: () => '<html>mock pdf html</html>',
    generatePDFBase64: vi.fn(async () => 'bW9ja3BkZg=='),
}));

vi.mock('@/utils/currencyUtils.ts', () => ({
    getCurrencySymbol: () => '$',
    getPreferredCurrency: () => 'USD',
}));

vi.mock('@/utils/invoiceUtils.ts', () => ({
    getInvoiceTotal: (inv) => inv.total || 0,
}));

vi.mock('@/utils/dateUtils.ts', () => ({
    toDisplayDate: (d) => d,
}));

// ---- Test data ----

const invoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-001',
    projectId: 'proj-1',
    clientId: 'client-1',
    date: '2026-04-01',
    dueDate: '2026-04-30',
    status: 'draft',
    items: [],
    subtotal: 500,
    total: 500,
    currency: 'USD',
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
        mockDriveSessionId = 'sess-abc';
        mockEmailTemplates = [];
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

    it('shows warning when no drive session', () => {

        mockDriveSessionId = null;

        render(<EmailPreviewModal {...defaultProps} />);

        expect(screen.getByText(/Cloud sync required/)).toBeTruthy();
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

        await user.clear(screen.getByLabelText('Attachment Filename'));
        await user.type(screen.getByLabelText('Attachment Filename'), 'custom-file.pdf');
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
                status: 'sent',
            }));
        });

        // Should show success toast
        expect(mockShowSuccess).toHaveBeenCalledWith(
            expect.stringContaining('billing@acme.com')
        );

        // Should close modal
        expect(mockOnClose).toHaveBeenCalledOnce();
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

    it('displays error from service and keeps modal open', async () => {

        const user = userEvent.setup();

        mockEmailTemplates = [mockDefaultTemplate];
        mockSendInvoiceEmail.mockRejectedValue({
            type: 'quota_exceeded',
            message: 'Monthly email limit reached',
            remaining: 0,
        });

        render(<EmailPreviewModal {...defaultProps} />);

        const sendButton = screen.getByRole('button', { name: /Send Invoice/i });
        await user.click(sendButton);

        await waitFor(() => {
            expect(screen.getByText(/Monthly email limit reached/)).toBeTruthy();
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
            expect(screen.getByText(/already been emailed/)).toBeTruthy();
        });
    });

    it('does not call send when no session', async () => {

        const user = userEvent.setup();
        mockDriveSessionId = null;

        render(<EmailPreviewModal {...defaultProps} />);

        const sendButton = screen.getByRole('button', { name: /Send Invoice/i });
        await user.click(sendButton);

        await waitFor(() => {
            expect(screen.getByText(/Connect cloud sync to enable/)).toBeTruthy();
        });

        expect(mockSendInvoiceEmail).not.toHaveBeenCalled();
    });

    it('shows clear error when sending with blank subject (no template selected)', async () => {

        const user = userEvent.setup();

        render(<EmailPreviewModal {...defaultProps} />);

        // No templates loaded → subject is blank
        expect(screen.getByLabelText('Subject').value).toBe('');

        await user.click(screen.getByRole('button', { name: /Send Invoice/i }));

        await waitFor(() => {
            expect(screen.getByText(/Subject is required/)).toBeTruthy();
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
});
