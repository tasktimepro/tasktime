import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MobileMoreSheet from './MobileMoreSheet'

vi.mock('@/components/sync/CloudSyncStatusPanel', () => ({
    default: ({ onActionComplete }) => <button type="button" onClick={onActionComplete}>Cloud sync status</button>
}))

describe('MobileMoreSheet', () => {
    const renderComponent = (overrides = {}) => {
        return render(
            <MobileMoreSheet
                darkMode={false}
                isOpen={true}
                items={[
                    {
                        key: 'clients',
                        label: 'Clients',
                        description: 'View your clients',
                        Icon: () => <span>Clients icon</span>,
                        onClick: vi.fn(),
                    },
                ]}
                onClose={vi.fn()}
                onOpenAccount={vi.fn()}
                onOpenChange={vi.fn()}
                onToggleDarkMode={vi.fn()}
                onToggleTotals={vi.fn()}
                totalsHidden={false}
                {...overrides}
            />
        )
    }

    it('does not nest buttons inside the sync row', () => {
        const { container } = renderComponent()

        expect(screen.getByRole('button', { name: 'Cloud sync status' })).toBeInTheDocument()
        expect(container.querySelector('button button')).toBeNull()
    })

    it('closes after the cloud sync action runs', async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()

        renderComponent({ onClose })

        await user.click(screen.getByRole('button', { name: 'Cloud sync status' }))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('opens account from the bottom action row', async () => {
        const user = userEvent.setup()
        const onOpenAccount = vi.fn()

        renderComponent({ onOpenAccount })

        expect(screen.queryByText('More')).not.toBeInTheDocument()
        expect(screen.queryByText('Secondary navigation, sync, and display controls.')).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Account' }))
        expect(onOpenAccount).toHaveBeenCalledTimes(1)
    })

    it('renders as a drawer above the mobile nav', () => {
        renderComponent()

        const dialog = screen.getByRole('dialog')

        expect(dialog.className).toContain('bottom-safe-nav')
        expect(dialog.className).toContain('top-auto')
        expect(dialog.className).toContain('max-h-safe-nav')
        expect(dialog.className).toContain('shadow-none')
        expect(screen.queryByRole('button', { name: 'Close more navigation' })).not.toBeInTheDocument()
    })

    it('does not auto-focus the first action when it opens', () => {
        renderComponent()

        expect(screen.getByRole('button', { name: 'Clients icon Clients View your clients' })).not.toBe(document.activeElement)
        expect(document.body).toBe(document.activeElement)
    })

    it('renders labeled top action tiles', () => {
        renderComponent({ darkMode: true, totalsHidden: true })

        expect(screen.getByRole('button', { name: 'Show totals' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
        expect(screen.getByText('Show totals')).toBeInTheDocument()
        expect(screen.getByText('Light mode')).toBeInTheDocument()
        expect(screen.getByText('Account')).toBeInTheDocument()
    })

    it('renders sync in its own full-width tile', () => {
        renderComponent()

        const syncButton = screen.getByRole('button', { name: 'Cloud sync status' })

        expect(syncButton).toBeInTheDocument()
        expect(syncButton.closest('div')?.className).toContain('shadow-sm')
    })
})
