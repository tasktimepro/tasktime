/**
 * FloatingActionButton - Quick task creation button
 */

import PropTypes from 'prop-types';
import { PlusIcon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';

/**
 * @param {Object} props
 * @param {Function} props.onTaskClick
 * @param {string} [props.className]
 */
const FloatingActionButton = ({ onTaskClick, className = '' }) => {

    return (
        <Button
            onClick={onTaskClick}
            className={`fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg ${className}`}
            variant="default"
            size="icon"
            title="Create new task"
            aria-label="Create new task"
        >
            <PlusIcon className="h-5 w-5" />
        </Button>
    );
};

FloatingActionButton.propTypes = {
    className: PropTypes.string,
    onTaskClick: PropTypes.func.isRequired,
};

export default FloatingActionButton;
