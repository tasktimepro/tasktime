import { useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { generateId } from '../utils/idUtils';
import ExportImport from './ExportImport.jsx';
import { getCurrencySymbol } from '../utils/currencyUtils';

/**
 * ProjectList component - Displays and manages the list of projects
 */
const ProjectList = ({ projects, setProjects, tasks = [], onSelectProject, onImport }) => {
    const [showCreateForm, setShowCreateForm] = useState(false);

    const [editingProject, setEditingProject] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
        hourlyRate: '',
        currency: 'USD'
    });

    /**
     * Handle form input changes
     */
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    /**
     * Create a new project
     */
    const handleCreateProject = (e) => {
        e.preventDefault();

        if (!formData.title || !formData.hourlyRate) return;

        const newProject = {
            id: generateId(),
            title: formData.title,
            hourlyRate: parseFloat(formData.hourlyRate),
            currency: formData.currency,
            createdAt: Date.now(),
            lastBilledAt: null
        };

        setProjects([...projects, newProject]);

        setFormData({ title: '', hourlyRate: '', currency: 'USD' });

        setShowCreateForm(false);
    };

    /**
     * Update an existing project
     */
    const handleUpdateProject = (e) => {
        e.preventDefault();

        if (!formData.title || !formData.hourlyRate) return;

        const updatedProjects = projects.map(project =>
            project.id === editingProject.id
                ? {
                    ...project,
                    title: formData.title,
                    hourlyRate: parseFloat(formData.hourlyRate),
                    currency: formData.currency
                }
                : project
        );

        setProjects(updatedProjects);

        setEditingProject(null);

        setFormData({ title: '', hourlyRate: '', currency: 'USD' });
    };

    /**
     * Delete a project
     */
    const handleDeleteProject = (projectId) => {
        if (window.confirm('Are you sure you want to delete this project? All associated tasks and time entries will be lost.')) {
            setProjects(projects.filter(project => project.id !== projectId));
        }
    };

    /**
     * Start editing a project
     */
    const startEditing = (project) => {
        setEditingProject(project);

        setFormData({
            title: project.title,
            hourlyRate: project.hourlyRate.toString(),
            currency: project.currency
        });

        setShowCreateForm(false);
    };

    /**
     * Cancel form actions
     */
    const cancelForm = () => {
        setShowCreateForm(false);

        setEditingProject(null);

        setFormData({ title: '', hourlyRate: '', currency: 'USD' });
    };

    /**
     * Handle data import
     */
    const handleImport = (importData) => {
        if (window.confirm('This will replace all current data. Are you sure?')) {
            onImport(importData);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-gray-900">Projects</h2>

                <button
                    onClick={() => setShowCreateForm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Project
                </button>
            </div>

            {/* Create/Edit Form */}
            {(showCreateForm || editingProject) && (
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {editingProject ? 'Edit Project' : 'Create New Project'}
                    </h3>

                    <form onSubmit={editingProject ? handleUpdateProject : handleCreateProject} className="space-y-4">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                                Project Title
                            </label>

                            <input
                                type="text"
                                id="title"
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-5 py-1.5"
                                placeholder="Enter project title"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="hourlyRate" className="block text-sm font-medium text-gray-700">
                                    Hourly Rate
                                </label>

                                <input
                                    type="number"
                                    id="hourlyRate"
                                    name="hourlyRate"
                                    value={formData.hourlyRate}
                                    onChange={handleInputChange}
                                    required
                                    min="0"
                                    step="0.01"
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-5 py-1.5"
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                                    Currency
                                </label>

                                <select
                                    id="currency"
                                    name="currency"
                                    value={formData.currency}
                                    onChange={handleInputChange}
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm px-5 py-1.5"
                                >
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                    <option value="CHF">CHF</option>
                                    <option value="CAD">CAD</option>
                                    <option value="AUD">AUD</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={cancelForm}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                {editingProject ? 'Update' : 'Create'} Project
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Projects Grid */}
            {projects.length === 0 ? (
                <div className="text-center py-12">
                    <div className="mx-auto h-12 w-12 text-gray-400">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>

                    <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>

                    <p className="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>

                    <div className="mt-6">
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <PlusIcon className="h-4 w-4 mr-2" />
                            New Project
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => onSelectProject(project)}
                        >
                            <div className="p-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium text-gray-900 truncate">
                                        {project.title}
                                    </h3>

                                    <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => startEditing(project)}
                                            className="text-gray-400 hover:text-gray-600"
                                        >
                                            <PencilIcon className="h-4 w-4" />
                                        </button>

                                        <button
                                            onClick={() => handleDeleteProject(project.id)}
                                            className="text-gray-400 hover:text-red-600"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <p className="mt-2 text-sm text-gray-500">
                                    {getCurrencySymbol(project.currency)}{project.hourlyRate}/{project.currency} per hour
                                </p>

                                <p className="mt-1 text-xs text-gray-400">
                                    Created {new Date(project.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Export/Import Section */}
            <ExportImport projects={projects} tasks={tasks} onImport={handleImport} />
        </div>
    );
};

export default ProjectList;
