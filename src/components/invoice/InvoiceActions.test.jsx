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

    it('uses an icon-first send quote action with text hidden on mobile classes', async () => {
        const user = userEvent.setup()
        const onSend = vi.fn()

        render(
            <InvoiceActions
                editingInvoice={null}
                handleCancel={vi.fn()}
                onPreview={vi.fn()}
                mode="quote"
                onSend={onSend}
                onDownload={vi.fn()}
            />
        )

        const sendButton = screen.getByRole('button', { name: 'Send Quote' })
        const sendText = screen.getByText('Send Quote')

        expect(sendButton.className).toContain('px-2.5')
        expect(sendText.className).toContain('hidden')
        expect(sendText.className).toContain('sm:inline')

        await user.click(sendButton)
        expect(onSend).toHaveBeenCalledTimes(1)
    })

})