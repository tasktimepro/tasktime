import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InvoiceActions from './InvoiceActions'

describe('InvoiceActions', () => {

    it('renders an icon-first preview action with text hidden on mobile classes', async () => {
        const user = userEvent.setup()
        const onPreview = vi.fn()

        render(
            <InvoiceActions
                editingInvoice={null}
                handleCancel={vi.fn()}
                onPreview={onPreview}
            />
        )

        const previewButton = screen.getByRole('button', { name: 'Preview invoice' })
        const previewText = screen.getByText('Preview')

        expect(previewButton.className).toContain('px-2.5')
        expect(previewText.className).toContain('hidden')
        expect(previewText.className).toContain('sm:inline')

        await user.click(previewButton)
        expect(onPreview).toHaveBeenCalledTimes(1)
    })

    it('uses the shorter generate label for new invoices', () => {
        render(
            <InvoiceActions
                editingInvoice={null}
                handleCancel={vi.fn()}
                onPreview={vi.fn()}
            />
        )

        expect(screen.getByRole('button', { name: 'Generate Invoice' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Generate New Invoice' })).not.toBeInTheDocument()
    })

})