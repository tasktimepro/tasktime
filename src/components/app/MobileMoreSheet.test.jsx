import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MobileMoreSheet from './MobileMoreSheet'

vi.mock('@/components/sync/YjsSyncStatus', () => ({
    default: () => <button type="button">Sync status action</button>
}))

vi.mock('@/components/OfflineIndicator', () => ({
    default: () => <div>Offline ready</div>
}))

describe('MobileMoreSheet', () => {
    const renderComponent = (overrides = {}) => {
        const syncClick = vi.fn()

        const renderResult = render(
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
                    {
                        key: 'sync',
                        label: 'Sync Settings',
                        description: 'Open sync settings',
                        Icon: () => <span>Sync icon</span>,
                        onClick: syncClick,
                    },
                ]}
                onClose={vi.fn()}
                onOpenChange={vi.fn()}
                onToggleDarkMode={vi.fn()}
                onToggleTotals={vi.fn()}
                totalsHidden={false}
                {...overrides}
            />
        )

        return { syncClick, ...renderResult }
    }

    it('does not nest buttons inside the sync row', () => {
        const { container } = renderComponent()

        expect(screen.getByRole('button', { name: 'Sync status action' })).toBeInTheDocument()
        expect(container.querySelector('button button')).toBeNull()
    })

    it('opens sync settings when the sync row itself is clicked', async () => {
        const user = userEvent.setup()
        const { syncClick } = renderComponent()

        await user.click(screen.getByRole('button', { name: 'Open sync settings' }))
        expect(syncClick).toHaveBeenCalledTimes(1)
    })
})
