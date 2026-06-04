import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { fetchExchangeRates, convertCurrency, formatCurrency, normalizeCurrencyCode } from '@/utils/currencyUtils';
import {
    createInvoicePaymentCurrencySnapshotFromAmounts,
    getInvoicePaymentCurrencySnapshot,
    getInvoicePaymentExchangeRate,
    getInvoiceTotal,
} from '@/utils/invoiceUtils';

const RATE_DECIMALS = 6;
const AMOUNT_DECIMALS = 2;

const formatRateInput = (value) => {
    if (!Number.isFinite(value)) {
        return '';
    }

    return value.toFixed(RATE_DECIMALS);
};

const formatAmountInput = (value) => {
    if (!Number.isFinite(value)) {
        return '';
    }

    return value.toFixed(AMOUNT_DECIMALS);
};

const parseNumericInput = (value) => {
    if (typeof value !== 'string') {
        return null;
    }

    const normalizedValue = value.replace(',', '.').trim();
    if (!normalizedValue) {
        return null;
    }

    const parsed = Number(normalizedValue);
    return Number.isFinite(parsed) ? parsed : null;
};

const getStaticSourceAmount = (invoice, snapshot) => {
    if (snapshot && typeof snapshot.sourceAmount === 'number' && Number.isFinite(snapshot.sourceAmount)) {
        return snapshot.sourceAmount;
    }

    return getInvoiceTotal(invoice);
};

const InvoicePaymentDetailsModal = ({
    isOpen,
    onClose,
    invoice,
    mode = 'mark-paid',
    preferredCurrency,
    isSaving = false,
    onSubmit,
}) => {
    const isEditMode = mode === 'edit-payment';
    const snapshot = useMemo(() => getInvoicePaymentCurrencySnapshot(invoice), [invoice]);
    const sourceCurrency = useMemo(
        () => normalizeCurrencyCode(snapshot?.sourceCurrency || invoice?.currency || preferredCurrency),
        [invoice?.currency, preferredCurrency, snapshot?.sourceCurrency]
    );
    const targetCurrency = useMemo(
        () => normalizeCurrencyCode(snapshot?.preferredCurrencyAtPayment || preferredCurrency),
        [preferredCurrency, snapshot?.preferredCurrencyAtPayment]
    );
    const sourceAmount = useMemo(
        () => getStaticSourceAmount(invoice, snapshot),
        [invoice, snapshot]
    );
    const storedReceivedAmount = snapshot?.preferredCurrencyAmount ?? null;
    const storedExchangeRate = useMemo(() => getInvoicePaymentExchangeRate(invoice), [invoice]);
    const isCrossCurrency = sourceCurrency !== targetCurrency;
    const invoiceTotalChangedAfterPayment = Boolean(
        snapshot
        && Number.isFinite(getInvoiceTotal(invoice))
        && Math.abs(getInvoiceTotal(invoice) - sourceAmount) >= 0.01
    );

    const [exchangeRateInput, setExchangeRateInput] = useState('');
    const [receivedAmountInput, setReceivedAmountInput] = useState('');
    const [liveExchangeRate, setLiveExchangeRate] = useState(null);
    const [liveReceivedAmount, setLiveReceivedAmount] = useState(null);
    const [liveRateError, setLiveRateError] = useState('');
    const [isLoadingLiveRate, setIsLoadingLiveRate] = useState(false);
    const exchangeRateInputRef = useRef('');
    const receivedAmountInputRef = useRef('');

    useEffect(() => {
        if (!isOpen || !invoice) {
            return;
        }

        const initialReceivedAmount = Number.isFinite(storedReceivedAmount)
            ? storedReceivedAmount
            : (isCrossCurrency ? null : sourceAmount);
        const initialExchangeRate = Number.isFinite(storedExchangeRate)
            ? storedExchangeRate
            : (isCrossCurrency ? null : 1);

        setExchangeRateInput(initialExchangeRate === null ? '' : formatRateInput(initialExchangeRate));
        setReceivedAmountInput(initialReceivedAmount === null ? '' : formatAmountInput(initialReceivedAmount));
        exchangeRateInputRef.current = initialExchangeRate === null ? '' : formatRateInput(initialExchangeRate);
        receivedAmountInputRef.current = initialReceivedAmount === null ? '' : formatAmountInput(initialReceivedAmount);
        setLiveExchangeRate(null);
        setLiveReceivedAmount(null);
        setLiveRateError('');
    }, [invoice, isCrossCurrency, isOpen, sourceAmount, storedExchangeRate, storedReceivedAmount]);

    useEffect(() => {
        if (!isOpen || !invoice || !isCrossCurrency || isEditMode) {
            return;
        }

        let isActive = true;
        setIsLoadingLiveRate(true);

        fetchExchangeRates()
            .then(({ rates, error }) => {
                if (!isActive) {
                    return;
                }

                if (!rates) {
                    setLiveRateError(error || 'Unable to load the current exchange rate.');
                    return;
                }

                const result = convertCurrency(sourceAmount, sourceCurrency, targetCurrency, rates);
                if (!result.success) {
                    setLiveRateError(result.error || 'Unable to convert this invoice amount.');
                    return;
                }

                const nextReceivedAmount = result.amount;
                const nextExchangeRate = sourceAmount > 0 ? result.amount / sourceAmount : null;
                setLiveReceivedAmount(nextReceivedAmount);
                setLiveExchangeRate(nextExchangeRate);

                if (storedReceivedAmount === null && !receivedAmountInputRef.current) {
                    setReceivedAmountInput(formatAmountInput(nextReceivedAmount));
                    receivedAmountInputRef.current = formatAmountInput(nextReceivedAmount);
                }

                if (storedExchangeRate === null && !exchangeRateInputRef.current && Number.isFinite(nextExchangeRate)) {
                    setExchangeRateInput(formatRateInput(nextExchangeRate));
                    exchangeRateInputRef.current = formatRateInput(nextExchangeRate);
                }

                if (error) {
                    setLiveRateError(error);
                }
            })
            .catch((error) => {
                if (!isActive) {
                    return;
                }

                setLiveRateError(error?.message || 'Unable to load the current exchange rate.');
            })
            .finally(() => {
                if (isActive) {
                    setIsLoadingLiveRate(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [
        invoice,
        isCrossCurrency,
        isEditMode,
        isOpen,
        sourceAmount,
        sourceCurrency,
        storedExchangeRate,
        storedReceivedAmount,
        targetCurrency,
    ]);

    if (!invoice || !isCrossCurrency) {
        return null;
    }

    const parsedExchangeRate = parseNumericInput(exchangeRateInput);
    const parsedReceivedAmount = parseNumericInput(receivedAmountInput);
    const isValidRate = parsedExchangeRate !== null && parsedExchangeRate > 0;
    const isValidReceivedAmount = parsedReceivedAmount !== null && parsedReceivedAmount >= 0;
    const canSubmit = isValidRate && isValidReceivedAmount && !isSaving;

    const handleExchangeRateChange = (event) => {
        const nextRateInput = event.target.value;
        exchangeRateInputRef.current = nextRateInput;
        setExchangeRateInput(nextRateInput);

        const parsedRate = parseNumericInput(nextRateInput);
        if (parsedRate === null) {
            receivedAmountInputRef.current = '';
            setReceivedAmountInput('');
            return;
        }

        const nextReceivedAmount = formatAmountInput(sourceAmount * parsedRate);
        receivedAmountInputRef.current = nextReceivedAmount;
        setReceivedAmountInput(nextReceivedAmount);
    };

    const handleReceivedAmountChange = (event) => {
        const nextReceivedAmountInput = event.target.value;
        receivedAmountInputRef.current = nextReceivedAmountInput;
        setReceivedAmountInput(nextReceivedAmountInput);

        const parsedAmount = parseNumericInput(nextReceivedAmountInput);
        if (parsedAmount === null || sourceAmount <= 0) {
            exchangeRateInputRef.current = '';
            setExchangeRateInput('');
            return;
        }

        const nextExchangeRate = formatRateInput(parsedAmount / sourceAmount);
        exchangeRateInputRef.current = nextExchangeRate;
        setExchangeRateInput(nextExchangeRate);
    };

    const handleSubmit = () => {
        if (!canSubmit) {
            return;
        }

        const paymentCurrencySnapshot = createInvoicePaymentCurrencySnapshotFromAmounts({
            sourceCurrency,
            sourceAmount,
            preferredCurrency: targetCurrency,
            preferredCurrencyAmount: parsedReceivedAmount,
            capturedAt: snapshot?.capturedAt || invoice?.paidAt || Date.now(),
        });

        onSubmit?.({ paymentCurrencySnapshot });
    };

    const footer = (
        <div className="flex w-full flex-wrap justify-end gap-3">
            <Button
                variant="outline"
                onClick={onClose}
                disabled={isSaving}
                type="button"
            >
                Cancel
            </Button>
            <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                loading={isSaving}
                loadingText={mode === 'mark-paid' ? 'Marking as Paid' : 'Saving Payment'}
                type="button"
            >
                {mode === 'mark-paid' ? 'Mark as Paid' : 'Save Payment Details'}
            </Button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'mark-paid' ? 'Confirm Payment Conversion' : 'Edit Payment Details'}
            size="lg"
            footer={footer}
        >
            <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoice total</p>
                        <p className="mt-1 text-base font-semibold text-foreground sensitive-data">
                            {formatCurrency(sourceAmount, sourceCurrency)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{sourceCurrency}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Exchange rate</p>
                        <p className="mt-1 text-base font-semibold text-foreground sensitive-data">
                            {exchangeRateInput || '...'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            1 {sourceCurrency} in {targetCurrency}
                        </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Received amount</p>
                        <p className="mt-1 text-base font-semibold text-foreground sensitive-data">
                            {isValidReceivedAmount ? formatCurrency(parsedReceivedAmount, targetCurrency) : '...'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{targetCurrency}</p>
                    </div>
                </div>

                {invoiceTotalChangedAfterPayment && (
                    <Notice
                        title="This invoice total changed after the payment snapshot was captured."
                        description="Payment reconciliation is still based on the original amount captured at payment time."
                        variant="warning"
                    />
                )}

                {isEditMode ? (
                    <Notice
                        title="Stored payment conversion"
                        description={snapshot
                            ? `${formatCurrency(snapshot.sourceAmount, snapshot.sourceCurrency)} was recorded as ${formatCurrency(snapshot.preferredCurrencyAmount, snapshot.preferredCurrencyAtPayment)} (${formatRateInput(storedExchangeRate)}).`
                            : 'No stored payment conversion exists yet.'}
                    />
                ) : (
                    liveRateError ? (
                        <Notice
                            title="Live conversion unavailable"
                            description={liveRateError}
                            variant="warning"
                        />
                    ) : (
                        <Notice
                            title={isLoadingLiveRate ? 'Loading live conversion...' : 'Live conversion preview'}
                            description={Number.isFinite(liveExchangeRate) && Number.isFinite(liveReceivedAmount)
                                ? `${formatCurrency(sourceAmount, sourceCurrency)} at today's rate is ${formatCurrency(liveReceivedAmount, targetCurrency)} (${formatRateInput(liveExchangeRate)}).`
                                : 'Current exchange rates will prefill once available.'}
                        />
                    )
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="invoice-payment-exchange-rate">Exchange rate</Label>
                        <Input
                            id="invoice-payment-exchange-rate"
                            type="number"
                            step="0.000001"
                            min="0"
                            value={exchangeRateInput}
                            onChange={handleExchangeRateChange}
                            placeholder="0.000000"
                        />
                        <p className="text-xs text-muted-foreground">
                            The effective rate your bank used.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="invoice-payment-received-amount">Received amount</Label>
                        <Input
                            id="invoice-payment-received-amount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={receivedAmountInput}
                            onChange={handleReceivedAmountChange}
                            placeholder="0.00"
                        />
                        <p className="text-xs text-muted-foreground">
                            The actual amount that landed in {targetCurrency}.
                        </p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default InvoicePaymentDetailsModal;
