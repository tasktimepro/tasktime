import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal';
import { generateSlugId } from '../../utils/idUtils';
import { useToast } from '../../hooks/useToast';
import CustomCheckbox from '../CustomCheckbox';

/**
 * ProjectModal component - Modal for creating and editing projects
 */
const ProjectModal = ({
    isOpen,
    onClose,
    projects,
    setProjects,
    editingProject = null,
    clients,
    modalOptions = null,
    openClientModal,
    saveFormState,
    getSavedState,
    clearSavedState
}) => {
    const [selectedClientRate, setSelectedClientRate] = useState(null);
    const { showSuccess } = useToast();

    const [formData, setFormData] = useState({
        title: '',
        hourlyRate: '', // Keep as empty string for proper placeholder behavior
        flatRate: false,
        preferredClientId: '',
        overrideRate: false,
        isPersonal: false
    });

    // Initialize form data when editing a project
    useEffect(() => {
        if (editingProject) {
            // Find the client for this project
            const projectClient = editingProject.preferredClientId ? clients.find(c => c.id === editingProject.preferredClientId) : null;
            setSelectedClientRate(projectClient);

            // Determine if the project is overriding client rates
            const isOverriding = projectClient && (
                (editingProject.hourlyRate !== projectClient.hourlyRate) || 
                (editingProject.flatRate !== projectClient.flatRate)
            );

            setFormData({
                title: editingProject.title,
                hourlyRate: editingProject.hourlyRate ? editingProject.hourlyRate.toString() : '',
                flatRate: editingProject.flatRate || false,
                preferredClientId: editingProject.preferredClientId || '',
                overrideRate: isOverriding,
                isPersonal: editingProject.isPersonal || false
            });
        } else {
            // If modalOptions contains preselectedClientId, it takes priority
            if (modalOptions?.preselectedClientId) {
                const preselectedClient = clients.find(c => c.id === modalOptions.preselectedClientId);
                if (preselectedClient) {
                    // Only set initial values if client isn't already selected (avoid resetting user input)
                    setFormData(prev => {
                        if (prev.preferredClientId === modalOptions.preselectedClientId) {
                            // Already initialized with this client, don't reset
                            return prev;
                        }
                        // First time initialization with preselected client
                        return {
                            title: '',
                            hourlyRate: preselectedClient.hourlyRate ? preselectedClient.hourlyRate.toString() : '',
                            flatRate: preselectedClient.flatRate || false,
                            preferredClientId: modalOptions.preselectedClientId,
                            overrideRate: false,
                            isPersonal: false
                        };
                    });
                    setSelectedClientRate(preselectedClient);
                }
            } else {
                // Check if there's saved state from a previous session (only when no preselected client)
                const savedState = getSavedState && getSavedState();
                if (savedState) {
                    setFormData({
                        title: savedState.title || '',
                        hourlyRate: savedState.hourlyRate || '',
                        flatRate: savedState.flatRate || false,
                        preferredClientId: savedState.preferredClientId || '',
                        overrideRate: savedState.overrideRate || false,
                        isPersonal: savedState.isPersonal || false
                    });
                    
                    // Restore client rate if needed
                    if (savedState.preferredClientId && clients.length > 0) {
                        const savedClient = clients.find(c => c.id === savedState.preferredClientId);
                        setSelectedClientRate(savedClient || null);
                    }
                } else {
                    // No saved state and no preselected client - reset form
                    setFormData({
                        title: '',
                        hourlyRate: '',
                        flatRate: false,
                        preferredClientId: '',
                        overrideRate: false,
                        isPersonal: false
                    });
                    setSelectedClientRate(null);
                }
            }
        }
    }, [editingProject, clients, getSavedState, modalOptions]);

    // Save form state whenever it changes (debounced)
    useEffect(() => {
        if (saveFormState && !editingProject && isOpen) {
            const timeoutId = setTimeout(() => {
                saveFormState({
                    ...formData,
                    selectedClientRate: selectedClientRate
                });
            }, 500); // Debounce to avoid too frequent saves
            
            return () => clearTimeout(timeoutId);
        }
    }, [formData, selectedClientRate, saveFormState, editingProject, isOpen]);

    /**
     * Handle form input changes
     */
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // If client selection changes, update the client rate
        if (name === 'preferredClientId' && !formData.isPersonal) {
            if (value) {
                const selectedClient = clients.find(c => c.id === value);
                setSelectedClientRate(selectedClient);

                // If not overriding rate and client has a rate, set it
                if (!formData.overrideRate && selectedClient) {
                    setFormData(prev => ({
                        ...prev,
                        hourlyRate: selectedClient.hourlyRate ? selectedClient.hourlyRate.toString() : '',
                        flatRate: selectedClient.flatRate || false
                    }));
                }
            } else {
                setSelectedClientRate(null);
                if (!formData.overrideRate) {
                    setFormData(prev => ({
                        ...prev,
                        hourlyRate: '',
                        flatRate: false
                    }));
                }
            }
        }
    };

    /**
     * Handle override rate checkbox
     */
    const handleOverrideRateChange = (checked) => {
        setFormData(prev => ({
            ...prev,
            overrideRate: checked,
            // If disabling override and we have a selected client, use client's rate
            ...((!checked && selectedClientRate) ? {
                hourlyRate: selectedClientRate.hourlyRate ? selectedClientRate.hourlyRate.toString() : '',
                flatRate: selectedClientRate.flatRate || false
            } : {})
        }));
    };

    /**
     * Create a new project
     */
    const handleCreateProject = (e) => {
        e.preventDefault();

        if (!formData.title) {
            return; // Title is required
        }

        if (!formData.isPersonal && !formData.preferredClientId) {
            return; // Client is mandatory for non-personal projects
        }
        
        // If not flat rate and not personal, hourly rate is required (either from client or override)
        if (!formData.isPersonal && !formData.flatRate && !formData.hourlyRate) {
            return; // Hourly rate is required when not using flat rate for billable projects
        }

        const newProject = {
            id: generateSlugId(formData.title),
            title: formData.title,
            hourlyRate: formData.hourlyRate !== '' ? parseFloat(formData.hourlyRate) : null,
            flatRate: formData.flatRate || false,
            preferredClientId: formData.isPersonal ? null : (formData.preferredClientId || null),
            isPersonal: formData.isPersonal || false,
            createdAt: Date.now(),
            lastBilledAt: null,
            archived: false
        };

        setProjects([...projects, newProject]);

        // Reset form
        setFormData({ title: '', hourlyRate: '', flatRate: false, preferredClientId: '', overrideRate: false, isPersonal: false });
        setSelectedClientRate(null);

        // Clear saved state since project was successfully created
        if (clearSavedState) {
            clearSavedState();
        }

        showSuccess('Project created successfully!');
        onClose();
    };

    /**
     * Update an existing project
     */
    const handleUpdateProject = (e) => {
        e.preventDefault();

        if (!formData.title) {
            return; // Title is required
        }

        if (!formData.isPersonal && !formData.preferredClientId) {
            return; // Client is mandatory for non-personal projects
        }
        
        // If not flat rate and not personal, hourly rate is required (either from client or override)
        if (!formData.isPersonal && !formData.flatRate && !formData.hourlyRate) {
            return; // Hourly rate is required when not using flat rate for billable projects
        }

        const updatedProjects = projects.map(project =>
            project.id === editingProject.id
                ? {
                    ...project,
                    title: formData.title,
                    hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
                    flatRate: formData.flatRate || false,
                    preferredClientId: formData.isPersonal ? null : (formData.preferredClientId || null),
                    isPersonal: formData.isPersonal || false
                }
                : project
        );

        setProjects(updatedProjects);

        // Clear saved state since project was successfully updated  
        if (clearSavedState) {
            clearSavedState();
        }

        showSuccess('Project updated successfully!');
        onClose();
    };

    /**
     * Handle modal close
     */
    const handleClose = () => {
        // Reset form data
        setFormData({ title: '', hourlyRate: '', flatRate: false, preferredClientId: '', overrideRate: false, isPersonal: false });
        setSelectedClientRate(null);
        onClose();
    };

    // Footer content with action buttons
    const footer = (
        <div className="flex justify-end space-x-3">
            <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
                Cancel
            </button>

            <button
                type="submit"
                form="project-form"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                {editingProject ? 'Update' : 'Create'} Project
            </button>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={editingProject ? 'Edit Project' : 'Create New Project'}
            size="lg"
            footer={footer}
        >
            <form 
                id="project-form" 
                onSubmit={editingProject ? handleUpdateProject : handleCreateProject} 
                className="space-y-5"
            >
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                        Project Title <span className="text-red-500">*</span>
                    </label>

                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                        placeholder="Enter project title"
                    />
                </div>

                {/* Personal Project Toggle - Hide when client is preselected */}
                {!modalOptions?.preselectedClientId && (
                    <div className="flex items-start space-x-3">
                        <div className="flex items-center h-5">
                            <CustomCheckbox
                                id="isPersonal"
                                checked={formData.isPersonal}
                                onChange={(checked) => setFormData(prev => ({
                                    ...prev,
                                    isPersonal: checked,
                                    // Clear client selection when marking as personal
                                    preferredClientId: checked ? '' : prev.preferredClientId,
                                    // Reset override rate when toggling
                                    overrideRate: false,
                                    hourlyRate: checked ? prev.hourlyRate : (selectedClientRate && !prev.overrideRate ? selectedClientRate.hourlyRate?.toString() || '' : prev.hourlyRate),
                                    flatRate: checked ? prev.flatRate : (selectedClientRate && !prev.overrideRate ? selectedClientRate.flatRate || false : prev.flatRate)
                                }))}
                            />
                        </div>
                        <div className="text-sm">
                            <label htmlFor="isPersonal" className="font-medium text-gray-700 cursor-pointer">
                                Personal project (Not billable)
                            </label>
                            <p className="text-gray-500">
                                Check this for personal projects without clients or invoices.
                            </p>
                        </div>
                    </div>
                )}

                {/* Client Selection - Only show for non-personal projects */}
                {!formData.isPersonal && (
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label htmlFor="preferredClientId" className="block text-sm font-medium text-gray-700">
                                Client <span className="text-red-500">*</span>
                            </label>
                            {openClientModal && !editingProject && !modalOptions?.preselectedClientId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        // Save current form state before opening nested modal
                                        if (saveFormState) {
                                            saveFormState({
                                                ...formData,
                                                selectedClientRate: selectedClientRate
                                            });
                                        }
                                        openClientModal();
                                    }}
                                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    + New Client
                                </button>
                            )}
                        </div>
                        <select
                            id="preferredClientId"
                            name="preferredClientId"
                            value={formData.preferredClientId}
                            onChange={handleInputChange}
                            required
                            disabled={!!modalOptions?.preselectedClientId}
                            className={`mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5 ${
                                modalOptions?.preselectedClientId ? 'bg-gray-100 cursor-not-allowed' : ''
                            }`}
                        >
                            <option value="">Select a client</option>
                            {clients.filter(c => !c.archived).map(client => (
                                <option key={client.id} value={client.id}>
                                    {client.title}
                                </option>
                            ))}
                        </select>
                        {!modalOptions?.preselectedClientId && (
                            <p className="text-xs text-gray-500 mt-2">
                                Every project must be associated with a client.
                            </p>
                        )}
                    </div>
                )}

                {/* Rate Information from Client */}
                {selectedClientRate && !formData.overrideRate && !formData.isPersonal && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-blue-900 mb-2">Rate from Client</h4>
                        {selectedClientRate.flatRate ? (
                            <p className="text-sm text-blue-700">
                                This client uses flat rate pricing (non-hourly basis)
                            </p>
                        ) : selectedClientRate.hourlyRate ? (
                            <p className="text-sm text-blue-700">
                                Hourly Rate: {selectedClientRate.hourlyRate}/hour
                            </p>
                        ) : (
                            <p className="text-sm text-blue-700">
                                No default rate set for this client
                            </p>
                        )}
                    </div>
                )}

                {/* Override Rate Checkbox */}
                {selectedClientRate && (
                    <div className="flex items-center space-x-3">
                        <CustomCheckbox
                            checked={formData.overrideRate}
                            onChange={handleOverrideRateChange}
                            label="Override client rate for this project"
                            labelClassName="text-sm font-medium text-gray-700"
                            id="overrideRate"
                        />
                    </div>
                )}

                {/* Rate Override Section */}
                {formData.overrideRate && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Project Rate Override</h4>
                        
                        <div className="flex items-center space-x-3 mb-4">
                            <CustomCheckbox
                                checked={formData.flatRate}
                                onChange={(checked) => setFormData(prev => ({ ...prev, flatRate: checked }))}
                                label="Flat rate project (non-hourly basis)"
                                labelClassName="text-sm font-medium text-gray-700"
                                id="flatRate"
                            />
                        </div>

                        <div className={formData.flatRate ? "hidden" : ""}>
                            <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700">
                                Hourly Rate {!formData.flatRate && <span className="text-red-500">*</span>}
                            </label>

                            <input
                                type="number"
                                id="hourlyRate"
                                name="hourlyRate"
                                value={formData.hourlyRate}
                                onChange={handleInputChange}
                                min="0"
                                step="0.01"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-2.5 py-1.5"
                                placeholder="0.00"
                                required={!formData.flatRate && formData.overrideRate}
                            />
                        </div>
                    </div>
                )}
            </form>
        </Modal>
    );
};

ProjectModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    projects: PropTypes.array.isRequired,
    setProjects: PropTypes.func.isRequired,
    clients: PropTypes.array.isRequired,
    editingProject: PropTypes.object,
    modalOptions: PropTypes.object,
    openClientModal: PropTypes.func,
    saveFormState: PropTypes.func,
    getSavedState: PropTypes.func,
    clearSavedState: PropTypes.func
};

export default ProjectModal;