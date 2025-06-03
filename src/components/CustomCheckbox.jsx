import { CheckIcon } from '@heroicons/react/24/outline';

/**
 * CustomCheckbox component - Modern styled checkbox
 * @param {Object} props - Component props
 * @param {boolean} props.checked - Whether checkbox is checked
 * @param {Function} props.onChange - Callback when checkbox state changes
 * @param {boolean} props.disabled - Whether checkbox is disabled
 * @param {string} props.className - Additional CSS classes
 */
const CustomCheckbox = ({ checked, onChange, disabled = false, className = "" }) => {
    return (
        <button
            type="button"
            onClick={onChange}
            disabled={disabled}
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
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-pointer'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                ${className}
            `}
        >
            {checked && (
                <CheckIcon className="w-3 h-3" strokeWidth={3} />
            )}
        </button>
    );
};

export default CustomCheckbox;
