import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from './dropdown-menu'

function TestDropdownMenu() {
    return (
        <div data-testid="scroll-container">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button">More actions</button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem>Open</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

describe('DropdownMenu', () => {
    it('keeps scrolling available and closes after the trigger moves beyond the scroll threshold', async () => {
        render(<TestDropdownMenu />)

        const trigger = screen.getByRole('button', { name: 'More actions' })
        const scrollContainer = screen.getByTestId('scroll-container')
        vi.spyOn(trigger, 'getBoundingClientRect').mockImplementation(() => DOMRect.fromRect({
            x: 0,
            y: 100 - scrollContainer.scrollTop,
            width: 100,
            height: 32,
        }))

        fireEvent.pointerDown(trigger, {
            button: 0,
            clientX: 24,
            clientY: 24,
            ctrlKey: false,
            pointerType: 'mouse',
        })

        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument()
        })

        expect(document.body).not.toHaveStyle({ overflow: 'hidden' })
        fireEvent.scroll(screen.getByRole('menu'))
        expect(screen.getByRole('menu')).toBeInTheDocument()

        scrollContainer.scrollTop = 4
        fireEvent.scroll(scrollContainer)
        expect(screen.getByRole('menu')).toBeInTheDocument()

        scrollContainer.scrollTop = 9
        fireEvent.scroll(scrollContainer)
        await waitFor(() => {
            expect(screen.queryByRole('menu')).not.toBeInTheDocument()
        })
    })

    it('waits for click after a touch press instead of opening on pointer down', async () => {
        render(<TestDropdownMenu />)

        const trigger = screen.getByRole('button', { name: 'More actions' })

        fireEvent.pointerDown(trigger, {
            button: 0,
            clientX: 24,
            clientY: 24,
            ctrlKey: false,
            pointerType: 'touch',
        })

        expect(screen.queryByRole('menu')).not.toBeInTheDocument()

        fireEvent.click(trigger)

        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument()
        })
    })

    it('cancels the touch toggle when the pointer moves like a scroll gesture', () => {
        render(<TestDropdownMenu />)

        const trigger = screen.getByRole('button', { name: 'More actions' })

        fireEvent.pointerDown(trigger, {
            button: 0,
            clientX: 24,
            clientY: 24,
            ctrlKey: false,
            pointerType: 'touch',
        })
        fireEvent.pointerMove(trigger, {
            clientX: 24,
            clientY: 40,
            pointerType: 'touch',
        })
        fireEvent.click(trigger)

        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    it('keeps desktop pointer behavior unchanged', async () => {
        render(<TestDropdownMenu />)

        const trigger = screen.getByRole('button', { name: 'More actions' })

        fireEvent.pointerDown(trigger, {
            button: 0,
            clientX: 24,
            clientY: 24,
            ctrlKey: false,
            pointerType: 'mouse',
        })

        await waitFor(() => {
            expect(screen.getByRole('menu')).toBeInTheDocument()
        })
    })
})
