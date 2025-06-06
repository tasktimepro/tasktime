import { useState, useEffect } from 'react';
import Modal from './Modal';

/**
 * TimeEditModal component - Modal for editing task time
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Function to close modal
 * @param {number} props.currentTime - Current time in milliseconds
 * @param {Function} props.onSave - Function to save edited time
 * @param {string} props.taskTitle - Task title for display
 */
const TimeEditModal = ({ isOpen, onClose, currentTime, onSave, taskTitle }) => {
    // Convert milliseconds to hours, minutes, seconds
    const hours = Math.floor(currentTime / (1000 * 60 * 60));
    const minutes = Math.floor((currentTime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((currentTime % (1000 * 60)) / 1000);

    const [editHours, setEditHours] = useState(hours);
    const [editMinutes, setEditMinutes] = useState(minutes);
    const [editSeconds, setEditSeconds] = useState(seconds);
    
    // Reset form values when currentTime changes
    useEffect(() => {
        if (isOpen) {
            setEditHours(hours);
            setEditMinutes(minutes);
            setEditSeconds(seconds);
        }
    }, [isOpen, hours, minutes, seconds]);

    /**
     * Handle saving edited time
     */
    const handleSave = () => {
        // Convert back to milliseconds, treating empty strings as 0
        const hoursValue = editHours === '' ? 0 : editHours;
        const minutesValue = editMinutes === '' ? 0 : editMinutes;
        const secondsValue = editSeconds === '' ? 0 : editSeconds;
        
        const newTime = (hoursValue * 60 * 60 + minutesValue * 60 + secondsValue) * 1000;

        onSave(newTime);
        onClose();
    };

    /**
     * Reset form when modal opens
     */
    const handleReset = () => {
        setEditHours(hours);
        setEditMinutes(minutes);
        setEditSeconds(seconds);
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose}
            title={`Edit Time - ${taskTitle}`}
            size="md"
        >
            <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Hours
                        </label>

                        <input
                            type="number"
                            min="0"
                            value={editHours === '' ? '' : editHours}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                if (newValue === '') {
                                    setEditHours('');
                                } else {
                                    setEditHours(Math.max(0, parseInt(newValue) || 0));
                                }
                            }}
                            className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 px-2.5 py-1.5"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Minutes
                        </label>

                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={editMinutes === '' ? '' : editMinutes}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                if (newValue === '') {
                                    setEditMinutes('');
                                } else {
                                    setEditMinutes(Math.max(0, Math.min(59, parseInt(newValue) || 0)));
                                }
                            }}
                            className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 px-2.5 py-1.5"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Seconds
                        </label>

                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={editSeconds === '' ? '' : editSeconds}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                if (newValue === '') {
                                    setEditSeconds('');
                                } else {
                                    setEditSeconds(Math.max(0, Math.min(59, parseInt(newValue) || 0)));
                                }
                            }}
                            className="w-full border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 px-2.5 py-1.5"
                        />
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                        Reset
                    </button>

                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default TimeEditModal;
