import { useEffect, useRef, useState } from 'react';
import { MagnifyingGlassIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils.ts';

const CardSearchControl = ({
    value,
    onChange,
    placeholder,
    buttonLabel,
    inputAriaLabel,
    buttonClassName,
    inputClassName,
}) => {
    const [isExpanded, setIsExpanded] = useState(Boolean(value));
    const inputRef = useRef(null);

    useEffect(() => {
        if (value && !isExpanded) {
            setIsExpanded(true);
        }
    }, [value, isExpanded]);

    useEffect(() => {
        if (isExpanded) {
            inputRef.current?.focus();
        }
    }, [isExpanded]);

    const handleToggleSearch = () => {
        if (isExpanded && !value) {
            setIsExpanded(false);
            return;
        }

        setIsExpanded(true);
    };

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={buttonLabel}
                title={buttonLabel}
                onClick={handleToggleSearch}
                className={buttonClassName}
            >
                <MagnifyingGlassIcon className="h-4 w-4" />
            </Button>
            {isExpanded && (
                <Input
                    ref={inputRef}
                    type="text"
                    aria-label={inputAriaLabel}
                    placeholder={placeholder}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className={cn('w-full sm:w-56', inputClassName)}
                />
            )}
        </>
    );
};

export default CardSearchControl;