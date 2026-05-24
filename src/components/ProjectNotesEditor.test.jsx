import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectNotesEditor from './ProjectNotesEditor';
import { getCloudButtonLabel, getSaveStatusText, hasPendingProjectNotesCloudSave } from '@/utils/projectNotesStatusUtils';

const hookMocks = vi.hoisted(() => ({
    projectNotes: {
        initialDocument: { type: 'doc', content: [{ type: 'paragraph' }] },
        isDirty: false,
        isSavingLocal: false,
        isDriveConnected: true,
        manualSyncInProgress: false,
        pendingSyncChanges: false,
        lastLocalSavedAt: null,
        lastSyncedAt: 1_700_000_000_000,
        updateDraft: vi.fn(),
        flushPendingNotes: vi.fn(),
        saveNotesToCloud: vi.fn(),
    },
    isMobileLayout: false,
    starterKitConfigure: vi.fn((options) => ({ name: 'starterKit', options })),
    linkConfigure: vi.fn((options) => ({ name: 'link', options })),
    useEditorOptions: null,
}));

vi.mock('@tiptap/starter-kit', () => ({
    default: {
        configure: (options) => hookMocks.starterKitConfigure(options),
    },
}));

vi.mock('@tiptap/extension-link', () => ({
    default: {
        configure: (options) => hookMocks.linkConfigure(options),
    },
}));

vi.mock('@tiptap/react', () => ({
    useEditor: (options) => {
        hookMocks.useEditorOptions = options;

        return {
            on: vi.fn(),
            off: vi.fn(),
            isActive: vi.fn(() => false),
            can: vi.fn(() => ({
                chain: () => ({
                    focus: () => ({
                        toggleBold: () => ({ run: () => true }),
                        toggleItalic: () => ({ run: () => true }),
                        toggleHeading: () => ({ run: () => true }),
                        toggleBulletList: () => ({ run: () => true }),
                        toggleOrderedList: () => ({ run: () => true }),
                        toggleTaskList: () => ({ run: () => true }),
                        undo: () => ({ run: () => true }),
                        redo: () => ({ run: () => true }),
                    }),
                }),
            })),
            chain: vi.fn(() => ({
                focus: () => ({
                    toggleBold: () => ({ run: () => true }),
                    toggleItalic: () => ({ run: () => true }),
                    toggleHeading: () => ({ run: () => true }),
                    toggleBulletList: () => ({ run: () => true }),
                    toggleOrderedList: () => ({ run: () => true }),
                    toggleTaskList: () => ({ run: () => true }),
                    undo: () => ({ run: () => true }),
                    redo: () => ({ run: () => true }),
                }),
            })),
        };
    },
    EditorContent: () => <div data-testid="project-notes-editor-content" />,
}));

vi.mock('@/hooks/useProjectNotes', () => ({
    useProjectNotes: () => hookMocks.projectNotes,
}));

vi.mock('@/hooks/useIsMobileLayout', () => ({
    default: () => hookMocks.isMobileLayout,
}));

describe('ProjectNotesEditor', () => {
    it('keeps the notes editor at a mobile-safe font size', () => {
        render(<ProjectNotesEditor project={{ id: 'project-1', notes: null }} />);

        expect(hookMocks.useEditorOptions.editorProps.attributes.class).toContain('text-base');
        expect(hookMocks.useEditorOptions.editorProps.attributes.class).toContain('md:text-sm');
    });

    it('configures note links to open on click in a new tab', () => {
        render(<ProjectNotesEditor project={{ id: 'project-1', notes: null }} />);

        expect(hookMocks.starterKitConfigure).toHaveBeenCalledWith(expect.objectContaining({ link: false }));
        expect(hookMocks.linkConfigure).toHaveBeenCalledWith(expect.objectContaining({
            autolink: true,
            linkOnPaste: true,
            openOnClick: true,
            HTMLAttributes: expect.objectContaining({
                target: '_blank',
                rel: 'noopener noreferrer',
            }),
        }));
    });

    it('shows an In sync disabled cloud button when there are no pending changes', () => {
        render(<ProjectNotesEditor project={{ id: 'project-1', notes: null }} />);

        expect(screen.getByRole('button', { name: 'In sync' })).toBeDisabled();
        expect(screen.getByTestId('project-notes-editor-content')).toBeInTheDocument();
        expect(screen.queryByTestId('project-notes-save-status')).not.toBeInTheDocument();
    });

    it('returns the expected cloud button labels', () => {
        expect(getCloudButtonLabel(true, true)).toBe('Save to cloud');
        expect(getCloudButtonLabel(false, true)).toBe('In sync');
        expect(getCloudButtonLabel(false, false)).toBe('Saved locally');
    });

    it('returns saved locally status copy whenever notes changes are pending', () => {
        expect(getSaveStatusText({
            isSavingLocal: false,
            isDirty: false,
            pendingSyncChanges: true,
            lastLocalSavedAt: null,
            lastSyncedAt: null,
        })).toBe('Saved locally');
    });

    it('keeps the notes UI pending until a completed sync is newer than the last local note save', () => {
        expect(hasPendingProjectNotesCloudSave({
            isSavingLocal: false,
            isDirty: false,
            pendingSyncChanges: false,
            lastLocalSavedAt: 1_700_000_010_000,
            lastSyncedAt: 1_700_000_000_000,
        })).toBe(true);

        hookMocks.projectNotes = {
            ...hookMocks.projectNotes,
            pendingSyncChanges: false,
            lastLocalSavedAt: 1_700_000_010_000,
            lastSyncedAt: 1_700_000_000_000,
        };

        render(<ProjectNotesEditor project={{ id: 'project-1', notes: null }} />);

        expect(screen.getByRole('button', { name: 'Save to cloud' })).toBeEnabled();
        expect(screen.getByTestId('project-notes-save-status')).toHaveTextContent('Saved locally');
    });

    it('uses compact mobile padding while keeping saved locally status beside the title', () => {
        hookMocks.isMobileLayout = true;
        hookMocks.projectNotes = {
            ...hookMocks.projectNotes,
            pendingSyncChanges: true,
        };

        const { container } = render(<ProjectNotesEditor project={{ id: 'project-1', notes: null }} />);

        expect(screen.getByTestId('project-notes-save-status')).toHaveTextContent('Saved locally');
        expect(screen.getByTestId('project-notes-save-status').parentElement).toHaveClass('flex', 'min-w-0', 'items-center', 'justify-end', 'gap-2');

        const header = container.querySelector('.px-3.py-3');
        const content = container.querySelector('.px-3.pb-3.pt-0');

        expect(header).not.toBeNull();
        expect(content).not.toBeNull();
    });
});