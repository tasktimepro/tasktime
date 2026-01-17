import CustomCheckbox from '../CustomCheckbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * InvoicePreview component - Pricing and totals section for invoice review.
 * @param {Object} props
 * @param {string} props.activeSection
 * @param {Function} props.toggleSection
 * @param {Object} props.calculatePricing
 * @param {string} props.discountType
 * @param {Function} props.setDiscountType
 * @param {number|string} props.discountValue
 * @param {Function} props.setDiscountValue
 * @param {number|string} props.shippingAmount
 * @param {Function} props.setShippingAmount
 * @param {Object} props.taxOverride
 * @param {Function} props.setTaxOverride
 * @param {Object|null} props.selectedBusinessInfo
 * @param {Object|null} props.selectedClient
 * @param {Function} props.getInvoiceCurrency
 * @param {Function} props.getCurrencySymbol
 */
const InvoicePreview = ({
    activeSection,
    toggleSection,
    calculatePricing,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    shippingAmount,
    setShippingAmount,
    taxOverride,
    setTaxOverride,
    selectedBusinessInfo,
    selectedClient,
    getInvoiceCurrency,
    getCurrencySymbol
}) => {
    return (
        <div className="border border-border rounded-lg">
            <button
                type="button"
                onClick={() => toggleSection('pricingTotals')}
                className={`w-full px-4 py-3 text-left bg-muted/50 hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring ${activeSection === 'pricingTotals' ? 'rounded-t-lg' : 'rounded-lg'}`}
            >
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">Pricing & Totals</h4>
                    <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-blue-600">
                            {getCurrencySymbol(getInvoiceCurrency())}{calculatePricing.total.toFixed(2)}
                        </span>
                        <svg
                            className={`w-5 h-5 text-muted-foreground transform transition-transform ${activeSection === 'pricingTotals' ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </button>
            {activeSection === 'pricingTotals' && (
                <div className="p-4 space-y-4">
                    {/* Discount Settings */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Discount</label>
                        <div className="flex space-x-2">
                            <Select
                                value={discountType}
                                onValueChange={setDiscountType}
                            >
                                <SelectTrigger className="w-24">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percentage">%</SelectItem>
                                    <SelectItem value="fixed">{getCurrencySymbol(getInvoiceCurrency())}</SelectItem>
                                </SelectContent>
                            </Select>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={discountValue === '' ? '' : discountValue}
                                onChange={(e) => {
                                    const newValue = e.target.value;
                                    if (newValue === '') {
                                        setDiscountValue('');
                                    } else {
                                        setDiscountValue(parseFloat(newValue) || 0);
                                    }
                                }}
                                className="flex-1 text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground"
                                placeholder={discountType === 'percentage' ? '0.00' : '0.00'}
                            />
                        </div>
                    </div>

                    {/* Shipping */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Shipping</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={shippingAmount === '' ? '' : shippingAmount}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                if (newValue === '') {
                                    setShippingAmount('');
                                } else {
                                    setShippingAmount(parseFloat(newValue) || 0);
                                }
                            }}
                            className="w-full text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground"
                            placeholder="0.00"
                        />
                    </div>

                    {/* Tax Override */}
                    <div>
                        <div className="flex items-center space-x-2 mb-2">
                            <CustomCheckbox
                                checked={taxOverride.enabled}
                                onChange={(checked) => setTaxOverride(prev => ({ ...prev, enabled: checked }))}
                                label={
                                    <>
                                        Override tax settings
                                        {!taxOverride.enabled && (
                                            <span className="text-muted-foreground font-normal ml-1">
                                                {selectedBusinessInfo?.taxEnabled && (!selectedClient || !selectedClient.disableTax) && (
                                                    <>({selectedBusinessInfo.taxLabel} {selectedBusinessInfo.taxRate}%)</>
                                                )}
                                                {selectedClient?.disableTax && (
                                                    <>(tax disabled for this client)</>
                                                )}
                                                {!selectedClient?.disableTax && (!selectedBusinessInfo || !selectedBusinessInfo.taxEnabled) && (
                                                    <>(no tax configured)</>
                                                )}
                                            </span>
                                        )}
                                    </>
                                }
                                labelClassName="text-sm font-medium text-foreground"
                                id="taxOverrideEnabled"
                            />
                        </div>

                        {taxOverride.enabled && (
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <input
                                        type="text"
                                        value={taxOverride.label}
                                        onChange={(e) => setTaxOverride(prev => ({ ...prev, label: e.target.value }))}
                                        className="w-full text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground"
                                        placeholder="Tax label"
                                    />
                                </div>
                                <div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                        value={taxOverride.rate === '' ? '' : taxOverride.rate}
                                        onChange={(e) => {
                                            const newValue = e.target.value;
                                            if (newValue === '') {
                                                setTaxOverride(prev => ({ ...prev, rate: '' }));
                                            } else {
                                                setTaxOverride(prev => ({ ...prev, rate: parseFloat(newValue) || 0 }));
                                            }
                                        }}
                                        className="w-full text-sm border border-border rounded-md px-2 py-1 bg-background text-foreground"
                                        placeholder="Rate %"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pricing Breakdown */}
                    <div className="border-t pt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Subtotal:</span>
                            <span>{getCurrencySymbol(getInvoiceCurrency())}{calculatePricing.subtotal.toFixed(2)}</span>
                        </div>

                        {calculatePricing.discount > 0 && (
                            <div className="flex justify-between text-sm text-red-600">
                                <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : getCurrencySymbol(getInvoiceCurrency()) + discountValue}):</span>
                                <span>-{getCurrencySymbol(getInvoiceCurrency())}{calculatePricing.discount.toFixed(2)}</span>
                            </div>
                        )}

                        {calculatePricing.shipping > 0 && (
                            <div className="flex justify-between text-sm">
                                <span>Shipping:</span>
                                <span>{getCurrencySymbol(getInvoiceCurrency())}{calculatePricing.shipping.toFixed(2)}</span>
                            </div>
                        )}

                        {calculatePricing.tax > 0 && (
                            <div className="flex justify-between text-sm">
                                <span>{calculatePricing.taxLabel} ({calculatePricing.taxRate}%):</span>
                                <span>{getCurrencySymbol(getInvoiceCurrency())}{calculatePricing.tax.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="flex justify-between text-base font-medium border-t pt-2">
                            <span>Total:</span>
                            <span>{getCurrencySymbol(getInvoiceCurrency())}{calculatePricing.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoicePreview;
