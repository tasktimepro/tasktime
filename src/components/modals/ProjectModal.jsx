import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
            <Button
                type="button"
                variant="outline"
                onClick={handleClose}
            >
                Cancel
            </Button>

            <Button
                type="submit"
                form="project-form"
            >
                {editingProject ? 'Update' : 'Create'} Project
            </Button>
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
                    <Label htmlFor="title">
                        Project Title <span className="text-red-500">*</span>
                    </Label>

                    <Input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        required
                        className="mt-1"
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
                            <label htmlFor="isPersonal" className="font-medium text-foreground cursor-pointer">
                                Personal project (Not billable)
                            </label>
                            <p className="text-muted-foreground">
                                Check this for personal projects without clients or invoices.
                            </p>
                        </div>
                    </div>
                )}

                {/* Client Selection - Only show for non-personal projects */}
                {!formData.isPersonal && (
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <Label htmlFor="preferredClientId">
                                Client <span className="text-red-500">*</span>
                            </Label>
                            {openClientModal && !editingProject && !modalOptions?.preselectedClientId && (
                                <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0"
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
                                >
                                    + New Client
                                </Button>
                            )}
                        </div>
                        <select
                            id="preferredClientId"
                            name="preferredClientId"
                            value={formData.preferredClientId}
                            onChange={handleInputChange}
                            required
                            disabled={!!modalOptions?.preselectedClientId}
                            className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm ${
                                modalOptions?.preselectedClientId ? 'bg-muted cursor-not-allowed opacity-50' : ''
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
                            <p className="text-xs text-muted-foreground mt-2">
                                Every project must be associated with a client.
                            </p>
                        )}
                    </div>
                )}

                {/* Rate Information from Client */}
                {selectedClientRate && !formData.overrideRate && !formData.isPersonal && (
                    <div className="bg-muted border border-border rounded-lg p-4">
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
                            labelClassName="text-sm font-medium text-foreground"
                            id="overrideRate"
                        />
                    </div>
                )}

                {/* Rate Override Section */}
                {formData.overrideRate && (
                    <div className="border border-border rounded-lg p-4 bg-muted">
                        <h4 className="text-sm font-medium text-foreground mb-3">Project Rate Override</h4>
                        
                        <div className="flex items-center space-x-3 mb-4">
                            <CustomCheckbox
                                checked={formData.flatRate}
                                onChange={(checked) => setFormData(prev => ({ ...prev, flatRate: checked }))}
                                label="Flat rate project (non-hourly basis)"
                                labelClassName="text-sm font-medium text-foreground"
                                id="flatRate"
                            />
                        </div>

                        <div className={formData.flatRate ? "hidden" : ""}>
                            <Label htmlFor="hourlyRate">
                                Hourly Rate {!formData.flatRate && <span className="text-red-500">*</span>}
                            </Label>

                            <Input
                                type="number"
                                id="hourlyRate"
                                name="hourlyRate"
                                value={formData.hourlyRate}
                                onChange={handleInputChange}
                                min="0"
                                step="0.01"
                                className="mt-1"
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