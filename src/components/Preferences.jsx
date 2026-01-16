import { useState, useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import { DEFAULT_CURRENCY, getCurrencyOptions } from '../utils/currencyUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

/**
 * Preferences component - Manages user preferences including preferred currency
 */
const Preferences = ({ preferences = {}, setPreferences }) => {
    const [preferredCurrency, setPreferredCurrency] = useState(DEFAULT_CURRENCY);
    const { showSuccess } = useToast();

    // Load preferred currency from preferences prop on mount
    useEffect(() => {
        const currency = preferences.currency || DEFAULT_CURRENCY;
        setPreferredCurrency(currency);
    }, [preferences]);

    // Save preferred currency to preferences state
    const handleCurrencyChange = (e) => {
        const newCurrency = e.target.value;
        setPreferredCurrency(newCurrency);
        
        // Update preferences state
        if (setPreferences) {
            setPreferences(prev => ({
                ...prev,
                currency: newCurrency
            }));
        }
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('preferenceChanged', {
            detail: { currency: newCurrency }
        }));
        
        showSuccess('Preferred currency updated successfully!');
    };

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground">Preferences</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage your personal preferences and default settings.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Currency Settings</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="max-w-sm space-y-2">
                        <Label htmlFor="preferredCurrency">
                            Preferred Currency
                        </Label>
                        <select
                            id="preferredCurrency"
                            value={preferredCurrency}
                            onChange={handleCurrencyChange}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            {getCurrencyOptions(true).map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-sm text-muted-foreground">
                            This currency will be used as the default for new projects and in dashboard metrics.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Preferences;
