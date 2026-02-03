import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import StartDateBadge from './StartDateBadge'

describe('StartDateBadge', () => {

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2025-01-10T10:00:00Z'))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders recurring labels', () => {

        const { getByText } = render(
            <StartDateBadge recurring={{ type: 'weekly', weeklyDays: [1, 3, 5] }} />
        )

        expect(getByText('Every Mo, We, Fr')).toBeInTheDocument()
    })

    it('renders overdue badge when start date is in the past', () => {

        const { getByText } = render(
            <StartDateBadge startDate="2025-01-08" completed={false} />
        )

        expect(getByText('Overdue')).toBeInTheDocument()
    })

    it('renders overdue badge for recurring tasks when overdue', () => {

        const { getByText } = render(
            <StartDateBadge
                recurring={{ type: 'weekly', weeklyDays: [1, 3, 5] }}
                recurringOverdue={true}
                completed={false}
            />
        )

        expect(getByText('Overdue')).toBeInTheDocument()
    })

    it('renders recurring label when overdue recurring task is completed', () => {

        const { getByText } = render(
            <StartDateBadge
                recurring={{ type: 'weekly', weeklyDays: [1, 3, 5] }}
                recurringOverdue={true}
                completed={true}
            />
        )

        expect(getByText('Every Mo, We, Fr')).toBeInTheDocument()
    })

    it('renders today and tomorrow labels', () => {

        const { getByText, rerender } = render(
            <StartDateBadge startDate="2025-01-10" completed={false} />
        )

        expect(getByText('Today')).toBeInTheDocument()

        rerender(<StartDateBadge startDate="2025-01-11" completed={false} />)
        expect(getByText('Tomorrow')).toBeInTheDocument()
    })

    it('renders nothing when start date is missing', () => {

        const { container } = render(<StartDateBadge />)
        expect(container.firstChild).toBeNull()
    })
})
