import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import OnboardingModal from './OnboardingModal'

vi.mock('./Modal', () => ({

    default: ({ isOpen, title, children, footer, hideHeader, showCloseButton = true, contentRef }) => (
        isOpen ? (
            <div role="dialog" aria-label={title}>
                {!hideHeader && title ? <div>{title}</div> : null}
                {showCloseButton ? <button type="button">Close dialog</button> : null}
                <div ref={contentRef} data-testid="modal-scroll-content">{children}</div>
                <div>{footer}</div>
            </div>
        ) : null
    )
}))

describe('OnboardingModal', () => {

    it('renders the welcome step without a top progress section', () => {

        render(<OnboardingModal isOpen onComplete={vi.fn()} />)

        expect(screen.getByText(/Welcome to TaskTime Pro\./i)).toBeInTheDocument()
        expect(screen.queryByText('TaskTime Pro setup')).not.toBeInTheDocument()
        expect(screen.queryByRole('list', { name: 'Setup progress' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument()
        expect(screen.getByText('1 of 3')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Skip Onboarding' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Skip Step' })).not.toBeInTheDocument()
        expect(screen.getByText(/By using this app, you also agree to our/i)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy/')
        expect(screen.getByRole('link', { name: 'Terms & Conditions' })).toHaveAttribute('href', '/terms/')
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }))
    })

    it('walks through the sync step and finishes from the workflow step', async () => {

        const user = userEvent.setup()
        const onComplete = vi.fn()

        render(<OnboardingModal isOpen onComplete={onComplete} />)

        await user.click(screen.getByRole('button', { name: 'Next' }))

        expect(screen.getByText(/Sync with Google Drive/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Skip Onboarding' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Next' }))

        expect(screen.getByText(/Working with TaskTime Pro/i)).toBeInTheDocument()
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Projects')).toBeInTheDocument()
        expect(screen.getByText('Tasks')).toBeInTheDocument()
        expect(screen.getByText('Clients')).toBeInTheDocument()
        expect(screen.getByText('Expenses')).toBeInTheDocument()
        expect(screen.getByText('Invoices')).toBeInTheDocument()
        expect(screen.getByText('3 of 3')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Skip Onboarding' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Get Started' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Get Started' }))

        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('lets the user skip onboarding at any time', async () => {

        const user = userEvent.setup()
        const onComplete = vi.fn()

        render(<OnboardingModal isOpen onComplete={onComplete} />)

        await user.click(screen.getByRole('button', { name: 'Skip Onboarding' }))

        expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('resets the modal content scroll position when advancing to the next step', async () => {

        const user = userEvent.setup()

        render(<OnboardingModal isOpen onComplete={vi.fn()} />)

        const scrollContainer = screen.getByTestId('modal-scroll-content')
        scrollContainer.scrollTop = 180
        scrollContainer.scrollTo = ({ top }) => {
            scrollContainer.scrollTop = top
        }

        await user.click(screen.getByRole('button', { name: 'Next' }))

        expect(scrollContainer.scrollTop).toBe(0)
    })
})
