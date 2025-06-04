import { useEffect } from 'react';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, CreditCardIcon, BuildingOfficeIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { useUrlState } from '../hooks/useUrlState';
import ExportImport from './ExportImport';
import PaymentMethods from './PaymentMethods';
import BusinessInfo from './BusinessInfo';
import ClientInfo from './ClientInfo';

/**
 * Account component - Main account management page with side navigation
 */
const Account = ({ 
    projects, 
    tasks, 
    timeEntries, 
    onImport,
    paymentMethods,
    setPaymentMethods,
    businessInfos,
    setBusinessInfos,
    clientInfos,
    setClientInfos
}) => {
    const { urlParams, updateUrl } = useUrlState();
    
    // Define sections in order (first will be default)
    const sideNavItems = [
        {
            id: 'backup',
            name: 'Backup & Restore',
            icon: ArrowDownTrayIcon,
            description: 'Export and import your data'
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
    const autoOpenCreate = urlParams.create === 'payment-method' || urlParams.create === 'business-info' || urlParams.create === 'client-info';

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
                            onImport={onImport} 
                        />
                    </div>
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
        </div>
    );
};

export default Account;
