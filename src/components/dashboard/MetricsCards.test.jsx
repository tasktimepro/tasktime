import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MetricsCards from './MetricsCards'

const baseMetrics = {
    billableEarnings: {},
    paidInvoices: {},
    outstandingInvoices: {},
    hadConversionError: false,
    time: 0
}

const invoiceMetrics = {
    outstanding: 0,
    outstandingTotal: 0,
    pastDue: 0,
    pastDueTotal: 0
}

describe('MetricsCards', () => {

    it('renders expense summary amounts by currency', () => {
        render(
            <MetricsCards
                thisMonthMetrics={baseMetrics}
                lastMonthMetrics={baseMetrics}
                last90DaysMetrics={baseMetrics}
                invoiceMetrics={invoiceMetrics}
                thisMonthBillableHours={0}
                thisMonthUnbilledDisplay="$0.00"
                expenseThisMonthUpcomingTotal={120}
                expenseThisMonthUpcomingHasEstimate={true}
                expenseThisMonthPaidTotal={50}
                expenseLastMonthPaidTotal={30}
                expenseLast90DaysPaidTotal={10}
                hasClients={false}
                preferredCurrency="USD"
                formatDuration={() => '0h'}
                needsExchangeRates={false}
                exchangeRatesLoading={false}
                navigateToInvoices={() => {}}
            />
        )

        expect(screen.getByText('This Month')).toBeInTheDocument()
        expect(screen.getByText('~$120.00')).toBeInTheDocument()
        expect(screen.getByText('$50.00')).toBeInTheDocument()
        expect(screen.getAllByText('paid').length).toBeGreaterThan(0)
    })

    it('does not show paid tag for zero expense totals', () => {
        render(
            <MetricsCards
                thisMonthMetrics={baseMetrics}
                lastMonthMetrics={baseMetrics}
                last90DaysMetrics={baseMetrics}
                invoiceMetrics={invoiceMetrics}
                thisMonthBillableHours={0}
                thisMonthUnbilledDisplay="$0.00"
                expenseThisMonthUpcomingTotal={0}
                expenseThisMonthUpcomingHasEstimate={false}
                expenseThisMonthPaidTotal={0}
                expenseLastMonthPaidTotal={0}
                expenseLast90DaysPaidTotal={0}
                hasClients={false}
                preferredCurrency="USD"
                formatDuration={() => '0h'}
                needsExchangeRates={false}
                exchangeRatesLoading={false}
                navigateToInvoices={() => {}}
            />
        )

        expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0)
        expect(screen.queryByText('paid')).not.toBeInTheDocument()
    })
})
