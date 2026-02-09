import PropTypes from 'prop-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCurrencyOptions } from '@/utils/currencyUtils.ts';

/**
 * CurrencySelect component - Shared currency selector input.
 * @param {Object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onValueChange
 * @param {string} props.id
 * @param {string} props.placeholder
 * @param {boolean} props.includeFullName
 * @param {boolean} props.disabled
 */
const CurrencySelect = ({
    value,
    onValueChange,
    id,
    placeholder = 'Select a currency',
    includeFullName = true,
    disabled = false,
}) => {

    const options = getCurrencyOptions(includeFullName);

    return (
        <Select
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
        >
            <SelectTrigger id={id}>
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {options.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

CurrencySelect.propTypes = {
    value: PropTypes.string.isRequired,
    onValueChange: PropTypes.func.isRequired,
    id: PropTypes.string,
    placeholder: PropTypes.string,
    includeFullName: PropTypes.bool,
    disabled: PropTypes.bool,
};

export default CurrencySelect;
