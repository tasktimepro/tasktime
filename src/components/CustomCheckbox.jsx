import { CheckIcon } from '@heroicons/react/24/outline';

/**
 * CustomCheckbox component - Modern styled checkbox
 * @param {Object} props - Component props
 * @param {boolean} props.checked - Whether checkbox is checked
 * @param {Function} props.onChange - Callback when checkbox state changes
 * @param {boolean} props.disabled - Whether checkbox is disabled
 * @param {string} props.className - Additional CSS classes
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
    // Click handler
    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (disabled) return;

        // Always pass the new checked state as parameter
        // This is the standard React pattern and works reliably in production
        onChange(!checked);
    };

    const checkboxElement = (
        <button
            type="button"
            onClick={label ? undefined : handleClick} // Only handle click if no label
            disabled={disabled}
            id={id}
            className={`
                flex items-center justify-center
                w-5 h-5 
                border-2 rounded-md
                transition-all duration-200
                ${checked
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 hover:border-blue-400'
                }
                ${disabled
                    ? 'opacity-50'
                    : 'cursor-pointer'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                ${label ? '' : className}
            `}
        >
            {checked && (
                <CheckIcon className="w-3 h-3" strokeWidth={3} />
            )}
        </button>
    );

    // If no label is provided, return just the checkbox (original behavior)
    if (!label) {
        return checkboxElement;
    }

    // If label is provided, wrap in a clickable container
    return (
        <div
            className={`flex items-center ${disabled ? '' : 'cursor-pointer'} ${className}`}
            onClick={disabled ? undefined : handleClick}
        >
            {checkboxElement}
            <label
                htmlFor={id}
                className={`ml-2 ${disabled ? 'text-gray-400' : 'text-gray-700'} ${labelClassName}`}
            >
                {label}
            </label>
        </div>
    );
};

export default CustomCheckbox;
