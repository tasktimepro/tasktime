import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OfflineIndicator from './OfflineIndicator'

describe('OfflineIndicator', () => {

    beforeEach(() => {

        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: false
        })
    })

    afterEach(() => {

        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: true
        })
    })

    it('shows the offline banner when offline', () => {

        render(<OfflineIndicator />)

        expect(screen.getByText("You're offline")).toBeInTheDocument()
    })

    it('hides the banner when back online', async () => {

        render(<OfflineIndicator />)

        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: true
        })

        fireEvent(window, new Event('online'))

        await waitFor(() => {
            expect(screen.queryByText("You're offline")).not.toBeInTheDocument()
        })
    })
})
