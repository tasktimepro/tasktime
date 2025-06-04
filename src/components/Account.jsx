import { useState } from 'react';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, CreditCardIcon } from '@heroicons/react/24/outline';
import ExportImport from './ExportImport';

/**
 * Account component - Main account management page with side navigation
 */
const Account = ({ 
    projects, 
    tasks, 
    timeEntries, 
    onImport 
}) => {
    const [activeTab, setActiveTab] = useState('backup');

    const sideNavItems = [
        {
            id: 'backup',
            name: 'Backup & Restore',
            icon: ArrowDownTrayIcon,
            description: 'Export and import your data'
        },
        {
            id: 'billing',
            name: 'Billing',
            icon: CreditCardIcon,
            description: 'Manage billing and subscription'
        }
    ];

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
            case 'billing':
                return (
                    <div>
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">Billing</h2>
                            <p className="mt-1 text-sm text-gray-600">
                                Manage your billing information and subscription settings.
                            </p>
                        </div>
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <div className="text-center py-12">
                                <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400" />
                                <h3 className="mt-4 text-lg font-medium text-gray-900">Billing Management</h3>
                                <p className="mt-2 text-sm text-gray-500">
                                    Billing features will be available soon. Stay tuned for subscription plans and payment management.
                                </p>
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
            <div className="w-64 bg-white shadow-sm border-r border-gray-200">
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
                                        onClick={() => setActiveTab(item.id)}
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
