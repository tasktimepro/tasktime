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
})
