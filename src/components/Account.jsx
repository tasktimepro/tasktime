import { useEffect, useMemo, useState } from 'react';
import { ArrowDownTrayIcon, CogIcon, TrashIcon, CloudIcon, SignOutIcon } from '@/components/ui/icons';
import { Mail } from 'lucide-react';
import { useUrlState } from '../hooks/useUrlState.ts';
import ExportImport from './ExportImport';
import Preferences from './Preferences';
import EmailTemplates from './EmailTemplates';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Notice } from '@/components/ui/notice';
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';
import { useToast } from '../hooks/useToast.ts';
import { useYjs } from '../contexts/YjsContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { usePreferences } from '../hooks/usePreferences.ts';
import { resetOnboardingCompleted } from '../utils/onboardingUtils.ts';
import { queuePostReloadToast } from '../utils/postReloadToast.ts';
import YjsSyncSettings from './sync/YjsSyncSettings';
import AccountFooter from './account/AccountFooter';

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
    emailTemplates,
    expenses,
    onImport,
}) => {
    const isMobileLayout = useIsMobileLayout();
    const { urlParams, updateUrl } = useUrlState();
    const { showSuccess, showError } = useToast();
    const { clearAllData, isDriveConnected, forceSyncDrive, disconnectDrive, wipeDriveData } = useYjs();
    const { signOut, revokeAccess } = useGoogleAuth();
    const { preferences, updatePreferences } = usePreferences();
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [showSignOutModal, setShowSignOutModal] = useState(false);
    
    // Define sections in order (first will be default)
    const sideNavItems = useMemo(() => [
        {
            id: 'preferences',
            name: 'Preferences',
            icon: CogIcon,
            description: 'Manage your personal preferences'
        },
        {
            id: 'email-templates',
            name: 'Email Templates',
            icon: Mail,
            description: 'Manage email templates'
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
    // Note: When connected, this also wipes Drive to avoid reintroducing old data
    const handleDeleteAllData = async () => {
        if (deleteConfirmationText.trim().toLowerCase() !== 'delete all data') {
            showError('Please type "delete all data" to confirm');
            return;
        }

        setIsDeleting(true);
        try {
            if (isDriveConnected) {
                await wipeDriveData();
                await revokeAccess();
            }

            // Clear all data via Yjs store after removing any active Drive session.
            await clearAllData();
            resetOnboardingCompleted();
            
            // Close modal and reset state
            setShowDeleteModal(false);
            setDeleteConfirmationText('');

            queuePostReloadToast({
                level: 'success',
                message: isDriveConnected
                    ? 'All data was deleted and Google Drive was disconnected'
                    : 'All data has been successfully deleted',
            });
            
            // Reload the page to reinitialize the store
            window.location.reload();
        } catch (error) {
            console.error('Failed to delete all data:', error);
            showError('Failed to delete data. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleAccountSignOut = async () => {
        setIsSigningOut(true);

        try {
            // MUST sync before deleting local data to prevent data loss
            await forceSyncDrive();
            showSuccess('Synced to Google Drive');
            
            // Now safe to disconnect and clear local data
            disconnectDrive();
            await signOut();
            await clearAllData();
            resetOnboardingCompleted();
            queuePostReloadToast({
                level: 'success',
                message: 'Signed out and local data cleared',
            });
            window.location.reload();
        } catch (error) {
            console.error('Failed to sign out:', error);
            // DO NOT delete local data if sync failed - would cause data loss
            showError('Sync failed. Please resolve sync issues before signing out.');
            setIsSigningOut(false);
        }
    };
    
    const renderContent = () => {
        switch (activeTab) {
            case 'preferences':
                return <Preferences preferences={preferences} updatePreferences={updatePreferences} />;
            case 'email-templates':
                return <EmailTemplates />;
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
                            emailTemplates={emailTemplates}
                            expenses={expenses}
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
                                <CardHeader className={cn(isMobileLayout && 'px-3 pb-2 pt-3')}>
                                    <CardTitle>Delete All Account Data</CardTitle>
                                </CardHeader>
                                <CardContent className={cn(isMobileLayout && 'px-3 pb-3 pt-0')}>
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
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className={cn('space-y-6', isMobileLayout && 'space-y-4 overflow-x-hidden')}>
            {/* Header */}
            <div className={cn('flex justify-between gap-3', isMobileLayout ? 'items-start' : 'items-center')}>
                <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-bold text-foreground">Account</h1>
                    {!isMobileLayout && (
                        <p className="mt-1 text-sm text-muted-foreground">Manage your account settings</p>
                    )}
                </div>
                {isDriveConnected && (
                    <Button
                        variant="ghost"
                        onClick={() => setShowSignOutModal(true)}
                        disabled={isSigningOut}
                        leadingIcon={SignOutIcon}
                        className="shrink-0"
                    >
                        {isSigningOut ? 'Signing out...' : 'Sign out'}
                    </Button>
                )}
            </div>

            {/* Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={handleSectionChange}>
                <TabsList className={cn(
                    'w-full bg-transparent rounded-none',
                    isMobileLayout
                        ? 'h-auto flex-wrap justify-start gap-2 border-0 p-0'
                        : 'justify-start border-b border-border p-0'
                )}>
                    {sideNavItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <TabsTrigger
                                key={item.id}
                                value={item.id}
                                className={cn(
                                    'flex items-center font-medium text-sm whitespace-nowrap transition-colors',
                                    isMobileLayout
                                        ? 'rounded-full border border-border bg-transparent px-3 py-1.5 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary data-[state=active]:shadow-none'
                                        : 'mr-8 border-b-2 border-transparent rounded-none bg-transparent px-1 py-2 text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none hover:text-foreground hover:border-border'
                                )}
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

            <AccountFooter />

            {/* Delete All Data Confirmation Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmationText('');
                }}
                title="Delete All Account Data"
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
                            leadingIcon={TrashIcon}
                            disabled={deleteConfirmationText.trim().toLowerCase() !== 'delete all data' || isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete All Data'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    {isDriveConnected && (
                        <Notice
                            title="You have an active Cloud Sync connection"
                            icon={CloudIcon}
                            variant="warning"
                        >
                            <p>
                                Deleting data without disconnecting will remove your data from the cloud backup as well.
                            </p>
                        </Notice>
                    )}
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
                        <Label htmlFor="confirmDelete" className="block">
                            Type <strong>"delete all data"</strong> to confirm:
                        </Label>
                        <Input
                            id="confirmDelete"
                            type="text"
                            value={deleteConfirmationText}
                            onChange={(e) => setDeleteConfirmationText(e.target.value)}
                            placeholder="Type 'delete all data' here"
                        />
                    </div>
                </div>
            </Modal>

            {/* Sign Out Confirmation Modal */}
            <Modal
                isOpen={showSignOutModal}
                onClose={() => !isSigningOut && setShowSignOutModal(false)}
                title="Sign out & delete local data?"
                size="md"
                footer={
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="secondary"
                            onClick={() => setShowSignOutModal(false)}
                            disabled={isSigningOut}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAccountSignOut}
                            disabled={isSigningOut}
                            leadingIcon={SignOutIcon}
                        >
                            {isSigningOut ? 'Signing out...' : 'Sync & Sign out'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        We will sync your latest changes to Google Drive before signing you out.
                        After the sync completes, all local data on this device will be removed.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default Account;
