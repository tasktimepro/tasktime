import { useEffect, useState } from 'react';
import { CreditCardIcon, BuildingOfficeIcon, UserGroupIcon, DocumentTextIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { useUrlState } from '../hooks/useUrlState';
import { useToast } from '../hooks/useToast';
import PaymentMethods from './PaymentMethods';
import BusinessInfo from './BusinessInfo';
import ClientInfo from './ClientInfo';
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
    clientInfos,
    setClientInfos,
    invoiceTemplates,
    setInvoiceTemplates,
    navigateToProjects
}) => {
    const { urlParams, updateUrl } = useUrlState();
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
    const sideNavItems = [
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
            name: 'Your Business Info',
            icon: BuildingOfficeIcon,
            description: 'Manage business information for invoices'
        },
        {
            id: 'client-info',
            name: 'Client Info',
            icon: UserGroupIcon,
            description: 'Manage client information for invoices'
        }
    ];
    
    // Get current section from URL or default to first section
    const activeTab = urlParams.section || sideNavItems[0].id;
    
    // Check URL parameters for auto-opening create forms
    const autoOpenCreate = urlParams.create === 'template' || urlParams.create === 'payment-method' || urlParams.create === 'business-info' || urlParams.create === 'client-info';

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

    const renderContent = () => {
        switch (activeTab) {
            case 'invoices':
                return (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">
                                All Invoices {invoices.length > 0 && (
                                    <span>
                                        ({invoices.length})
                                    </span>
                                )}
                            </h2>
                            <p className="mt-1 text-sm text-gray-600">
                                View and manage all your invoices from all projects.
                            </p>
                        </div>
                        <InvoicesList
                            projectInvoices={invoices}
                            onEditInvoice={handleEditInvoice}
                            paymentMethods={paymentMethods}
                            businessInfos={businessInfos}
                            clientInfos={clientInfos}
                            setInvoices={setInvoices}
                            invoiceTemplates={invoiceTemplates}
                            selectedTab={urlParams.tab} // Pass the tab from URL
                        />
                    </div>
                );
            case 'templates':
                return (
                    <InvoiceTemplates 
                        invoiceTemplates={invoiceTemplates} 
                        setInvoiceTemplates={setInvoiceTemplates}
                        autoOpenCreate={urlParams.create === 'template'}
                    />
                );
            case 'payment-methods':
                return (
                    <PaymentMethods 
                        paymentMethods={paymentMethods} 
                        setPaymentMethods={setPaymentMethods}
                        autoOpenCreate={urlParams.create === 'payment-method'}
                    />
                );
            case 'business-info':
                return (
                    <BusinessInfo 
                        businessInfos={businessInfos} 
                        setBusinessInfos={setBusinessInfos}
                        autoOpenCreate={urlParams.create === 'business-info'}
                    />
                );
            case 'client-info':
                return (
                    <ClientInfo 
                        clientInfos={clientInfos} 
                        setClientInfos={setClientInfos}
                        autoOpenCreate={urlParams.create === 'client-info'}
                    />
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
                    <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
                    <p className="mt-1 text-sm text-gray-600">Manage invoices and related settings</p>
                    
                    {/* New Invoice Button */}
                    <button
                        onClick={handleCreateNewInvoice}
                        className="mt-4 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        <DocumentTextIcon className="h-5 w-5 mr-2" />
                        New Invoice
                    </button>
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
                    clientInfos={clientInfos}
                    onNavigateToClientInfo={() => {
                        setShowInvoiceModal(false);
                        updateUrl({ section: 'client-info', create: 'client-info' });
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
                />
            )}
        </div>
    );
};

export default Invoices;
