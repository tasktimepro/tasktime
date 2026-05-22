import type { ProjectNotes, TipTapJsonNode } from '@/stores/yjs/types';

export const PROJECT_NOTES_PREVIEW_LENGTH = 200;

export const EMPTY_PROJECT_NOTES_DOCUMENT: TipTapJsonNode = {
    type: 'doc',
    content: [
        {
            type: 'paragraph',
        },
    ],
};

/**
 * Create a cloneable empty TipTap document for project notes.
 */
export function createEmptyProjectNotesDocument(): TipTapJsonNode {
    return {
        type: 'doc',
        content: [
            {
                type: 'paragraph',
            },
        ],
    };
}

/**
 * Clone an existing note document or fall back to the empty document.
 */
export function cloneProjectNotesDocument(document?: TipTapJsonNode | null): TipTapJsonNode {
    return JSON.parse(JSON.stringify(document ?? createEmptyProjectNotesDocument()));
}

function collectTextParts(node: TipTapJsonNode | null | undefined, parts: string[]): void {
    if (!node) {
        return;
    }

    if (typeof node.text === 'string' && node.text.length > 0) {
        parts.push(node.text);
    }

    if (Array.isArray(node.content)) {
        node.content.forEach((child) => collectTextParts(child, parts));
    }

    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'taskItem' || node.type === 'listItem') {
        parts.push('\n');
    }
}

/**
 * Extract readable plain text from a TipTap JSON document.
 */
export function extractProjectNotesPlainText(document?: TipTapJsonNode | null): string {
    const parts: string[] = [];
    collectTextParts(document ?? createEmptyProjectNotesDocument(), parts);

    return parts
        .join('')
        .replace(/\s+\n/g, '\n')
        .replace(/\n{2,}/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

/**
 * Create a short preview string for list/detail surfaces.
 */
export function createProjectNotesPreview(document?: TipTapJsonNode | null, maxLength: number = PROJECT_NOTES_PREVIEW_LENGTH): string {
    const plainText = extractProjectNotesPlainText(document);

    if (plainText.length <= maxLength) {
        return plainText;
    }

    return `${plainText.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

/**
 * Build the persisted notes payload stored on a project record.
 */
export function createProjectNotesPayload(document: TipTapJsonNode, updatedAt: number = Date.now()): ProjectNotes {
    const content = cloneProjectNotesDocument(document);

    return {
        version: 1,
        type: 'tiptap-json',
        content,
        plainTextPreview: createProjectNotesPreview(content),
        updatedAt,
    };
}

/**
 * Determine whether a notes document is visually empty.
 */
export function isProjectNotesDocumentEmpty(document?: TipTapJsonNode | null): boolean {
    return extractProjectNotesPlainText(document).length === 0;
}