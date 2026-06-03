import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import InvoiceModal from './InvoiceModal'

let capturedModalProps = null

vi.mock('../Modal', () => ({
    default: (props) => {
        capturedModalProps = props

        if (!props.isOpen) {
            return null
        }

        return <div role="dialog">{props.children}</div>
    },
}))

vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }) => <button type="button" {...props}>{children}</button>
}))

vi.mock('@/components/ui/inline-field-header', () => ({
    InlineFieldHeader: ({ children, action }) => <div>{children}{action}</div>
}))

vi.mock('@/components/ui/native-date-input', () => ({
    NativeDateInput: (props) => <input {...props} />
}))

vi.mock('@/components/ui/label', () => ({
    Label: ({ children, ...props }) => <label {...props}>{children}</label>
}))

vi.mock('@/components/ui/select', () => ({
    Select: ({ children }) => <div>{children}</div>,
    SelectContent: ({ children }) => <div>{children}</div>,
    SelectItem: ({ children }) => <div>{children}</div>,
    SelectTrigger: ({ children }) => <button type="button">{children}</button>,
    SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
}))

vi.mock('@/components/ui/textarea', () => ({
    Textarea: (props) => <textarea {...props} />
}))

vi.mock('@/components/ui/notice', () => ({
    Notice: ({ title, description }) => <div>{title}{description}</div>
}))

vi.mock('@/components/ui/period-range-picker', () => ({
    default: () => <div>Period range picker</div>
}))

vi.mock('../CustomCheckbox', () => ({
    default: ({ labelClassName, ...props }) => <input type="checkbox" {...props} />
}))

vi.mock('./InvoiceTaskSelector', () => ({
    default: ({ autoFocusToggle = false }) => (
        <button
            type="button"
            data-testid="tasks-time-toggle"
            {...(autoFocusToggle ? { 'data-autofocus': true } : {})}
        >
            Tasks & Time
        </button>
    )
}))

vi.mock('./InvoiceExpenseSelector', () => ({
    default: () => <div>Expense selector</div>
}))

vi.mock('./InvoicePreview', () => ({
    default: () => <div>Preview</div>
}))

vi.mock('./InvoiceActions', () => ({
    default: () => <div>Actions</div>
}))

const baseProps = {
    showInvoiceForm: true,
    editingInvoice: null,
    handleClose: vi.fn(),
    handleSaveInvoice: vi.fn(),
    handlePreviewInvoice: vi.fn(),
    isProjectContextFixed: false,
    isClientContextFixed: false,
    projects: [],
    selectedProject: null,
    selectedAdditionalProjectIds: [],
    setSelectedAdditionalProjectIds: vi.fn(),
    handleProjectSelection: vi.fn(),
    clients: [],
    selectedClient: null,
    handleClientSelection: vi.fn(),
    invoiceTasks: [],
    setShowAddTaskForm: vi.fn(),
    showAddTaskForm: false,
    newTaskTitle: '',
    setNewTaskTitle: vi.fn(),
    newTaskUseFlatRate: false,
    handleToggleNewTaskFlatRate: vi.fn(),
    newTaskQuantity: '',
    setNewTaskQuantity: vi.fn(),
    newTaskHours: '',
    setNewTaskHours: vi.fn(),
    newTaskHourlyRate: '',
    setNewTaskHourlyRate: vi.fn(),
    additionalTasks: [],
    handleAddAdditionalTask: vi.fn(),
    handleRemoveAdditionalTask: vi.fn(),
    handleTaskSelectionForBilling: vi.fn(),
    handleHoursChange: vi.fn(),
    handleFlatRateChange: vi.fn(),
    handleQuantityChange: vi.fn(),
    handleTaskHourlyRateChange: vi.fn(),
    handleAdditionalTaskHoursChange: vi.fn(),
    handleAdditionalTaskFlatRateChange: vi.fn(),
    handleAdditionalTaskQuantityChange: vi.fn(),
    handleAdditionalTaskHourlyRateChange: vi.fn(),
    handleToggleAdditionalTaskFlatRate: vi.fn(),
    calculatePricing: vi.fn(() => ({ subtotal: 0, total: 0 })),
    discountType: 'fixed',
    setDiscountType: vi.fn(),
    discountValue: '',
    setDiscountValue: vi.fn(),
    shippingAmount: '',
    setShippingAmount: vi.fn(),
    taxOverride: '',
    setTaxOverride: vi.fn(),
    getCurrencySymbol: vi.fn(() => '$'),
    businessInfos: [],
    selectedBusinessInfo: null,
    paymentMethods: [],
    selectedPaymentMethod: null,
    invoiceNote: '',
    setInvoiceNote: vi.fn(),
    editableHours: {},
    taskFlatRates: {},
    useFlatRate: {},
    taskHourlyRates: {},
    taskQuantities: {},
    setNewTaskUseFlatRate: vi.fn(),
    selectedTasksForBilling: {},
    setSelectedTasksForBilling: vi.fn(),
    availableExpenses: [],
    selectedExpensesForBilling: {},
    setSelectedExpensesForBilling: vi.fn(),
    additionalExpenses: [],
    showAddExpenseForm: false,
    setShowAddExpenseForm: vi.fn(),
    newExpenseTitle: '',
    setNewExpenseTitle: vi.fn(),
    newExpenseAmount: '',
    setNewExpenseAmount: vi.fn(),
    newExpenseCurrency: 'USD',
    setNewExpenseCurrency: vi.fn(),
    newExpenseSupplierName: '',
    setNewExpenseSupplierName: vi.fn(),
    handleAddAdditionalExpense: vi.fn(),
    handleRemoveAdditionalExpense: vi.fn(),
    conversionUnavailableCount: 0,
    exchangeRatesError: null,
    exchangeRatesLoading: false,
    setSelectedPaymentMethod: vi.fn(),
    setSelectedBusinessInfo: vi.fn(),
    mergedSubtasks: false,
    handleToggleMergeSubtasks: vi.fn(),
    taskInputRef: { current: null },
    invoiceTemplates: [],
    selectedTemplate: null,
    handleTemplateSelection: vi.fn(),
    invoiceDateOverride: '',
    setInvoiceDateOverride: vi.fn(),
    useInvoiceDateOverride: false,
    setUseInvoiceDateOverride: vi.fn(),
    billingPeriodPreset: 'all',
    setBillingPeriodPreset: vi.fn(),
    billingPeriodStart: '',
    setBillingPeriodStart: vi.fn(),
    billingPeriodEnd: '',
    setBillingPeriodEnd: vi.fn(),
    billingPeriodOptions: [],
    openClientModal: vi.fn(),
    openProjectModal: vi.fn(),
    openBusinessModal: vi.fn(),
    openPaymentMethodModal: vi.fn(),
    openTemplateModal: vi.fn(),
    saveFormState: vi.fn(),
    getSavedState: vi.fn(() => null),
    clearSavedState: vi.fn(),
}

describe('InvoiceModal', () => {
    beforeEach(() => {
        capturedModalProps = null
    })

    it('lets the shared dialog autofocus behavior run', () => {
        render(<InvoiceModal {...baseProps} />)

        expect(screen.getByRole('dialog')).toBeInTheDocument()
        expect(capturedModalProps?.onOpenAutoFocus).toBeUndefined()
    })

    it('marks the first section toggle as the explicit autofocus target', () => {
        render(<InvoiceModal {...baseProps} />)

        expect(screen.getByRole('button', { name: /client & project details/i })).toHaveAttribute('data-autofocus')
    })

    it('marks the tasks toggle as the explicit autofocus target when opened from a project dashboard', () => {
        render(<InvoiceModal {...baseProps} openedFromProjectContext />)

        expect(screen.getByTestId('tasks-time-toggle')).toHaveAttribute('data-autofocus')
        expect(screen.getByRole('button', { name: /client & project details/i })).not.toHaveAttribute('data-autofocus')
    })

    it('shows additional projects only when the modal is opened from a client dashboard', () => {
        render(
            <InvoiceModal
                {...baseProps}
                allowAdditionalProjectsSelection
                selectedClient={{ id: 'client-1', title: 'Acme' }}
                selectedProject={{ id: 'project-1', title: 'Website' }}
                projects={[
                    { id: 'project-1', title: 'Website', preferredClientId: 'client-1' },
                    { id: 'project-2', title: 'Retainer', preferredClientId: 'client-1' },
                ]}
            />
        )

        expect(screen.getByText('Additional Projects')).toBeInTheDocument()
    })

    it('hides additional projects outside the client dashboard flow', () => {
        render(
            <InvoiceModal
                {...baseProps}
                selectedClient={{ id: 'client-1', title: 'Acme' }}
                selectedProject={{ id: 'project-1', title: 'Website' }}
                projects={[
                    { id: 'project-1', title: 'Website', preferredClientId: 'client-1' },
                    { id: 'project-2', title: 'Retainer', preferredClientId: 'client-1' },
                ]}
            />
        )

        expect(screen.queryByText('Additional Projects')).not.toBeInTheDocument()
    })
})
