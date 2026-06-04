import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from './ToastContainer'
import { useToast } from '../hooks/useToast'

const consumePostReloadToastMock = vi.hoisted(() => vi.fn())
const rememberAppVersionMock = vi.hoisted(() => vi.fn())

const toasterRenderSpy = vi.hoisted(() => vi.fn())

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
    Toaster: (props) => {
        toasterRenderSpy(props)
        return <div data-testid="toaster" />
    }
}))

vi.mock('../utils/postReloadToast.ts', () => ({
    consumePostReloadToast: consumePostReloadToastMock,
    rememberAppVersion: rememberAppVersionMock
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
        consumePostReloadToastMock.mockReturnValue(null)
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

    it('positions toasts above the mobile dock area', () => {

        render(
            <ToastProvider>
                <div>Child</div>
            </ToastProvider>
        )

        expect(toasterRenderSpy).toHaveBeenCalled()

        const toasterProps = toasterRenderSpy.mock.calls.at(-1)?.[0]

        expect(toasterProps.position).toBe('bottom-right')
        expect(toasterProps.offset).toEqual({ bottom: '1rem', right: '1rem' })
        expect(toasterProps.mobileOffset).toEqual({
            bottom: 'calc(env(safe-area-inset-bottom) + 5.75rem)',
            left: '1rem',
            right: '1rem'
        })
    })

    it('dispatches the queued app update toast after reload', () => {

        consumePostReloadToastMock.mockReturnValue({
            level: 'success',
            message: 'TaskTime was updated'
        })

        render(
            <ToastProvider>
                <div>Child</div>
            </ToastProvider>
        )

        expect(toastMocks.success).toHaveBeenCalledWith('TaskTime was updated', undefined)
    })

    it('records the current app version on mount without showing a startup update toast', () => {

        render(
            <ToastProvider>
                <div>Child</div>
            </ToastProvider>
        )

        expect(rememberAppVersionMock).toHaveBeenCalledTimes(1)
        expect(toastMocks.success).not.toHaveBeenCalled()
    })
})
