import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from './ToastContainer'
import { useToast } from '../hooks/useToast'

const toastMocks = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
}))

vi.mock('sonner', () => ({
    toast: toastMocks
}))

vi.mock('@/components/ui/sonner', () => ({
    Toaster: () => <div data-testid="toaster" />
}))

const TriggerToast = () => {
    const { showSuccess } = useToast()

    return (
        <button type="button" onClick={() => showSuccess('Saved')}>
            Trigger
        </button>
    )
}

describe('ToastProvider', () => {

    beforeEach(() => {

        vi.clearAllMocks()
    })

    it('renders children and toaster', () => {

        render(
            <ToastProvider>
                <div>Child</div>
            </ToastProvider>
        )

        expect(screen.getByText('Child')).toBeInTheDocument()
        expect(screen.getByTestId('toaster')).toBeInTheDocument()
    })

    it('dispatches success toast', async () => {

        render(
            <ToastProvider>
                <TriggerToast />
            </ToastProvider>
        )

        await userEvent.click(screen.getByText('Trigger'))

        expect(toastMocks.success).toHaveBeenCalled()
    })
})
