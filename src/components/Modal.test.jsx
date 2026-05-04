import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal'

describe('Modal', () => {

    it('renders when open', () => {

        render(
            <Modal isOpen onClose={vi.fn()} title="Edit Task" footer={<div>Footer</div>}>
                <div>Content</div>
            </Modal>
        )

        expect(screen.getByText('Edit Task')).toBeInTheDocument()
        expect(screen.getByText('Content')).toBeInTheDocument()
        expect(screen.getByText('Footer')).toBeInTheDocument()
    })

    it('does not render when closed', () => {

        render(
            <Modal isOpen={false} onClose={vi.fn()} title="Edit Task">
                <div>Content</div>
            </Modal>
        )

        expect(screen.queryByText('Content')).not.toBeInTheDocument()
    })

    it('calls onClose on escape key', async () => {

        const onClose = vi.fn()

        render(
            <Modal isOpen onClose={onClose} title="Edit Task">
                <div>Content</div>
            </Modal>
        )

        await userEvent.keyboard('{Escape}')

        expect(onClose).toHaveBeenCalled()
    })

    it('uses a mobile-safe shell without horizontal overflow', () => {

        render(
            <Modal isOpen onClose={vi.fn()} title="Edit Task">
                <div>Content</div>
            </Modal>
        )

        const dialog = screen.getByRole('dialog')

        expect(dialog.className.includes('w-[calc(100vw-1rem)]')).toBe(true)
        expect(dialog.className.includes('max-w-[calc(100vw-1rem)]')).toBe(true)
        expect(dialog.className.includes('top-[50%]')).toBe(true)
        expect(dialog.className.includes('translate-y-[-50%]')).toBe(true)
        expect(dialog.className.includes('max-h-[calc(100svh-var(--safe-area-top)-var(--safe-area-bottom)-1rem)]')).toBe(true)
        expect(dialog.className.includes('sm:max-w-md')).toBe(true)
        expect(dialog.className.includes('overflow-hidden')).toBe(true)
        expect(dialog.className.includes('rounded-lg')).toBe(true)
    })

    it('keeps the title aligned with the close button and footer actions on one row', () => {
        render(
            <Modal
                isOpen
                onClose={vi.fn()}
                title="Edit Task"
                footer={(
                    <>
                        <button type="button">Cancel</button>
                        <button type="button">Save</button>
                    </>
                )}
            >
                <div>Content</div>
            </Modal>
        )

        const title = screen.getByText('Edit Task')
        const closeButton = screen.getByRole('button', { name: 'Close dialog' })
        const footerButton = screen.getByText('Cancel')
        const header = title.parentElement?.parentElement
        const footer = footerButton.parentElement

        expect(header?.className.includes('items-center')).toBe(true)
        expect(header?.className.includes('gap-3')).toBe(true)
        expect(header?.className.includes('pt-[max(0.75rem,var(--safe-area-top))]')).toBe(true)
        expect(title.parentElement?.className.includes('text-left')).toBe(true)
        expect(closeButton.className.includes('rounded-full')).toBe(true)
        expect(closeButton.className.includes('shadow-sm')).toBe(true)
        expect(footer?.className.includes('flex-row')).toBe(true)
        expect(footer?.className.includes('gap-2')).toBe(true)
        expect(footer?.className.includes('pb-[max(0.75rem,var(--safe-area-bottom))]')).toBe(true)
    })

    it('keeps header actions center-aligned with the title until wrapping is needed', () => {
        render(
            <Modal
                isOpen
                onClose={vi.fn()}
                title="New Invoice"
                headerActions={<button type="button">Custom Range</button>}
            >
                <div>Content</div>
            </Modal>
        )

        const title = screen.getByText('New Invoice')
        const closeButton = screen.getByRole('button', { name: 'Close dialog' })
        const headerActions = screen.getByRole('button', { name: 'Custom Range' })
        const header = title.parentElement?.parentElement
        const actionGroup = headerActions.parentElement?.parentElement

        expect(header?.className.includes('items-center')).toBe(true)
        expect(title.parentElement?.className.includes('basis-full')).toBe(false)
        expect(actionGroup?.className.includes('items-center')).toBe(true)
        expect(actionGroup?.className.includes('items-start')).toBe(false)
        expect(closeButton.className.includes('rounded-full')).toBe(true)
    })

})
