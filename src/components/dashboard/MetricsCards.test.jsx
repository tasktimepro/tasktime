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
                expenseTotalsByCurrency={{ USD: 120, EUR: 80 }}
                expenseUnpaidByCurrency={{ USD: 50 }}
                expenseBillableUnbilledByCurrency={{ EUR: 30 }}
                hasClients={false}
                preferredCurrency="USD"
                formatDuration={() => '0h'}
                needsExchangeRates={false}
                exchangeRatesLoading={false}
                navigateToInvoices={() => {}}
            />
        )

        expect(screen.getByText('Expenses This Month')).toBeInTheDocument()
        expect(screen.getByText('$120.00 USD')).toBeInTheDocument()
        expect(screen.getByText('€80.00 EUR')).toBeInTheDocument()

        expect(screen.getByText('Unpaid Expenses')).toBeInTheDocument()
        expect(screen.getByText('$50.00')).toBeInTheDocument()

        expect(screen.getByText('Billable Ready to Invoice')).toBeInTheDocument()
        expect(screen.getByText('€30.00')).toBeInTheDocument()
    })
})
