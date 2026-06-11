import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    vi
} from 'vitest'
import {
    formatDuration,
    formatDurationWithSeconds,
    formatActiveTimer,
    millisecondsToHours,
    hoursToMinutes,
    getTodayRange,
    getThisWeekRange,
    getLastWeekRange,
    getThisMonthRange,
    getLastMonthRange,
    getThisYearRange
} from './dateUtils'
import {
    startOfDay,
    endOfDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
    subMonths,
    subWeeks
} from 'date-fns'

describe('dateUtils', () => {

    beforeEach(() => {

        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-18T12:34:56.000Z'))
    })

    afterEach(() => {

        vi.useRealTimers()
    })

    describe('formatDuration', () => {

        it('formats zero as "0m"', () => {

            expect(formatDuration(0)).toBe('0m')
        })

        it('formats minutes only', () => {

            expect(formatDuration(30 * 60 * 1000)).toBe('30m')
        })

        it('formats hours only', () => {

            expect(formatDuration(2 * 60 * 60 * 1000)).toBe('2h')
        })

        it('formats hours and minutes', () => {

            expect(formatDuration(2.5 * 60 * 60 * 1000)).toBe('2h 30m')
        })

        it('handles large durations', () => {

            expect(formatDuration(100 * 60 * 60 * 1000)).toBe('100h')
        })

        it('rounds down partial minutes', () => {

            expect(formatDuration(90 * 1000)).toBe('1m')
        })
    })

    describe('formatDurationWithSeconds', () => {

        it('formats with seconds', () => {

            expect(formatDurationWithSeconds(65000)).toBe('1m 5s')
        })

        it('shows only seconds for short durations', () => {

            expect(formatDurationWithSeconds(5000)).toBe('5s')
        })

        it('shows 0s for zero duration', () => {

            expect(formatDurationWithSeconds(0)).toBe('0s')
        })
    })

    describe('formatActiveTimer', () => {

        it('formats elapsed time when provided milliseconds', () => {

            expect(formatActiveTimer(125000)).toBe('2m 5s')
        })

        it('formats elapsed time when provided a timestamp', () => {

            const now = Date.now()
            const start = now - 65000
            expect(formatActiveTimer(start)).toBe('1m 5s')
        })
    })

    describe('millisecondsToHours', () => {

        it('converts correctly', () => {

            expect(millisecondsToHours(3600000)).toBe(1)
            expect(millisecondsToHours(5400000)).toBe(1.5)
        })

        it('handles zero', () => {

            expect(millisecondsToHours(0)).toBe(0)
        })
    })

    describe('hoursToMinutes', () => {

        it('converts correctly', () => {

            expect(hoursToMinutes(1)).toBe(60)
            expect(hoursToMinutes(1.5)).toBe(90)
        })

        it('rounds to nearest minute', () => {

            expect(hoursToMinutes(0.51)).toBe(31)
        })
    })

    describe('date ranges', () => {

        it('returns today range', () => {

            const range = getTodayRange()
            const now = new Date()
            expect(range.start).toBe(startOfDay(now).getTime())
            expect(range.end).toBe(endOfDay(now).getTime())
        })

        it('returns this week range', () => {

            const range = getThisWeekRange(1)
            const now = new Date()
            expect(range.start).toBe(startOfWeek(now, { weekStartsOn: 1 }).getTime())
            expect(range.end).toBe(endOfWeek(now, { weekStartsOn: 1 }).getTime())
        })

        it('returns this week range with Sunday start', () => {

            const range = getThisWeekRange(0)
            const now = new Date()
            expect(range.start).toBe(startOfWeek(now, { weekStartsOn: 0 }).getTime())
            expect(range.end).toBe(endOfWeek(now, { weekStartsOn: 0 }).getTime())
        })

        it('returns last week range', () => {

            const range = getLastWeekRange(1)
            const lastWeek = subWeeks(new Date(), 1)
            expect(range.start).toBe(startOfWeek(lastWeek, { weekStartsOn: 1 }).getTime())
            expect(range.end).toBe(endOfWeek(lastWeek, { weekStartsOn: 1 }).getTime())
        })

        it('returns this month range', () => {

            const range = getThisMonthRange()
            const now = new Date()
            expect(range.start).toBe(startOfMonth(now).getTime())
            expect(range.end).toBe(endOfMonth(now).getTime())
        })

        it('returns last month range', () => {

            const range = getLastMonthRange()
            const lastMonth = subMonths(new Date(), 1)
            expect(range.start).toBe(startOfMonth(lastMonth).getTime())
            expect(range.end).toBe(endOfMonth(lastMonth).getTime())
        })

        it('returns this year range', () => {

            const range = getThisYearRange()
            const now = new Date()
            expect(range.start).toBe(startOfYear(now).getTime())
            expect(range.end).toBe(endOfYear(now).getTime())
        })
    })
})
