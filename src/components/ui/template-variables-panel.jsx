import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronDownIcon } from '@/components/ui/icons';
import { useToast } from '@/hooks/useToast.ts';
import { cn } from '@/lib/utils.ts';

const copyTextToClipboard = async (text) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';

    document.body.appendChild(textarea);
    textarea.select();

    const didCopy = document.execCommand('copy');

    document.body.removeChild(textarea);

    if (!didCopy) {
        throw new Error('Copy failed');
    }
};

/**
 * TemplateVariablesPanel - shared responsive layout for template variables.
 */
export function TemplateVariablesPanel({
    title = 'Available Variables',
    description = null,
    variables,
    onVariableCopy = null,
    className = '',
    defaultExpanded = false,
}) {
    const { showError, showSuccess } = useToast();
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const handleCopy = async (variableKey) => {
        try {
            await copyTextToClipboard(variableKey);
            showSuccess(`Copied ${variableKey}`);
            onVariableCopy?.(variableKey);
        } catch {
            showError('Unable to copy variable');
        }
    };

    return (
        <div className={cn('rounded-lg border border-border', className)}>
            <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className={cn(
                    'w-full cursor-pointer bg-muted/50 px-4 py-3 text-left hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring',
                    isExpanded ? 'rounded-t-lg' : 'rounded-lg'
                )}
                aria-expanded={isExpanded}
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h4 className="text-sm font-medium text-foreground">{title}</h4>
                        {description && (
                            <p className="mt-1 text-xs leading-5 text-muted-foreground sm:max-w-2xl">
                                {description}
                            </p>
                        )}
                    </div>
                    <ChevronDownIcon
                        className={cn(
                            'h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform',
                            isExpanded && 'rotate-180'
                        )}
                    />
                </div>
            </button>
            {isExpanded && (
                <div className="space-y-3 p-4">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                        {variables.map((variable) => (
                            <button
                                key={variable.key}
                                type="button"
                                className="flex min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background/80 p-2 text-left text-xs shadow-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                onClick={() => handleCopy(variable.key)}
                            >
                                <code className="flex-shrink-0 whitespace-nowrap rounded border bg-background px-1.5 py-1 font-mono text-[11px] leading-4 text-foreground sm:text-xs">
                                    {variable.key}
                                </code>
                                <span className="min-w-0 text-xs leading-5 text-muted-foreground">
                                    {variable.description}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

TemplateVariablesPanel.propTypes = {
    title: PropTypes.string,
    description: PropTypes.node,
    variables: PropTypes.arrayOf(PropTypes.shape({
        key: PropTypes.string.isRequired,
        description: PropTypes.string.isRequired,
    })).isRequired,
    onVariableCopy: PropTypes.func,
    className: PropTypes.string,
    defaultExpanded: PropTypes.bool,
};