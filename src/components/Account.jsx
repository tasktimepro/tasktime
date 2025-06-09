import { useEffect, useMemo, useState } from 'react';
import { ArrowDownTrayIcon, CogIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useUrlState } from '../hooks/useUrlState';
import ExportImport from './ExportImport';
import Preferences from './Preferences';
import Modal from './Modal';
import { useToast } from '../hooks/useToast';

/**
 * Account component - Main account management page with side navigation
 */
const Account = ({ 
    projects, 
    tasks, 
    timeEntries,
    invoices, 
    paymentMethods,
    businessInfos,
    clientInfos,
    invoiceTemplates,
    preferences,
    onImport,
    setProjects,
    setTasks,
    setTimeEntries,
    setInvoices,
    setPaymentMethods,
    setBusinessInfos,
    setClientInfos,
    setInvoiceTemplates,
    setPreferences,
    setCurrentTimer
}) => {
    const { urlParams, updateUrl } = useUrlState();
    const { showSuccess, showError } = useToast();
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [_showDeleteProjectsModal, _setShowDeleteProjectsModal] = useState(false);
    const [_showDeleteInvoicesModal, _setShowDeleteInvoicesModal] = useState(false);
    
    // Define sections in order (first will be default)
    const sideNavItems = useMemo(() => [
        {
            id: 'preferences',
            name: 'Preferences',
            icon: CogIcon,
            description: 'Manage your personal preferences'
        },
        {
            id: 'backup',
            name: 'Backup & Restore',
            icon: ArrowDownTrayIcon,
            description: 'Export and import your data'
        },
        {
            id: 'data',
            name: 'Your Data',
            icon: TrashIcon,
            description: 'Manage your account data'
        }
    ], []);
    
    // Get current section from URL or default to first section
    const activeTab = urlParams.section || sideNavItems[0].id;
    
    // Set default section if it's not already set
    useEffect(() => {
        if (!urlParams.section) {
            updateUrl({ section: sideNavItems[0].id });
        }
    }, [urlParams.section, updateUrl, sideNavItems]);

    // Function to handle section changes
    const handleSectionChange = (sectionId) => {
        updateUrl({ section: sectionId, create: null });
    };

    // Delete all account data function
    const handleDeleteAllData = () => {
        if (deleteConfirmationText !== 'Delete') {
            showError('Please type "Delete" to confirm');
            return;
        }

        // Clear all localStorage data
        setProjects([]);
        setTasks([]);
        setTimeEntries([]);
        setInvoices([]);
        setPaymentMethods([]);
        setBusinessInfos([]);
        setClientInfos([]);
        setInvoiceTemplates([]);
        setPreferences({});
        setCurrentTimer(null);

        // Close modal and reset state
        setShowDeleteModal(false);
        setDeleteConfirmationText('');
        
        showSuccess('All account data has been permanently deleted');
    };

    // Temporary delete all invoices function
    const _handleDeleteAllInvoices = () => {
        setInvoices([]);
        _setShowDeleteInvoicesModal(false);
        showSuccess('All invoices have been deleted');
    };

    // Temporary delete all projects & related data function
    const _handleDeleteAllProjects = () => {
        setProjects([]);
        setTasks([]);
        setTimeEntries([]);
        setInvoices([]);
        setCurrentTimer(null);
        _setShowDeleteProjectsModal(false);
        showSuccess('All projects, tasks, time entries, and invoices have been deleted');
    };
    
    const renderContent = () => {
        switch (activeTab) {
            case 'preferences':
                return <Preferences preferences={preferences} setPreferences={setPreferences} />;
            case 'backup':
                return (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Backup & Restore</h2>
                            <p className="mt-1 text-sm text-gray-600">
                                Export your data for backup purposes or import data from a previous backup.
                            </p>
                        </div>
                        <ExportImport 
                            projects={projects} 
                            tasks={tasks} 
                            timeEntries={timeEntries} 
                            invoices={invoices}
                            paymentMethods={paymentMethods}
                            businessInfos={businessInfos}
                            clientInfos={clientInfos}
                            invoiceTemplates={invoiceTemplates}
                            preferences={preferences}
                            onImport={onImport}
                        />
                    </div>
                );
            case 'data':
                return (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Your Data</h2>
                            <p className="mt-1 text-sm text-gray-600">
                                Manage your account data and permanently delete information.
                            </p>
                        </div>
                        
                        <div className="space-y-6">
                            {/* Delete All Account Data */}
                            <div className="bg-white shadow rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Delete All Account Data</h3>
                                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <TrashIcon className="h-5 w-5 text-red-400" />
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="text-sm font-medium text-red-800">
                                                Danger Zone
                                            </h3>
                                            <div className="mt-2 text-sm text-red-700">
                                                <p>
                                                    This action will permanently delete all your data including projects, tasks, 
                                                    time entries, invoices, invoice configurations, and settings. This action cannot be undone.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                    <TrashIcon className="h-4 w-4 mr-2" />
                                    Delete All Account Data
                                </button>
                            </div>

                            {/* Temporary Delete All Projects & Related Data - Uncommented for demonstration */}
                            <div className="bg-white shadow rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Delete All Projects & Related Data</h3>
                                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <TrashIcon className="h-5 w-5 text-red-400" />
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="text-sm font-medium text-red-800">
                                                Temporary Feature
                                            </h3>
                                            <div className="mt-2 text-sm text-red-700">
                                                <p>
                                                    This will delete all projects, tasks, time entries, and invoices. Business info, client info, templates, and payment methods will remain intact.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={() => _setShowDeleteProjectsModal(true)}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                    <TrashIcon className="h-4 w-4 mr-2" />
                                    Delete All Projects & Related Data
                                </button>
                            </div>

                            {/* Temporary Delete All Invoices - Uncommented for demonstration */}
                            <div className="bg-white shadow rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Delete All Invoices</h3>
                                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            <TrashIcon className="h-5 w-5 text-red-400" />
                                        </div>
                                        <div className="ml-3">
                                            <h3 className="text-sm font-medium text-red-800">
                                                Temporary Feature
                                            </h3>
                                            <div className="mt-2 text-sm text-red-700">
                                                <p>
                                                    This will delete all invoices from your account. Projects and other data will remain intact.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={() => _setShowDeleteInvoicesModal(true)}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                    <TrashIcon className="h-4 w-4 mr-2" />
                                    Delete All Invoices
                                </button>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex h-full">
            {/* Side Navigation */}
            <div className="w-64 bg-white shadow-sm border-r border-gray-200 pb-4">
                <div className="px-6 py-6">
                    <h1 className="text-2xl font-bold text-gray-900">Account</h1>
                    <p className="mt-1 text-sm text-gray-600">Manage your account settings</p>
                </div>
                
                <nav className="px-3">
                    <ul className="space-y-1">
                        {sideNavItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.id}>
                                    <button
                                        onClick={() => handleSectionChange(item.id)}
                                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                            activeTab === item.id
                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                    >
                                        <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                                        <div className="text-left">
                                            <div className="font-medium">{item.name}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 pl-8 py-6">
                {renderContent()}
            </div>

            {/* Delete All Data Confirmation Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmationText('');
                }}
                title="⚠️ Delete All Account Data"
                size="md"
                footer={
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={() => {
                                setShowDeleteModal(false);
                                setDeleteConfirmationText('');
                            }}
                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteAllData}
                            disabled={deleteConfirmationText !== 'Delete'}
                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                            Delete All Data
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <TrashIcon className="h-5 w-5 text-red-400" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">
                                    This action cannot be undone
                                </h3>
                                <div className="mt-2 text-sm text-red-700">
                                    <p>
                                        This will permanently delete all your data including:
                                    </p>
                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                        <li>All projects ({projects.length})</li>
                                        <li>All tasks ({tasks.length})</li>
                                        <li>All time entries</li>
                                        <li>All invoices ({invoices.length})</li>
                                        <li>All invoice configurations</li>
                                        <li>All settings</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="confirmDelete" className="block text-sm font-medium text-gray-700 mb-2">
                            Type <strong>"Delete"</strong> to confirm:
                        </label>
                        <input
                            id="confirmDelete"
                            type="text"
                            value={deleteConfirmationText}
                            onChange={(e) => setDeleteConfirmationText(e.target.value)}
                            className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm px-3 py-2"
                            placeholder="Type 'Delete' here"
                        />
                    </div>
                </div>
            </Modal>

            {/* Delete All Projects & Related Data Modal - Uncommented for demonstration */}
            <Modal
                isOpen={_showDeleteProjectsModal}
                onClose={() => _setShowDeleteProjectsModal(false)}
                title="Delete All Projects & Related Data"
                size="md"
                footer={
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={() => _setShowDeleteProjectsModal(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={_handleDeleteAllProjects}
                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                            Delete All Projects & Related Data
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-700">
                        Are you sure you want to delete all projects, tasks, time entries, and invoices? This action cannot be undone.
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                        <p className="text-sm text-yellow-800">
                            <strong>What will be deleted:</strong> All projects ({projects.length}), all tasks ({tasks.length}), all time entries ({timeEntries.length}), and all invoices ({invoices.length}).
                        </p>
                        <p className="text-sm text-yellow-800 mt-1">
                            <strong>What will remain:</strong> Business info, client info, invoice templates, and payment methods.
                        </p>
                    </div>
                </div>
            </Modal>

            {/* Delete All Invoices Modal - Uncommented for demonstration */}
            <Modal
                isOpen={_showDeleteInvoicesModal}
                onClose={() => _setShowDeleteInvoicesModal(false)}
                title="Delete All Invoices"
                size="md"
                footer={
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={() => _setShowDeleteInvoicesModal(false)}
                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={_handleDeleteAllInvoices}
                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                            Delete All Invoices
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-700">
                        Are you sure you want to delete all {invoices.length} invoices? This action cannot be undone.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default Account;
