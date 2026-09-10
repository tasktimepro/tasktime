import { ProjectIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/** Render project identity using the project color, inherited client color, or neutral fallback. */
const ProjectColorIcon = ({
    project,
    client,
    className,
    title,
    testId = 'project-color-icon',
}) => {
    const selectedColor = project?.color || client?.color || project?.client?.color;
    const color = typeof selectedColor === 'string'
        ? selectedColor.trim().replace(/^#([a-f\d])([a-f\d])([a-f\d])$/i, '#$1$1$2$2$3$3')
        : '';

    return (
        <ProjectIcon
            aria-hidden="true"
            data-testid={testId}
            className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground', className)}
            style={/^#[a-f\d]{6}$/i.test(color) ? { color } : undefined}
            title={title}
        />
    );
};

export default ProjectColorIcon;
