import { useState, useEffect } from 'react';
import { useToast } from '../hooks/useToast.ts';
import { DEFAULT_CURRENCY, getCurrencyOptions } from '../utils/currencyUtils.ts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
    const handleCurrencyChange = (newCurrency) => {
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
                        <Select
                            value={preferredCurrency}
                            onValueChange={handleCurrencyChange}
                        >
                            <SelectTrigger id="preferredCurrency">
                                <SelectValue placeholder="Select a currency" />
                            </SelectTrigger>
                            <SelectContent>
                                {getCurrencyOptions(true).map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
