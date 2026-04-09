/**
 * ExpenseViewModal - Read-only expense details modal
 *
 * Shows summary info, payment status, and quick actions.
 */

import React, { useCallback, useMemo } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PencilIcon } from '@/components/ui/icons';
import { useExpenses } from '@/hooks/useExpenses.ts';
import { useExpenseRecurrences } from '@/hooks/useExpenseRecurrences.ts';
import { useClients } from '@/hooks/useClients.ts';
import { useProjects } from '@/hooks/useProjects.ts';
import { useBusinessInfos } from '@/hooks/useBusinessInfos.ts';
import { useToast } from '@/hooks/useToast.ts';
import { usePaymentMethods } from '@/hooks/usePaymentMethods.ts';
import { formatCurrency } from '@/utils/currencyUtils.ts';
import { parseStoredDate, toDisplayDate } from '@/utils/dateUtils.ts';
import { getOrdinalSuffix } from '@/utils/recurringUtils.ts';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Object|null} props.expense
 * @param {Function} props.onEdit
 */
const ExpenseViewModal = ({
    isOpen,
    onClose,
    expense,
    onEdit,
}) => {
    const { showSuccess, showError } = useToast();
    const { expenses, markAsPaid } = useExpenses({ includeArchived: true });
    const { recurrences } = useExpenseRecurrences();
    const { clients } = useClients();
    const { projects } = useProjects();
    const { businessInfos } = useBusinessInfos();
    const { paymentMethods } = usePaymentMethods();

    const currentExpense = useMemo(() => {
        if (!expense) return null;
        return expenses.find((item) => item.id === expense.id) || expense;
    }, [expenses, expense]);

    const recurrence = useMemo(() => {
        if (!currentExpense?.recurrenceId) return null;
        return recurrences.find((item) => item.id === currentExpense.recurrenceId) || null;
    }, [currentExpense, recurrences]);

    const client = useMemo(() => {
        if (!currentExpense?.clientId) return null;
        return clients.find((item) => item.id === currentExpense.clientId) || null;
    }, [clients, currentExpense]);

    const project = useMemo(() => {
        if (!currentExpense?.projectId) return null;
        return projects.find((item) => item.id === currentExpense.projectId) || null;
    }, [projects, currentExpense]);

    const business = useMemo(() => {
        if (!currentExpense?.businessId) return null;
        return businessInfos.find((item) => item.id === currentExpense.businessId) || null;
    }, [businessInfos, currentExpense]);

    const isPreview = Boolean(currentExpense?.isPreview);
    const isPaid = currentExpense?.paymentStatus === 'paid';
    const isAutoPayment = currentExpense?.paymentMode === 'auto'
        && currentExpense?.amountType !== 'variable';
    const showAutoPayment = currentExpense?.isRecurring && isAutoPayment;
    const isVariable = currentExpense?.amountType === 'variable';
    const amountValue = typeof currentExpense?.amount === 'number' ? currentExpense.amount : 0;
    const needsAmount = Boolean(isVariable && (!amountValue || amountValue <= 0));

    const dueInLabel = useMemo(() => {
        if (!isPreview || !currentExpense?.date) return '';
        const dueDate = parseStoredDate(currentExpense.date);
        if (!dueDate) return '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        const diffDays = differenceInCalendarDays(dueDate, today);
        if (diffDays === 0) return 'Due today';
        if (diffDays === 1) return 'Due tomorrow';
        if (diffDays > 1) return `Due in ${diffDays} days`;
        if (diffDays === -1) return 'Due yesterday';
        return `Due ${Math.abs(diffDays)} days ago`;
    }, [currentExpense?.date, isPreview]);

    const amountLabel = useMemo(() => {
        if (!currentExpense) return '';
        if (isVariable && (!amountValue || amountValue <= 0)) {
            return 'Enter amount';
        }
        const prefix = isVariable && !isPaid ? '~' : '';
        return `${prefix}${formatCurrency(amountValue || 0, currentExpense.currency)}`;
    }, [currentExpense, isVariable, amountValue, isPaid]);

    const paidByLabel = useMemo(() => {
        if (!currentExpense?.paidBy) return '';
        const method = paymentMethods.find((item) => item.id === currentExpense.paidBy);
        return method?.title || currentExpense.paidBy;
    }, [currentExpense?.paidBy, paymentMethods]);

    const recurringLabel = useMemo(() => {
        if (!recurrence?.repeat) return '';

        if (recurrence.repeat === 'monthly') {
            if (recurrence.monthlyType === 'first') return 'Monthly (1st)';
            if (recurrence.monthlyType === 'last') return 'Monthly (last)';
            const day = recurrence.monthlyDay || 1;
            return `Monthly (${day}${getOrdinalSuffix(day)})`;
        }

        if (recurrence.repeat === 'yearly') {
            const parsed = parseStoredDate(recurrence.startDate);
            if (!parsed) return 'Yearly';
            return `Yearly (${format(parsed, 'MMM d')})`;
        }

        return 'Recurring';
    }, [recurrence]);

    const handleEdit = useCallback(() => {
        if (!currentExpense) return;
        onClose();
        onEdit?.(currentExpense);
    }, [currentExpense, onClose, onEdit]);

    const handleMarkPaid = useCallback(() => {
        if (!currentExpense) return;
        try {
            markAsPaid(currentExpense.id);
            showSuccess('Expense marked as paid');
        } catch (error) {
            showError(error?.message || 'Unable to mark expense as paid');
        }
    }, [currentExpense, markAsPaid, showSuccess, showError]);

    if (!currentExpense) return null;

    const primaryAction = needsAmount ? handleEdit : handleMarkPaid;
    const primaryLabel = needsAmount ? 'Submit' : 'Mark as paid';
    const showPrimaryAction = !isPreview && !isPaid && !isAutoPayment;
    const showEditAction = !isPreview;

    const paidOnLabel = currentExpense.paidOn
        ? toDisplayDate(currentExpense.paidOn, { month: 'short', day: 'numeric', year: 'numeric' })
        : '';

    const expenseDateLabel = currentExpense.date
        ? toDisplayDate(currentExpense.date, { month: 'short', day: 'numeric', year: 'numeric' })
        : '';

    const footerLeft = isPreview
        ? (dueInLabel ? (
            <div className="text-sm text-muted-foreground">
                {dueInLabel}
            </div>
        ) : null)
        : (showPrimaryAction ? null : (
            <div className="text-sm text-muted-foreground">
                Paid {paidOnLabel ? `on ${paidOnLabel}` : ''}
            </div>
        ));

    const modalFooter = (
        <div className="flex w-full flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {footerLeft}
                {showPrimaryAction && (
                    <Button onClick={primaryAction} type="button">
                        {primaryLabel}
                    </Button>
                )}
            </div>
            {showEditAction && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                    title="Edit expense"
                    onClick={handleEdit}
                    type="button"
                >
                    <PencilIcon className="h-5 w-5" />
                </Button>
            )}
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={currentExpense.title}
            footer={modalFooter}
        >
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    {currentExpense.isRecurring && (
                        <Badge variant="secondary">Recurring</Badge>
                    )}
                    {isPreview ? (
                        <Badge variant="secondary">Upcoming</Badge>
                    ) : (
                        <>
                            <Badge variant={isPaid ? 'success' : 'warning'}>
                                {isPaid ? 'Paid' : 'Unpaid'}
                            </Badge>
                            {currentExpense.billable && (
                                <Badge variant={currentExpense.billingStatus === 'billed' ? 'success' : 'secondary'}>
                                    {currentExpense.billingStatus === 'billed' ? 'Billed' : 'Unbilled'}
                                </Badge>
                            )}
                        </>
                    )}
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-4">
                    <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount</p>
                        <p className="text-sm font-medium text-foreground sensitive-data">
                            {amountLabel}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p>
                        <p className="text-sm text-foreground">
                            {expenseDateLabel || '—'}
                        </p>
                    </div>
                    {recurringLabel && (
                        <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Repeats</p>
                            <p className="text-sm text-foreground">{recurringLabel}</p>
                        </div>
                    )}
                    <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Supplier</p>
                        <p className="text-sm text-foreground">
                            {currentExpense.supplierName || '—'}
                        </p>
                    </div>
                </div>

                {(client || project || business) && (
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-4">
                        {client && (
                            <div className="space-y-1">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Client</p>
                                <p className="text-sm text-foreground">{client.title}</p>
                            </div>
                        )}
                        {project && (
                            <div className="space-y-1">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
                                <p className="text-sm text-foreground">{project.title}</p>
                            </div>
                        )}
                        {business && (
                            <div className="space-y-1">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Business</p>
                                <p className="text-sm text-foreground">{business.title}</p>
                            </div>
                        )}
                    </div>
                )}

                {(currentExpense.note || currentExpense.receiptNumber || paidByLabel || showAutoPayment) && (
                    <div className="space-y-3">
                        {currentExpense.note && (
                            <div className="space-y-1">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Note</p>
                                <p className="text-sm text-foreground whitespace-pre-wrap">
                                    {currentExpense.note}
                                </p>
                            </div>
                        )}
                        {currentExpense.receiptNumber && (
                            <div className="space-y-1">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Receipt</p>
                                <p className="text-sm text-foreground">{currentExpense.receiptNumber}</p>
                            </div>
                        )}
                        {(paidByLabel || showAutoPayment) && (
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-4">
                                {paidByLabel && (
                                    <div className="space-y-1">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid by</p>
                                        <p className="text-sm text-foreground">{paidByLabel}</p>
                                    </div>
                                )}
                                {showAutoPayment && (
                                    <div className="space-y-1">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment mode</p>
                                        <p className="text-sm text-foreground">Auto payment</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ExpenseViewModal;
