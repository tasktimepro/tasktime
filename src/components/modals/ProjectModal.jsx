import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineFieldHeader } from '@/components/ui/inline-field-header';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Notice } from '@/components/ui/notice';
import { generateSlugId } from '../../utils/idUtils.ts';
import { useToast } from '../../hooks/useToast.ts';
import { useProjects } from '../../hooks/useProjects.ts';
import { useClients } from '../../hooks/useClients.ts';
import CustomCheckbox from '../CustomCheckbox';
import { ColorPicker } from '@/components/ui/color-picker';
import { parseOptionalNumberInput, parseOptionalPositiveNumberInput } from '@/utils/numberInputUtils.ts';

const BILLABLE_TIME_INCREMENT_OPTIONS = [
    { value: '0', label: 'Exact worked time' },
    { value: '1', label: 'Round up to 1 minute' },
    { value: '15', label: 'Round up to 15 minutes' },
    { value: '30', label: 'Round up to 30 minutes' },
    { value: '60', label: 'Round up to 60 minutes' },
];

function parseBillableTimeIncrementMinutes(value) {
    const parsedValue = Number.parseInt(value, 10);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return null;
    }

    return parsedValue;
}

function getDefaultIsPersonal(modalOptions) {
    if (modalOptions?.preselectedClientId) {
        return false;
    }

    if (typeof modalOptions?.defaultPersonalProject === 'boolean') {
        return modalOptions.defaultPersonalProject;
    }

    return true;
}

function createEmptyProjectFormData(modalOptions) {
    return {
        title: '',
        hourlyRate: '',
        flatRate: false,
        preferredClientId: '',
        overrideRate: false,
        isPersonal: getDefaultIsPersonal(modalOptions),
        color: '',
        billableTimeIncrementMinutes: '0'
    };
}

function buildProjectUpdatePayload(formData) {
    return {
        title: formData.title,
        hourlyRate: parseOptionalNumberInput(formData.hourlyRate),
        flatRate: formData.flatRate || false,
        preferredClientId: formData.isPersonal ? null : (formData.preferredClientId || null),
        isPersonal: formData.isPersonal || false,
        color: formData.color || null,
        billableTimeIncrementMinutes: formData.isPersonal || formData.flatRate
            ? null
            : parseBillableTimeIncrementMinutes(formData.billableTimeIncrementMinutes),
    };
}

function buildChangedProjectUpdates(editingProject, formData) {
    const nextProject = buildProjectUpdatePayload(formData);
    const previousProject = {
        title: editingProject.title,
        hourlyRate: editingProject.hourlyRate ?? null,
        flatRate: editingProject.flatRate || false,
        preferredClientId: editingProject.isPersonal ? null : (editingProject.preferredClientId || null),
        isPersonal: editingProject.isPersonal || false,
        color: editingProject.color || null,
    };

    return Object.fromEntries(
        Object.entries(nextProject).filter(([key, value]) => previousProject[key] !== value)
    );
}

/**
 * ProjectModal component - Modal for creating and editing projects
 */
const ProjectModal = ({
    isOpen,
    onClose,
    editingProject = null,
    modalOptions = null,
    openClientModal,
    saveFormState,
    getSavedState,
    clearSavedState
}) => {
    const [selectedClientRate, setSelectedClientRate] = useState(null);
    const lastInitKeyRef = useRef(null);
    const { showSuccess } = useToast();
    const { createProject, updateProject } = useProjects();
    const { clients } = useClients();
    const activeClients = clients.filter(client => !client.archived);
    const isClientSelectDisabled = !!modalOptions?.preselectedClientId || activeClients.length === 0;

    const [formData, setFormData] = useState(() => createEmptyProjectFormData(modalOptions));

    // Initialize form data when opening or changing context
    useEffect(() => {
        if (!isOpen) {
            lastInitKeyRef.current = null;
            return;
        }

        const initKey = editingProject?.id
            ? `edit:${editingProject.id}`
            : (modalOptions?.preselectedClientId ? `new:${modalOptions.preselectedClientId}` : 'new');

        if (lastInitKeyRef.current === initKey) {
            return;
        }

        lastInitKeyRef.current = initKey;

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
                isPersonal: editingProject.isPersonal || false,
                color: editingProject.color || '',
                billableTimeIncrementMinutes: editingProject.billableTimeIncrementMinutes
                    ? editingProject.billableTimeIncrementMinutes.toString()
                    : '0'
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
                            isPersonal: false,
                            color: '',
                            billableTimeIncrementMinutes: '0'
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
                        isPersonal: savedState.isPersonal ?? getDefaultIsPersonal(modalOptions),
                        color: savedState.color || '',
                        billableTimeIncrementMinutes: savedState.billableTimeIncrementMinutes || '0'
                    });
                    
                    // Restore client rate if needed
                    if (savedState.preferredClientId && clients.length > 0) {
                        const savedClient = clients.find(c => c.id === savedState.preferredClientId);
                        setSelectedClientRate(savedClient || null);
                    }
                } else {
                    // No saved state and no preselected client - reset form
                    setFormData(createEmptyProjectFormData(modalOptions));
                    setSelectedClientRate(null);
                }
            }
        }
    }, [isOpen, editingProject, clients, modalOptions, getSavedState]);

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
        if (!formData.isPersonal && !formData.flatRate && parseOptionalPositiveNumberInput(formData.hourlyRate) === null) {
            return; // Hourly rate is required when not using flat rate for billable projects
        }

        const createdProject = createProject({
            id: generateSlugId(formData.title),
            ...buildProjectUpdatePayload(formData),
            lastBilledAt: null,
            archived: false
        });

        // Reset form
        setFormData(createEmptyProjectFormData(modalOptions));
        setSelectedClientRate(null);

        // Clear saved state since project was successfully created
        if (clearSavedState) {
            clearSavedState();
        }

        modalOptions?.onCreate?.(createdProject);
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
        if (!formData.isPersonal && !formData.flatRate && parseOptionalPositiveNumberInput(formData.hourlyRate) === null) {
            return; // Hourly rate is required when not using flat rate for billable projects
        }

        const changedUpdates = buildChangedProjectUpdates(editingProject, formData);

        if (Object.keys(changedUpdates).length > 0) {
            updateProject(editingProject.id, changedUpdates);
        }

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
        setFormData(createEmptyProjectFormData(modalOptions));
        setSelectedClientRate(null);
        onClose();
    };

    // Footer content with action buttons
    const footer = (
        <div className="flex flex-row flex-wrap justify-end gap-2">
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
                        Project Title <span className="text-destructive-strong">*</span>
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
                                {formData.isPersonal
                                    ? 'Uncheck this for projects with clients or invoices.'
                                    : 'Check this for projects without clients or invoices.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Client Selection - Only show for non-personal projects */}
                {!formData.isPersonal && (
                    <div>
                        <InlineFieldHeader
                            action={openClientModal && !modalOptions?.preselectedClientId ? (
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
                            ) : null}
                        >
                            <Label htmlFor="preferredClientId">
                                Client <span className="text-destructive-strong">*</span>
                            </Label>
                        </InlineFieldHeader>
                        <Select
                            value={formData.preferredClientId}
                            onValueChange={(value) => {
                                handleInputChange({ target: { name: 'preferredClientId', value } });
                            }}
                            disabled={isClientSelectDisabled}
                        >
                            <SelectTrigger
                                id="preferredClientId"
                                className={isClientSelectDisabled ? 'bg-muted opacity-50' : ''}
                            >
                                <SelectValue placeholder="Select a client" />
                            </SelectTrigger>
                            <SelectContent>
                                {activeClients.map(client => (
                                    <SelectItem key={client.id} value={client.id}>
                                        {client.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {!modalOptions?.preselectedClientId && (
                            <p className="text-xs text-muted-foreground mt-2">
                                {activeClients.length === 0
                                    ? 'Create a client to associate with this project.'
                                    : 'Billable projects must be associated with a client.'}
                            </p>
                        )}
                    </div>
                )}

                {/* Rate Information from Client */}
                {selectedClientRate && !formData.overrideRate && !formData.isPersonal && (
                    <Notice
                        title="Rate from Client"
                        description={
                            selectedClientRate.flatRate
                                ? "This client uses flat rate pricing (non-hourly basis)"
                                : selectedClientRate.hourlyRate
                                    ? <span className="sensitive-data">Hourly Rate: {selectedClientRate.hourlyRate}/hour</span>
                                    : "No default rate set for this client"
                        }
                    />
                )}

                {/* Override Rate Checkbox */}
                {selectedClientRate && !formData.isPersonal && (
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
                {formData.overrideRate && !formData.isPersonal && (
                    <div className="border border-border rounded-lg p-4 bg-card">
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
                                Hourly Rate {!formData.flatRate && <span className="text-destructive-strong">*</span>}
                            </Label>

                            <Input
                                type="number"
                                id="hourlyRate"
                                name="hourlyRate"
                                value={formData.hourlyRate}
                                onChange={handleInputChange}
                                min="0"
                                step="0.01"
                                className="mt-1 sensitive-data"
                                placeholder="0.00"
                                required={!formData.flatRate && formData.overrideRate}
                            />
                        </div>
                    </div>
                )}

                {!formData.isPersonal && !formData.flatRate && (
                    <div className="border border-border rounded-lg p-4 bg-card space-y-3">
                        <h4 className="text-sm font-medium text-foreground">Billing & Timer Rules</h4>
                        <div>
                            <Label htmlFor="billableTimeIncrementMinutes">
                                Minimum billed time increment
                            </Label>
                            <Select
                                value={formData.billableTimeIncrementMinutes}
                                onValueChange={(value) => setFormData(prev => ({
                                    ...prev,
                                    billableTimeIncrementMinutes: value,
                                }))}
                            >
                                <SelectTrigger id="billableTimeIncrementMinutes" className="mt-1">
                                    <SelectValue placeholder="Select minimum billed time increment" />
                                </SelectTrigger>
                                <SelectContent>
                                    {BILLABLE_TIME_INCREMENT_OPTIONS.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-2">
                                Applies when stopping timers for this project. Time entries keep the actual worked timestamps, while billing and invoices use the rounded project minimum.
                            </p>
                        </div>
                    </div>
                )}

                <div>
                    <Label>
                        Color Tag
                    </Label>
                    <ColorPicker
                        value={formData.color}
                        onChange={(color) => setFormData(prev => ({ ...prev, color }))}
                        className="mt-1"
                    />
                </div>
            </form>
        </Modal>
    );
};

ProjectModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    editingProject: PropTypes.object,
    modalOptions: PropTypes.object,
    openClientModal: PropTypes.func,
    saveFormState: PropTypes.func,
    getSavedState: PropTypes.func,
    clearSavedState: PropTypes.func
};

export default ProjectModal;