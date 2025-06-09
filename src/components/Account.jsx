import { useEffect, useMemo } from 'react';
import { ArrowDownTrayIcon, CogIcon } from '@heroicons/react/24/outline';
import { useUrlState } from '../hooks/useUrlState';
import ExportImport from './ExportImport';
import Preferences from './Preferences';

/**
 * Account component - Main account management page with side navigation
 */
const Account = ({ 
    projects, 
    tasks, 
    timeEntries,
    invoices, 
    onImport
}) => {
    const { urlParams, updateUrl } = useUrlState();
    
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
    
    const renderContent = () => {
        switch (activeTab) {
            case 'preferences':
                return <Preferences />;
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
                            onImport={onImport}
                        />
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
        </div>
    );
};

export default Account;
