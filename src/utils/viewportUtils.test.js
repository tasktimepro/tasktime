import { describe, expect, it } from 'vitest'

import { isEditableTextEntryElement, isVirtualKeyboardOpen } from './viewportUtils'

describe('viewportUtils', () => {
    it('detects text entry inputs', () => {
        const input = document.createElement('input')
        input.type = 'text'

        expect(isEditableTextEntryElement(input)).toBe(true)
    })

    it('ignores non-text inputs', () => {
        const input = document.createElement('input')
        input.type = 'checkbox'

        expect(isEditableTextEntryElement(input)).toBe(false)
    })

    it('detects nested contenteditable nodes', () => {
        const editor = document.createElement('div')
        editor.setAttribute('contenteditable', 'true')

        const child = document.createElement('span')
        editor.appendChild(child)
        document.body.appendChild(editor)

        expect(isEditableTextEntryElement(child)).toBe(true)

        editor.remove()
    })

    it('treats a large focused viewport reduction as keyboard open', () => {
        const textarea = document.createElement('textarea')

        expect(isVirtualKeyboardOpen({
            activeElement: textarea,
            innerHeight: 844,
            visualViewportHeight: 420,
        })).toBe(true)
    })

    it('ignores small viewport changes', () => {
        const textarea = document.createElement('textarea')

        expect(isVirtualKeyboardOpen({
            activeElement: textarea,
            innerHeight: 844,
            visualViewportHeight: 720,
        })).toBe(false)
    })

    it('requires an editable active element', () => {
        const button = document.createElement('button')

        expect(isVirtualKeyboardOpen({
            activeElement: button,
            innerHeight: 844,
            visualViewportHeight: 420,
        })).toBe(false)
    })
})