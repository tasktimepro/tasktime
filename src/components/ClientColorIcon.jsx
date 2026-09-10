import { UserIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/** Render client identity using the saved client color or the neutral fallback. */
const ClientColorIcon = ({
    client,
    className,
    title,
    testId = 'client-color-icon',
}) => {
    const color = typeof client?.color === 'string'
        ? client.color.trim().replace(/^#([a-f\d])([a-f\d])([a-f\d])$/i, '#$1$1$2$2$3$3')
        : '';

    return (
        <UserIcon
            aria-hidden="true"
            data-testid={testId}
            className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground', className)}
            style={/^#[a-f\d]{6}$/i.test(color) ? { color } : undefined}
            title={title}
        />
    );
};

export default ClientColorIcon;
