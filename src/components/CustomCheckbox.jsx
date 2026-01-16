import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * CustomCheckbox component - Uses shadcn/ui Checkbox
 * @param {Object} props - Component props
 * @param {boolean} props.checked - Whether checkbox is checked
 * @param {Function} props.onChange - Callback when checkbox state changes (receives new boolean value)
 * @param {boolean} props.disabled - Whether checkbox is disabled
 * @param {string} props.className - Additional CSS classes for the container
 * @param {string} props.label - Optional label text that makes the entire component clickable
 * @param {string} props.labelClassName - Additional CSS classes for the label
 * @param {string} props.id - Optional id for the checkbox (useful for accessibility)
 */
const CustomCheckbox = ({
    checked,
    onChange,
    disabled = false,
    className = "",
    label = null,
    labelClassName = "",
    id = null
}) => {

    const checkboxId = id || (label ? `checkbox-${Math.random().toString(36).substr(2, 9)}` : undefined);

    const handleCheckedChange = (checkedState) => {
        // Radix returns true/false/'indeterminate', we always pass boolean
        onChange(checkedState === true);
    };

    // If no label is provided, return just the checkbox
    if (!label) {
        return (
            <Checkbox
                id={checkboxId}
                checked={checked}
                onCheckedChange={handleCheckedChange}
                disabled={disabled}
                className={cn("h-5 w-5", className)}
            />
        );
    }

    // If label is provided, wrap with label for accessibility
    return (
        <div className={cn("flex items-center gap-2", className)}>
            <Checkbox
                id={checkboxId}
                checked={checked}
                onCheckedChange={handleCheckedChange}
                disabled={disabled}
                className="h-5 w-5"
            />
            <Label
                htmlFor={checkboxId}
                className={cn(
                    "cursor-pointer select-none",
                    disabled && "cursor-not-allowed opacity-50",
                    labelClassName
                )}
            >
                {label}
            </Label>
        </div>
    );
};

export default CustomCheckbox;
