import { useEffect, useState, useMemo } from 'react';
import { CreditCardIcon, BuildingOfficeIcon, DocumentTextIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { useUrlState } from '../hooks/useUrlState';
import { useToast } from '../hooks/useToast';
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
    setProjects,
    tasks,
    setTasks,
    timeEntries,
    currentTimer,
    isPaused,
    invoices,
    setInvoices,
    paymentMethods,
    setPaymentMethods,
    businessInfos,
    setBusinessInfos,
    clients,
    invoiceTemplates,
    setInvoiceTemplates,
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
    openProjectModal
}) => {
    const { urlParams } = useUrlState();
    const { showError } = useToast();
    
    // State for the invoice modal
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    
    // Handle creating a new invoice with timer check
    const handleCreateNewInvoice = () => {
        // Check if a timer is currently active (running, not paused)
        if (currentTimer && !isPaused) {
            showError('Cannot generate an invoice while a timer is active. Please pause the timer first.');
            return;
        }
        
        setShowInvoiceModal(true);
    };

    // Handle editing an invoice with timer check
    const handleEditInvoice = (invoice) => {
        // Check if a timer is currently active (running, not paused)
        if (currentTimer && !isPaused) {
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
            name: 'All Invoices',
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
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Manage invoices and related settings</p>
                </div>
                
                {/* New Invoice Button */}
                <button
                    onClick={handleCreateNewInvoice}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                >
                    <DocumentTextIcon className="h-5 w-5 mr-2" />
                    New Invoice
                </button>
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
                {activeTab === 'invoices' && (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-foreground">
                                All Invoices {invoices.length > 0 && (
                                    <span>
                                        ({invoices.length})
                                    </span>
                                )}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                View and manage all your invoices from all projects.
                            </p>
                        </div>
                        <InvoicesList
                            projectInvoices={invoices}
                            onEditInvoice={handleEditInvoice}
                            paymentMethods={paymentMethods}
                            businessInfos={businessInfos}
                            clients={clients}
                            setInvoices={setInvoices}
                            invoiceTemplates={invoiceTemplates}
                            selectedTab={urlParams.tab} // Pass the tab from URL
                        />
                    </div>
                )}
                
                {activeTab === 'templates' && (
                    <InvoiceTemplates 
                        invoiceTemplates={invoiceTemplates} 
                        setInvoiceTemplates={setInvoiceTemplates}
                        autoOpenCreate={urlParams.create === 'template'}
                        openTemplateModal={openTemplateModal}
                        editTemplateModal={editTemplateModal}
                    />
                )}
                
                {activeTab === 'payment-methods' && (
                    <PaymentMethods 
                        paymentMethods={paymentMethods} 
                        setPaymentMethods={setPaymentMethods}
                        autoOpenCreate={urlParams.create === 'payment-method'}
                        openPaymentMethodModal={openPaymentMethodModal}
                        editPaymentMethodModal={editPaymentMethodModal}
                    />
                )}
                
                {activeTab === 'business-info' && (
                    <BusinessInfo 
                        businessInfos={businessInfos} 
                        setBusinessInfos={setBusinessInfos}
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
                    projects={projects}
                    setProjects={setProjects}
                    tasks={tasks}
                    setTasks={setTasks}
                    timeEntries={timeEntries}
                    currentTimer={currentTimer}
                    isPaused={isPaused}
                    editingInvoice={editingInvoice}
                    paymentMethods={paymentMethods}
                    onNavigateToPaymentMethods={() => {
                        setShowInvoiceModal(false);
                        updateUrl({ section: 'payment-methods', create: 'payment-method' });
                    }}
                    businessInfos={businessInfos}
                    onNavigateToBusinessInfo={() => {
                        setShowInvoiceModal(false);
                        updateUrl({ section: 'business-info', create: 'business-info' });
                    }}
                    clients={clients}
                    onNavigateToClients={() => {
                        setShowInvoiceModal(false);
                        navigateToClients({ create: 'client' });
                    }}
                    onNavigateToProjects={() => {
                        setShowInvoiceModal(false);
                        // Use the navigateToProjects function that's passed as a prop
                        // and pass the create parameter to open the project form
                        navigateToProjects({ create: 'project' });
                    }}
                    invoices={invoices}
                    setInvoices={setInvoices}
                    invoiceTemplates={invoiceTemplates}
                    setInvoiceTemplates={setInvoiceTemplates}
                    onNavigateToTemplates={() => {
                        setShowInvoiceModal(false);
                        updateUrl({ section: 'templates', create: 'template' });
                    }}
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
