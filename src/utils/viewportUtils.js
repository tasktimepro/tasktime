const NON_TEXT_INPUT_TYPES = new Set([
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
]);

export function isEditableTextEntryElement(element) {
    if (!(element instanceof HTMLElement)) {
        return false;
    }

    if (element instanceof HTMLTextAreaElement) {
        return !element.disabled && !element.readOnly;
    }

    if (element instanceof HTMLInputElement) {
        const inputType = (element.type || 'text').toLowerCase();

        return !NON_TEXT_INPUT_TYPES.has(inputType) && !element.disabled && !element.readOnly;
    }

    return element.closest('[contenteditable]:not([contenteditable="false"])') instanceof HTMLElement;
}

export function isVirtualKeyboardOpen({ activeElement, innerHeight, visualViewportHeight }) {
    if (!Number.isFinite(innerHeight) || !Number.isFinite(visualViewportHeight) || innerHeight <= 0 || visualViewportHeight <= 0) {
        return false;
    }

    if (!isEditableTextEntryElement(activeElement)) {
        return false;
    }

    const heightDelta = innerHeight - visualViewportHeight;

    return heightDelta > Math.max(160, innerHeight * 0.2);
}