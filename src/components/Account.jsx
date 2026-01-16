import { useEffect, useMemo, useState } from 'react';
import { ArrowDownTrayIcon, CogIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useUrlState } from '../hooks/useUrlState';
import ExportImport from './ExportImport';
import Preferences from './Preferences';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Notice } from '@/components/ui/notice';
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
    clients,
    invoiceTemplates,
    preferences,
    currentTimer,
    onImport,
    setProjects,
    setTasks,
    setTimeEntries,
    setInvoices,
    setPaymentMethods,
    setBusinessInfos,
    setClients,
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
        setClients([]);
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
                            <h2 className="text-2xl font-bold text-foreground">Backup & Restore</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
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
                            clients={clients}
                            invoiceTemplates={invoiceTemplates}
                            preferences={preferences}
                            currentTimer={currentTimer}
                            onImport={onImport}
                        />
                    </div>
                );
            case 'data':
                return (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-foreground">Your Data</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Manage your account data and permanently delete information.
                            </p>
                        </div>
                        
                        <div className="space-y-6">
                            {/* Delete All Account Data */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Delete All Account Data</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Notice
                                        title="Danger Zone"
                                        description="This action will permanently delete all your data including projects, tasks, time entries, invoices, invoice configurations, and settings. This action cannot be undone."
                                        icon={TrashIcon}
                                        className="mb-4"
                                    />
                                    
                                    <Button
                                        variant="destructive"
                                        onClick={() => setShowDeleteModal(true)}
                                        leadingIcon={TrashIcon}
                                    >
                                        Delete All Account Data
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Temporary Delete All Projects & Related Data - Uncommented for demonstration */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Delete All Projects & Related Data</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Notice
                                        title="Temporary Feature"
                                        description="This will delete all projects, tasks, time entries, and invoices. Business info, clients, templates, and payment methods will remain intact."
                                        icon={TrashIcon}
                                        className="mb-4"
                                    />
                                    
                                    <Button
                                        variant="destructive"
                                        onClick={() => _setShowDeleteProjectsModal(true)}
                                        leadingIcon={TrashIcon}
                                    >
                                        Delete All Projects & Related Data
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Temporary Delete All Invoices - Uncommented for demonstration */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Delete All Invoices</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Notice
                                        title="Temporary Feature"
                                        description="This will delete all invoices from your account. Projects and other data will remain intact."
                                        icon={TrashIcon}
                                        className="mb-4"
                                    />
                                    
                                    <Button
                                        variant="destructive"
                                        onClick={() => _setShowDeleteInvoicesModal(true)}
                                        leadingIcon={TrashIcon}
                                    >
                                        Delete All Invoices
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">Account</h1>
                <p className="mt-1 text-sm text-muted-foreground">Manage your account settings</p>
            </div>

            {/* Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={handleSectionChange}>
                <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-b border-border rounded-none">
                    {sideNavItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <TabsTrigger
                                key={item.id}
                                value={item.id}
                                className="flex items-center py-2 px-1 mr-8 border-b-2 border-transparent rounded-none bg-transparent font-medium text-sm whitespace-nowrap transition-colors data-[state=active]:bg-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none text-muted-foreground hover:text-foreground hover:border-border"
                            >
                                <Icon className="h-4 w-4 mr-2" />
                                {item.name}
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
            </Tabs>

            {/* Content */}
            <div>
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
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setShowDeleteModal(false);
                                setDeleteConfirmationText('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteAllData}
                            disabled={deleteConfirmationText !== 'Delete'}
                        >
                            Delete All Data
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <Notice
                        title="This action cannot be undone"
                        icon={TrashIcon}
                    >
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
                    </Notice>

                    <div className="space-y-2">
                        <Label htmlFor="confirmDelete">
                            Type <strong>"Delete"</strong> to confirm:
                        </Label>
                        <Input
                            id="confirmDelete"
                            type="text"
                            value={deleteConfirmationText}
                            onChange={(e) => setDeleteConfirmationText(e.target.value)}
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
                        <Button
                            variant="secondary"
                            onClick={() => _setShowDeleteProjectsModal(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={_handleDeleteAllProjects}
                        >
                            Delete All Projects & Related Data
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to delete all projects, tasks, time entries, and invoices? This action cannot be undone.
                    </p>
                    <Notice title="What will be deleted" showIcon={false}>
                        <p>
                            All projects ({projects.length}), all tasks ({tasks.length}), all time entries ({timeEntries.length}), and all invoices ({invoices.length}).
                        </p>
                        <p className="mt-1 text-muted-foreground">
                            <strong>What will remain:</strong> Business info, clients, invoice templates, and payment methods.
                        </p>
                    </Notice>
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
                        <Button
                            variant="secondary"
                            onClick={() => _setShowDeleteInvoicesModal(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={_handleDeleteAllInvoices}
                        >
                            Delete All Invoices
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-foreground">
                        Are you sure you want to delete all {invoices.length} invoices? This action cannot be undone.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default Account;
