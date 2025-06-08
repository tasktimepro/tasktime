import { useState, useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import { CURRENCY_SYMBOLS, getPreferredCurrency, setPreferredCurrency as savePreferredCurrency } from '../utils/currencyUtils';

/**
 * Preferences component - Manages user preferences including preferred currency
 */
const Preferences = () => {
    const [preferredCurrency, setPreferredCurrency] = useState('USD');
    const { showSuccess } = useToast();

    // Load preferred currency from localStorage on mount
    useEffect(() => {
        setPreferredCurrency(getPreferredCurrency());
    }, []);

    // Save preferred currency to localStorage
    const handleCurrencyChange = (e) => {
        const newCurrency = e.target.value;
        setPreferredCurrency(newCurrency);
        savePreferredCurrency(newCurrency);
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('preferenceChanged', {
            detail: { currency: newCurrency }
        }));
        
        showSuccess('Preferred currency updated successfully!');
    };

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Preferences</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Manage your personal preferences and default settings.
                </p>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Currency Settings</h3>
                
                <div className="max-w-sm">
                    <label htmlFor="preferredCurrency" className="block text-sm font-medium text-gray-700 mb-2">
                        Preferred Currency
                    </label>
                    <select
                        id="preferredCurrency"
                        value={preferredCurrency}
                        onChange={handleCurrencyChange}
                        className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-3 py-2"
                    >
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="CHF">CHF - Swiss Franc</option>
                        <option value="CAD">CAD - Canadian Dollar</option>
                        <option value="AUD">AUD - Australian Dollar</option>
                    </select>
                    <p className="mt-2 text-sm text-gray-500">
                        This currency will be used as the default for new projects and in dashboard metrics.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Preferences;
