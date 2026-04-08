import { describe, expect, it } from 'vitest'
import {
    parseIntegerInputWithFallback,
    parseOptionalNumberInput,
    parseOptionalPositiveNumberInput,
} from './numberInputUtils.ts'

describe('numberInputUtils', () => {
    it('parses strict numeric input without accepting parseFloat-style partial values', () => {
        expect(parseOptionalNumberInput('125.5')).toBe(125.5)
        expect(parseOptionalNumberInput('  42  ')).toBe(42)
        expect(parseOptionalNumberInput('12abc')).toBeNull()
        expect(parseOptionalNumberInput('')).toBeNull()
        expect(parseOptionalNumberInput(Infinity)).toBeNull()
    })

    it('normalizes optional positive numbers', () => {
        expect(parseOptionalPositiveNumberInput('18')).toBe(18)
        expect(parseOptionalPositiveNumberInput('0')).toBeNull()
        expect(parseOptionalPositiveNumberInput('-5')).toBeNull()
    })

    it('falls back or clamps invalid integer input', () => {
        expect(parseIntegerInputWithFallback('7', 3)).toBe(7)
        expect(parseIntegerInputWithFallback('7.5', 3)).toBe(3)
        expect(parseIntegerInputWithFallback('20', 3, { min: 1, max: 12 })).toBe(12)
        expect(parseIntegerInputWithFallback('0', 3, { min: 1 })).toBe(1)
    })
})