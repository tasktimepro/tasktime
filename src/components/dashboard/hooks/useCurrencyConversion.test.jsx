import { beforeEach, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useCurrencyConversion from './useCurrencyConversion';
import { fetchExchangeRates, convertCurrency } from '@/utils/currencyUtils';

vi.mock('@/utils/currencyUtils', async importOriginal => ({ ...await importOriginal(), fetchExchangeRates: vi.fn(), convertCurrency: vi.fn() }));
vi.mock('@/hooks/usePreferences', () => ({ usePreferences: () => ({ preferences: { currency: 'EUR' } }) }));
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ showWarning: vi.fn() }) }));
beforeEach(() => { vi.clearAllMocks(); });

it('settles after unavailable rates instead of retrying continuously while offline', async () => {
    fetchExchangeRates.mockReset().mockResolvedValueOnce({ rates: null, error: 'Offline' }).mockImplementation(() => new Promise(() => {}));
    const props = { projects: [], invoices: [], clients: [], expenses: [{ currency: 'USD' }] };
    const { result } = renderHook(() => useCurrencyConversion(props));
    await waitFor(() => expect(result.current.exchangeRatesError).toBe('Offline'));
    expect(fetchExchangeRates).toHaveBeenCalledOnce();
    expect(result.current.exchangeRatesLoading).toBe(false);
    expect(result.current.convertToCurrency({ USD: 100 })).toEqual({ amounts: { USD: 100 }, hadConversionError: true });
});

it('includes expense currencies and preserves source amounts when any conversion fails', async () => {
    fetchExchangeRates.mockResolvedValue({ rates: { USD: 1, EUR: 0.9, GBP: 0.8 } });
    convertCurrency.mockImplementation((amount, currency) => currency === 'GBP' ? { success: false, amount } : { success: true, amount: amount * 0.9 });
    const props = { projects: [], invoices: [], clients: [], expenses: [{ currency: 'GBP' }, { currency: 'USD' }] };
    const { result } = renderHook(() => useCurrencyConversion(props));
    await waitFor(() => expect(result.current.exchangeRatesLoading).toBe(false));
    expect(fetchExchangeRates).toHaveBeenCalledOnce();
    expect(result.current.needsExchangeRates).toBe(true);
    expect(result.current.convertToCurrency({ USD: 100, GBP: 50 })).toEqual({ amounts: { USD: 100, GBP: 50 }, hadConversionError: true });
    expect(result.current.convertToCurrency({ USD: 100 })).toEqual({ amounts: { EUR: 90 }, hadConversionError: false });
});

it('handles preferred-only amounts without a fetch and discloses missing rates for a new currency', async () => {
    fetchExchangeRates.mockReset().mockResolvedValue({ rates: { USD: 1, EUR: 0.9 } });
    const { result, rerender } = renderHook(props => useCurrencyConversion(props), { initialProps: { projects: [], clients: [], invoices: [{ currency: 'EUR' }] } });
    expect(result.current.convertToCurrency({ EUR: 40 })).toEqual({ amounts: { EUR: 40 }, hadConversionError: false });
    expect(result.current.convertToCurrency({})).toEqual({ amounts: {}, hadConversionError: false });
    expect(fetchExchangeRates).not.toHaveBeenCalled();
    rerender({ projects: [], clients: [], invoices: [{ currency: 'GBP' }] });
    await waitFor(() => expect(result.current.missingExchangeRates).toEqual(['GBP']));
    expect(result.current.exchangeRatesLoading).toBe(false);
    rerender({ projects: [], clients: [], invoices: [] });
    await waitFor(() => expect(result.current.exchangeRates).toBeNull());
    rerender({ projects: [], clients: [], invoices: [{ currency: 'GBP' }] });
    await waitFor(() => expect(fetchExchangeRates).toHaveBeenCalledTimes(2));
});
