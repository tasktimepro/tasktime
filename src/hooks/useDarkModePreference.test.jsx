import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useDarkModePreference } from './useDarkModePreference'

function TestComponent() {
    const [darkMode, setDarkMode] = useDarkModePreference()

    return (
        <button type="button" onClick={() => setDarkMode((currentValue) => !currentValue)}>
            {darkMode ? 'dark' : 'light'}
        </button>
    )
}

describe('useDarkModePreference', () => {
    beforeEach(() => {
        document.documentElement.className = ''
        document.documentElement.style.cssText = ''
        document.body.style.cssText = ''
        document.head.innerHTML = `
            <meta name="theme-color" content="#2563eb" />
            <meta name="color-scheme" content="light dark" />
        `

        localStorage.getItem.mockImplementation((key) => {
            if (key === 'tasktime-dark-mode') {
                return null
            }

            return null
        })

        window.matchMedia = vi.fn().mockImplementation((query) => ({
            matches: query === '(prefers-color-scheme: dark)' ? false : false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }))
    })

    it('applies dark mode classes and browser theme metadata from saved preferences', () => {
        localStorage.getItem.mockImplementation((key) => {
            if (key === 'tasktime-dark-mode') {
                return 'true'
            }

            return null
        })

        render(<TestComponent />)

        expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument()
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(document.documentElement.style.colorScheme).toBe('dark')
        expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0a0a0a')
        expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('dark')
        expect(localStorage.setItem).toHaveBeenCalledWith('tasktime-dark-mode', 'true')
    })

    it('updates browser theme metadata when toggled', async () => {
        const user = userEvent.setup()

        render(<TestComponent />)

        await user.click(screen.getByRole('button', { name: 'light' }))

        expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument()
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(document.documentElement.style.colorScheme).toBe('dark')
        expect(document.body.style.colorScheme).toBe('dark')
        expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0a0a0a')
        expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('dark')
    })
})