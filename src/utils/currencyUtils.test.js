import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi
} from 'vitest'
import {
    getCurrencySymbol,
    formatCurrency,
    convertCurrency,
    getProjectCurrency,
    normalizeCurrencyCode,
    DEFAULT_CURRENCY,
    setPreferredCurrency,
    getPreferredCurrency,
    fetchExchangeRates,
    hasAllRequiredRates,
    getCurrencyOptions
} from './currencyUtils'
import { EXCHANGE_RATE_CACHE_MS } from '../constants/app'

describe('currencyUtils', () => {

    beforeEach(() => {

        vi.clearAllMocks()
        const getItemMock = localStorage.getItem
        getItemMock.mockReturnValue('{}')
    })

    afterEach(() => {

        vi.restoreAllMocks()
    })

    describe('normalizeCurrencyCode', () => {

        it('normalizes to uppercase and trims', () => {

            expect(normalizeCurrencyCode(' eur ')).toBe('EUR')
        })

        it('falls back to default on empty input', () => {

            expect(normalizeCurrencyCode('')).toBe(DEFAULT_CURRENCY)
            expect(normalizeCurrencyCode(null)).toBe(DEFAULT_CURRENCY)
        })
    })

    describe('getCurrencySymbol', () => {

        it('returns correct symbols for known currencies', () => {

            expect(getCurrencySymbol('EUR')).toBe('€')
            expect(getCurrencySymbol('USD')).toBe('$')
            expect(getCurrencySymbol('GBP')).toBe('£')
            expect(getCurrencySymbol('CHF')).toBe('CHF')
        })

        it('returns $ for unknown currencies', () => {

            expect(getCurrencySymbol('XYZ')).toBe('$')
            expect(getCurrencySymbol('')).toBe('€')
        })
    })

    describe('formatCurrency', () => {

        it('formats with correct symbol and decimals', () => {

            expect(formatCurrency(100, 'EUR')).toBe('€100.00')
            expect(formatCurrency(100, 'USD')).toBe('$100.00')
        })

        it('respects decimal parameter', () => {

            expect(formatCurrency(100, 'EUR', 0)).toBe('€100')
            expect(formatCurrency(100.5555, 'EUR', 3)).toBe('€100.555')
        })

        it('handles zero', () => {

            expect(formatCurrency(0, 'EUR')).toBe('€0.00')
        })

        it('handles negative amounts', () => {

            expect(formatCurrency(-50, 'USD')).toBe('$-50.00')
        })
    })

    describe('convertCurrency', () => {

        const mockRates = {
            EUR: 0.85,
            USD: 1,
            GBP: 0.75
        }

        it('converts between currencies correctly', () => {

            const result = convertCurrency(100, 'USD', 'EUR', mockRates)
            expect(result.success).toBe(true)
            expect(result.amount).toBeCloseTo(85)
        })

        it('returns same amount for same currency', () => {

            const result = convertCurrency(100, 'USD', 'USD', mockRates)
            expect(result.success).toBe(true)
            expect(result.amount).toBe(100)
        })

        it('handles invalid amounts gracefully', () => {

            expect(convertCurrency(null, 'USD', 'EUR', mockRates)).toEqual({
                success: false,
                amount: 0,
                error: 'Invalid amount'
            })
            expect(convertCurrency(undefined, 'USD', 'EUR', mockRates)).toEqual({
                success: false,
                amount: 0,
                error: 'Invalid amount'
            })
            expect(convertCurrency(NaN, 'USD', 'EUR', mockRates)).toEqual({
                success: false,
                amount: 0,
                error: 'Invalid amount'
            })
        })
    })

    describe('getProjectCurrency', () => {

        it('returns preferred client currency when available', () => {

            const project = { preferredClientId: 'client-1' }
            const clients = [{ id: 'client-1', defaultCurrency: 'GBP' }]
            const getItemMock = localStorage.getItem
            getItemMock.mockReturnValue(JSON.stringify({ currency: 'EUR' }))
            expect(getProjectCurrency(project, clients)).toBe('GBP')
        })

        it('falls back to preferred currency when client missing', () => {

            const project = { preferredClientId: 'client-1' }
            const clients = [{ id: 'client-2', defaultCurrency: 'USD' }]
            const getItemMock = localStorage.getItem
            getItemMock.mockReturnValue(JSON.stringify({ currency: 'EUR' }))
            expect(getProjectCurrency(project, clients)).toBe('EUR')
        })

        it('falls back to default when preferences invalid', () => {

            const project = { preferredClientId: null }
            const getItemMock = localStorage.getItem
            getItemMock.mockReturnValue('invalid-json')
            vi.spyOn(console, 'warn').mockImplementation(() => undefined)
            expect(getProjectCurrency(project, null)).toBe(DEFAULT_CURRENCY)
        })
    })

    describe('setPreferredCurrency', () => {

        it('stores normalized currency code', () => {

            const getItemMock = localStorage.getItem
            const setItemMock = localStorage.setItem
            getItemMock.mockReturnValue(JSON.stringify({ currency: 'usd' }))

            setPreferredCurrency(' gbp ')

            expect(setItemMock).toHaveBeenCalled()
            const saved = JSON.parse(setItemMock.mock.calls[0][1])
            expect(saved.currency).toBe('GBP')
        })
    })

    describe('getPreferredCurrency', () => {

        it('returns default for unknown code', () => {

            const getItemMock = localStorage.getItem
            getItemMock.mockReturnValue(JSON.stringify({ currency: 'xyz' }))
            expect(getPreferredCurrency()).toBe(DEFAULT_CURRENCY)
        })
    })

    describe('hasAllRequiredRates', () => {

        it('returns true when rates cover currencies', () => {

            expect(hasAllRequiredRates(['USD', 'EUR'], { EUR: 0.9 })).toBe(true)
        })

        it('returns false when rates missing', () => {

            expect(hasAllRequiredRates(['USD', 'GBP'], { EUR: 0.9 })).toBe(false)
        })
    })

    describe('getCurrencyOptions', () => {

        it('includes full name when requested', () => {

            const options = getCurrencyOptions(true)
            expect(options.some(option => option.label.includes('Euro'))).toBe(true)
        })
    })

    describe('fetchExchangeRates', () => {

        it('returns cached rates when valid', async () => {

            const now = 100000
            vi.spyOn(Date, 'now').mockReturnValue(now)
            const cache = {
                rates: { EUR: 0.9 },
                timestamp: now - (EXCHANGE_RATE_CACHE_MS / 2)
            }
            localStorage.getItem.mockReturnValue(JSON.stringify(cache))

            const result = await fetchExchangeRates()

            expect(result.rates).toEqual({ EUR: 0.9 })
            expect(result.error).toBeNull()
        })

        it('returns fallback cached rates on fetch error', async () => {

            const now = 100000
            vi.spyOn(Date, 'now').mockReturnValue(now)
            vi.spyOn(console, 'error').mockImplementation(() => undefined)
            vi.spyOn(console, 'warn').mockImplementation(() => undefined)
            const expiredCache = {
                rates: { GBP: 0.8 },
                timestamp: now - (EXCHANGE_RATE_CACHE_MS + 1000)
            }
            localStorage.getItem.mockReturnValue(JSON.stringify(expiredCache))
            global.fetch = vi.fn().mockRejectedValue(new Error('fail'))

            const result = await fetchExchangeRates()

            expect(result.rates).toEqual({ GBP: 0.8 })
            expect(result.error).toMatch(/cached/)
        })

        it('fetches and caches rates when no valid cache', async () => {

            localStorage.getItem.mockReturnValue(null)
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ rates: { USD: 1, EUR: 0.9 } })
            })

            const result = await fetchExchangeRates()

            expect(result.rates).toEqual({ USD: 1, EUR: 0.9 })
            expect(localStorage.setItem).toHaveBeenCalled()
        })
    })
})
