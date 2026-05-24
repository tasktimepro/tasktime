import { useCallback, useEffect, useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import {
    Bold,
    Heading2,
    Italic,
    List,
    ListOrdered,
    ListTodo,
    Redo2,
    Undo2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useProjectNotes } from '@/hooks/useProjectNotes';
import { getCloudButtonLabel, getSaveStatusText, hasPendingProjectNotesCloudSave } from '@/utils/projectNotesStatusUtils';
import { CloudCheckIcon, CloudUploadIcon } from '@/components/ui/icons';
import useIsMobileLayout from '@/hooks/useIsMobileLayout';

const TOOLBAR_BUTTONS = [
    {
        key: 'heading',
        label: 'Heading',
        icon: Heading2,
        isActive: (editor) => editor.isActive('heading', { level: 2 }),
        isDisabled: (editor) => !editor.can().chain().focus().toggleHeading({ level: 2 }).run(),
        run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
        key: 'bold',
        label: 'Bold',
        icon: Bold,
        isActive: (editor) => editor.isActive('bold'),
        isDisabled: (editor) => !editor.can().chain().focus().toggleBold().run(),
        run: (editor) => editor.chain().focus().toggleBold().run(),
    },
    {
        key: 'italic',
        label: 'Italic',
        icon: Italic,
        isActive: (editor) => editor.isActive('italic'),
        isDisabled: (editor) => !editor.can().chain().focus().toggleItalic().run(),
        run: (editor) => editor.chain().focus().toggleItalic().run(),
    },
    {
        key: 'bullet-list',
        label: 'Bullet list',
        icon: List,
        isActive: (editor) => editor.isActive('bulletList'),
        isDisabled: (editor) => !editor.can().chain().focus().toggleBulletList().run(),
        run: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
        key: 'ordered-list',
        label: 'Numbered list',
        icon: ListOrdered,
        isActive: (editor) => editor.isActive('orderedList'),
        isDisabled: (editor) => !editor.can().chain().focus().toggleOrderedList().run(),
        run: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
        key: 'task-list',
        label: 'Checklist',
        icon: ListTodo,
        isActive: (editor) => editor.isActive('taskList'),
        isDisabled: (editor) => !editor.can().chain().focus().toggleTaskList().run(),
        run: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
    {
        key: 'undo',
        label: 'Undo',
        icon: Undo2,
        isActive: () => false,
        isDisabled: (editor) => !editor.can().chain().focus().undo().run(),
        run: (editor) => editor.chain().focus().undo().run(),
    },
    {
        key: 'redo',
        label: 'Redo',
        icon: Redo2,
        isActive: () => false,
        isDisabled: (editor) => !editor.can().chain().focus().redo().run(),
        run: (editor) => editor.chain().focus().redo().run(),
    },
];

const ProjectNotesEditor = ({ project }) => {
    const isMobileLayout = useIsMobileLayout();
    const {
        initialDocument,
        isDirty,
        isSavingLocal,
        isDriveConnected,
        manualSyncInProgress,
        pendingSyncChanges,
        lastLocalSavedAt,
        lastSyncedAt,
        updateDraft,
        flushPendingNotes,
        saveNotesToCloud,
    } = useProjectNotes(project.id, project.notes);
    const [, setEditorStateVersion] = useState(0);
    const refreshToolbarState = useCallback(() => {
        setEditorStateVersion((value) => value + 1);
    }, []);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                link: false,
                heading: {
                    levels: [2, 3],
                },
            }),
            Link.configure({
                autolink: true,
                linkOnPaste: true,
                openOnClick: true,
                HTMLAttributes: {
                    class: 'status-info-text-strong underline underline-offset-2',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                },
            }),
            TaskList.configure({
                HTMLAttributes: {
                    class: 'task-list',
                },
            }),
            TaskItem.configure({
                nested: true,
                HTMLAttributes: {
                    class: 'task-item',
                },
            }),
            Placeholder.configure({
                placeholder: 'Add project notes, links, checklists, or a quick plan...',
            }),
        ],
        content: initialDocument,
        editorProps: {
            attributes: {
                class: cn(
                    'min-h-[18rem] w-full text-base text-foreground outline-none md:text-sm',
                    'prose prose-sm max-w-none dark:prose-invert',
                    '[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold',
                    '[&>h2:first-child]:mt-0',
                    '[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold',
                    '[&>h3:first-child]:mt-0',
                    '[&_p]:my-2 [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:text-muted-foreground [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
                    '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
                    '[&_li]:my-1 [&_a]:break-all',
                    '[&_.task-list]:my-2 [&_.task-list]:ml-0 [&_.task-list]:list-none [&_.task-list]:pl-0',
                    '[&_.task-item]:my-1 [&_.task-item]:flex [&_.task-item]:list-none [&_.task-item]:items-start [&_.task-item]:gap-2',
                    '[&_.task-item>label]:flex [&_.task-item>label]:h-6 [&_.task-item>label]:shrink-0 [&_.task-item>label]:items-center',
                    '[&_.task-item>label>input]:mt-0 [&_.task-item>label>input]:h-4 [&_.task-item>label>input]:w-4 [&_.task-item>label>input]:cursor-pointer',
                    '[&_.task-item>label>span]:hidden',
                    '[&_.task-item>div]:min-w-0 [&_.task-item>div]:flex-1 [&_.task-item>div]:pt-0',
                    '[&_.task-item>div>p]:my-0 [&_.task-item>div>p]:leading-6',
                    '[&_.task-item[data-checked="true"]>div]:text-muted-foreground [&_.task-item[data-checked="true"]>div]:line-through',
                    '[&_[data-type="taskList"]]:my-2 [&_[data-type="taskList"]]:ml-0 [&_[data-type="taskList"]]:list-none [&_[data-type="taskList"]]:pl-0',
                    '[&_[data-type="taskItem"]]:my-1 [&_[data-type="taskItem"]]:flex [&_[data-type="taskItem"]]:list-none [&_[data-type="taskItem"]]:items-start [&_[data-type="taskItem"]]:gap-2',
                    '[&_[data-type="taskItem"]>label]:flex [&_[data-type="taskItem"]>label]:h-6 [&_[data-type="taskItem"]>label]:shrink-0 [&_[data-type="taskItem"]>label]:items-center',
                    '[&_[data-type="taskItem"]>label>input]:mt-0 [&_[data-type="taskItem"]>label>input]:h-4 [&_[data-type="taskItem"]>label>input]:w-4 [&_[data-type="taskItem"]>label>input]:cursor-pointer',
                    '[&_[data-type="taskItem"]>label>span]:hidden',
                    '[&_[data-type="taskItem"]>div]:min-w-0 [&_[data-type="taskItem"]>div]:flex-1 [&_[data-type="taskItem"]>div]:pt-0',
                    '[&_[data-type="taskItem"]>div>p]:my-0 [&_[data-type="taskItem"]>div>p]:leading-6',
                    '[&_[data-type="taskItem"][data-checked="true"]>div]:text-muted-foreground [&_[data-type="taskItem"][data-checked="true"]>div]:line-through'
                ),
            },
        },
        onUpdate: ({ editor: nextEditor }) => {
            updateDraft(nextEditor.getJSON());
        },
        onBlur: () => {
            flushPendingNotes();
        },
    });

    useEffect(() => {
        if (!editor) {
            return;
        }

        editor.on('selectionUpdate', refreshToolbarState);
        editor.on('focus', refreshToolbarState);
        editor.on('blur', refreshToolbarState);

        return () => {
            editor.off('selectionUpdate', refreshToolbarState);
            editor.off('focus', refreshToolbarState);
            editor.off('blur', refreshToolbarState);
        };
    }, [editor, refreshToolbarState]);

    const hasPendingCloudSave = useMemo(() => hasPendingProjectNotesCloudSave({
        isSavingLocal,
        isDirty,
        pendingSyncChanges,
        lastLocalSavedAt,
        lastSyncedAt,
    }), [isDirty, isSavingLocal, lastLocalSavedAt, lastSyncedAt, pendingSyncChanges]);
    const saveStatusText = useMemo(() => getSaveStatusText({
        isSavingLocal,
        isDirty,
        pendingSyncChanges,
        lastLocalSavedAt,
        lastSyncedAt,
    }), [isDirty, isSavingLocal, lastLocalSavedAt, lastSyncedAt, pendingSyncChanges]);
    const cloudButtonLabel = getCloudButtonLabel(hasPendingCloudSave, isDriveConnected);
    const CloudButtonIcon = hasPendingCloudSave ? CloudUploadIcon : CloudCheckIcon;

    const handleManualCloudSave = useCallback(async () => {
        await saveNotesToCloud();
    }, [saveNotesToCloud]);

    return (
        <Card>
            <CardHeader className={cn('pb-3', isMobileLayout && 'px-3 py-3')}>
                <div className="flex items-center justify-between gap-3">
                    <CardTitle className="shrink-0 text-lg">Notes</CardTitle>

                    <div className="flex min-w-0 items-center justify-end gap-2">
                        {saveStatusText && (
                            <span className="min-w-0 truncate text-xs text-muted-foreground" data-testid="project-notes-save-status">
                                {saveStatusText}
                            </span>
                        )}

                        {isDriveConnected && (
                            <Button
                                variant="outline"
                                size="sm"
                                leadingIcon={CloudButtonIcon}
                                onClick={handleManualCloudSave}
                                loading={manualSyncInProgress}
                                loadingText="Saving..."
                                disabled={!hasPendingCloudSave}
                                className="shrink-0"
                            >
                                {cloudButtonLabel}
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className={cn('space-y-3', isMobileLayout && 'px-3 pb-3 pt-0')}>
                <TooltipProvider>
                    <div className={cn('flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30', isMobileLayout ? 'p-1' : 'p-1.5')}>
                        {TOOLBAR_BUTTONS.map((item) => {
                            const Icon = item.icon;
                            const isActive = editor ? item.isActive(editor) : false;
                            const isDisabled = !editor || item.isDisabled(editor);

                            return (
                                <Tooltip key={item.key}>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={isActive ? 'secondary' : 'ghost'}
                                            size="icon-sm"
                                            disabled={isDisabled}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => {
                                                if (!editor) {
                                                    return;
                                                }

                                                item.run(editor);
                                                refreshToolbarState();
                                            }}
                                            aria-label={item.label}
                                        >
                                            <Icon className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {item.label}
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>
                </TooltipProvider>

                <div className={cn(
                    'overflow-hidden rounded-lg border border-border bg-background',
                    isMobileLayout
                        ? '[&_.ProseMirror]:px-3 [&_.ProseMirror]:py-3'
                        : '[&_.ProseMirror]:px-4 [&_.ProseMirror]:py-4'
                )}>
                    <EditorContent editor={editor} />
                </div>
            </CardContent>
        </Card>
    );
};

export default ProjectNotesEditor;