import { useEffect, useState, useMemo } from 'react';
import { CreditCardIcon, BuildingOfficeIcon, DocumentTextIcon, DocumentDuplicateIcon, PlusIcon } from '@/components/ui/icons';
import { useUrlState } from '../hooks/useUrlState.ts';
import { useToast } from '../hooks/useToast.ts';
import { useTimers } from '../hooks/useTimers.ts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PaymentMethods from './PaymentMethods';
import BusinessInfo from './BusinessInfo';
import InvoiceGenerator from './InvoiceGenerator';
import InvoicesList from './InvoicesList';
import InvoiceTemplates from './InvoiceTemplates';

/**
 * Invoices component - Main invoices management page with side navigation
 */
const Invoices = ({ 
    projects, 
    tasks,
    timeEntries,
    invoices,
    paymentMethods,
    businessInfos,
    clients,
    invoiceTemplates,
    updateUrl,
    navigateToProjects,
    navigateToClients,
    // Modal functions
    openTemplateModal,
    editTemplateModal,
    openPaymentMethodModal,
    editPaymentMethodModal,
    openBusinessModal,
    editBusinessModal,
    openClientModal,
    openProjectModal,
    activeModal,
}) => {
    const { urlParams } = useUrlState();
    const { showError } = useToast();
    const { timers } = useTimers();
    const hasRunningTimer = timers.some(timer => !timer.isPaused);
    
    // State for the invoice modal
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    
    // Handle creating a new invoice with timer check
    const handleCreateNewInvoice = () => {
        // Check if a timer is currently active (running, not paused)
        if (hasRunningTimer) {
            showError('Cannot generate an invoice while a timer is active. Please pause the timer first.');
            return;
        }
        
        setShowInvoiceModal(true);
    };

    // Handle editing an invoice with timer check
    const handleEditInvoice = (invoice) => {
        // Check if a timer is currently active (running, not paused)
        if (hasRunningTimer) {
            showError('Cannot update an invoice while a timer is active. Please pause the timer first.');
            return;
        }
        
        setEditingInvoice(invoice);
        setShowInvoiceModal(true);
    };
    
    // Define sections in order (first will be default)
    const sideNavItems = useMemo(() => [
        {
            id: 'invoices',
            name: 'Invoices',
            icon: DocumentTextIcon,
            description: 'View and manage all invoices'
        },
        {
            id: 'templates',
            name: 'Invoice Templates',
            icon: DocumentDuplicateIcon,
            description: 'Manage invoice templates and numbering'
        },
        {
            id: 'payment-methods',
            name: 'Payment Methods',
            icon: CreditCardIcon,
            description: 'Manage payment methods for invoices'
        },
        {
            id: 'business-info',
            name: 'Your Business',
            icon: BuildingOfficeIcon,
            description: 'Manage business information for invoices'
        }
    ], []);
    
    // Get current section from URL or default to first section
    const activeTab = urlParams.section || sideNavItems[0].id;
    
    // Set default section if not already set
    useEffect(() => {
        if (!urlParams.section) {
            updateUrl({ section: sideNavItems[0].id });
        }
    }, [urlParams.section, updateUrl, sideNavItems]);
    
    // Check URL parameters for auto-opening create forms
    const autoOpenCreate = urlParams.create === 'template' || urlParams.create === 'payment-method' || urlParams.create === 'business-info' || urlParams.create === 'client';

    // Function to handle section changes
    const handleSectionChange = (sectionId) => {
        updateUrl({ section: sectionId, create: null });
    };

    // Clear the create parameter after auto-opening to prevent re-opening
    useEffect(() => {
        if (autoOpenCreate) {
            // Clear the create parameter after a short delay to allow the component to process it
            const timer = setTimeout(() => {
                updateUrl({ create: null });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [autoOpenCreate, updateUrl]);

    return (
        <div className="space-y-6">
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
                {activeTab === 'invoices' && (
                    <div>
                        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">
                                    Invoices {invoices.length > 0 && (
                                        <span>
                                            ({invoices.length})
                                        </span>
                                    )}
                                </h1>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    View and manage all your invoices across your workspace.
                                </p>
                            </div>
                            <Button
                                onClick={handleCreateNewInvoice}
                                leadingIcon={PlusIcon}
                            >
                                New Invoice
                            </Button>
                        </div>
                        <InvoicesList
                            projectInvoices={invoices}
                            onEditInvoice={handleEditInvoice}
                            paymentMethods={paymentMethods}
                            businessInfos={businessInfos}
                            clients={clients}
                            invoiceTemplates={invoiceTemplates}
                            selectedTab={urlParams.tab} // Pass the tab from URL
                        />
                    </div>
                )}
                
                {activeTab === 'templates' && (
                    <InvoiceTemplates 
                        autoOpenCreate={urlParams.create === 'template'}
                        openTemplateModal={openTemplateModal}
                        editTemplateModal={editTemplateModal}
                    />
                )}
                
                {activeTab === 'payment-methods' && (
                    <PaymentMethods 
                        autoOpenCreate={urlParams.create === 'payment-method'}
                        openPaymentMethodModal={openPaymentMethodModal}
                        editPaymentMethodModal={editPaymentMethodModal}
                    />
                )}
                
                {activeTab === 'business-info' && (
                    <BusinessInfo 
                        autoOpenCreate={urlParams.create === 'business-info'}
                        openBusinessModal={openBusinessModal}
                        editBusinessModal={editBusinessModal}
                    />
                )}
            </div>
            
            {/* Invoice Generator Modal - Standalone mode */}
            {showInvoiceModal && (
                <InvoiceGenerator
                    project={null} // No project context for standalone invoices
                    timeEntries={timeEntries}
                    editingInvoice={editingInvoice}
                    paymentMethods={paymentMethods}
                    businessInfos={businessInfos}
                    clients={clients}
                    activeModal={activeModal}
                    onInvoiceSaved={() => {
                        setShowInvoiceModal(false);
                        setEditingInvoice(null);
                        // Add a small delay before allowing it to be opened again
                        setTimeout(() => {}, 100);
                    }}
                    showButton={false}
                    // Modal stacking functions
                    openClientModal={openClientModal}
                    openProjectModal={openProjectModal}
                    openBusinessModal={openBusinessModal}
                    openPaymentMethodModal={openPaymentMethodModal}
                    openTemplateModal={openTemplateModal}
                />
            )}
        </div>
    );
};

export default Invoices;
