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
        expect(screen.getAllByText('spent').length).toBeGreaterThan(0)
    })

    it('labels paid invoice totals as earned in the reports overview', () => {
        render(
            <MetricsCards
                thisMonthMetrics={{
                    ...baseMetrics,
                    paidInvoices: { USD: 250 }
                }}
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
                hasClients={true}
                preferredCurrency="USD"
                formatDuration={() => '0h'}
                needsExchangeRates={false}
                exchangeRatesLoading={false}
                navigateToInvoices={() => {}}
            />
        )

        expect(screen.getByText('$250.00')).toBeInTheDocument()
        expect(screen.getByText('earned')).toBeInTheDocument()
        expect(screen.queryByText('paid')).not.toBeInTheDocument()
    })

    it('does not show spent tag for zero expense totals', () => {
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

        expect(screen.queryByText('upcoming')).not.toBeInTheDocument()
        expect(screen.queryByText('spent')).not.toBeInTheDocument()
    })

    it('does not render zero expense summary amounts', () => {
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

        expect(screen.queryByText('$0.00')).not.toBeInTheDocument()
    })

    it('does not render zero earnings rows in any period when only expenses exist', () => {
        render(
            <MetricsCards
                thisMonthMetrics={baseMetrics}
                lastMonthMetrics={baseMetrics}
                last90DaysMetrics={baseMetrics}
                invoiceMetrics={invoiceMetrics}
                thisMonthBillableHours={0}
                thisMonthUnbilledDisplay="$0.00"
                expenseThisMonthUpcomingTotal={179.73}
                expenseThisMonthUpcomingHasEstimate={true}
                expenseThisMonthPaidTotal={58.8}
                expenseLastMonthPaidTotal={41.25}
                expenseLast90DaysPaidTotal={122.4}
                hasClients={true}
                preferredCurrency="EUR"
                formatDuration={() => '0m'}
                needsExchangeRates={false}
                exchangeRatesLoading={false}
                navigateToInvoices={() => {}}
            />
        )

        expect(screen.queryByText('EUR 0.00')).not.toBeInTheDocument()
        expect(screen.queryByText('€0.00')).not.toBeInTheDocument()
        expect(screen.getByText('~€179.73')).toBeInTheDocument()
        expect(screen.getByText('€58.80')).toBeInTheDocument()
        expect(screen.getByText('€41.25')).toBeInTheDocument()
        expect(screen.getByText('€122.40')).toBeInTheDocument()
        expect(screen.getAllByText('spent')).toHaveLength(3)
    })
})
