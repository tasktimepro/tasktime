import { useEffect, useMemo, useState } from 'react';
import { ArrowDownTrayIcon, CogIcon, TrashIcon, CloudIcon } from '@/components/ui/icons';
import { useUrlState } from '../hooks/useUrlState.ts';
import ExportImport from './ExportImport';
import Preferences from './Preferences';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Notice } from '@/components/ui/notice';
import { useToast } from '../hooks/useToast.ts';
import { useYjs } from '../contexts/YjsContext';
import { usePreferences } from '../hooks/usePreferences.ts';
import YjsSyncSettings from './sync/YjsSyncSettings';

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
    onImport,
}) => {
    const { urlParams, updateUrl } = useUrlState();
    const { showSuccess, showError } = useToast();
    const { clearAllData } = useYjs();
    const { preferences, updatePreferences } = usePreferences();
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Define sections in order (first will be default)
    const sideNavItems = useMemo(() => [
        {
            id: 'preferences',
            name: 'Preferences',
            icon: CogIcon,
            description: 'Manage your personal preferences'
        },
        {
            id: 'sync',
            name: 'Cloud Sync',
            icon: CloudIcon,
            description: 'Connect Google Drive sync'
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
    const handleDeleteAllData = async () => {
        if (deleteConfirmationText !== 'Delete') {
            showError('Please type "Delete" to confirm');
            return;
        }

        setIsDeleting(true);
        try {
            // Clear all data via Yjs store
            await clearAllData();
            
            // Close modal and reset state
            setShowDeleteModal(false);
            setDeleteConfirmationText('');
            
            showSuccess('All account data has been permanently deleted');
            
            // Reload the page to reinitialize the store
            window.location.reload();
        } catch (error) {
            console.error('Failed to delete all data:', error);
            showError('Failed to delete data. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };
    
    const renderContent = () => {
        switch (activeTab) {
            case 'preferences':
                return <Preferences preferences={preferences} updatePreferences={updatePreferences} />;
            case 'sync':
                return <YjsSyncSettings />;
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
                            disabled={deleteConfirmationText !== 'Delete' || isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete All Data'}
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
        </div>
    );
};

export default Account;
