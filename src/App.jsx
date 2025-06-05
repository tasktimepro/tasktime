import { useEffect } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useUrlState } from './hooks/useUrlState';
import ProjectList from './components/ProjectList';
import ProjectDashboard from './components/ProjectDashboard';
import Account from './components/Account';
import { ToastProvider } from './components/ToastContainer';

/**
 * Main App component - Entry point for the Task. Time. Track.
 */
function App() {
    console.log('✅ App component is rendering successfully');
    
    // localStorage state management
    const [projects, setProjects] = useLocalStorage('projects', []);
    const [tasks, setTasks] = useLocalStorage('tasks', []);
    const [timeEntries, setTimeEntries] = useLocalStorage('timeEntries', []);
    const [currentTimer, setCurrentTimer] = useLocalStorage('currentTimer', null);
    const [paymentMethods, setPaymentMethods] = useLocalStorage('paymentMethods', []);
    const [businessInfos, setBusinessInfos] = useLocalStorage('businessInfos', []);
    const [clientInfos, setClientInfos] = useLocalStorage('clientInfos', []);
    const [invoices, setInvoices] = useLocalStorage('invoices', []);

    console.log('📊 Loaded projects:', projects.length);

    // URL-based state management
    const { urlParams, navigateToProjects, navigateToProject, navigateToAccount } = useUrlState();
    
    // Derived state from URL parameters
    const activeView = urlParams.view;
    const selectedProject = urlParams.projectId 
        ? projects.find(p => p.id === urlParams.projectId) 
        : null;

    // Handle case where project in URL doesn't exist (e.g., deleted project)
    useEffect(() => {
        if (urlParams.projectId && urlParams.view === 'dashboard' && !selectedProject) {
            console.warn('Project not found, redirecting to projects view');
            navigateToProjects();
        }
    }, [urlParams.projectId, urlParams.view, selectedProject, navigateToProjects]);

    /**
     * Handle navigation to payment methods creation from invoice generator
     */
    const handleNavigateToPaymentMethods = () => {
        navigateToAccount({ section: 'payment-methods', create: 'payment-method' });
    };

    /**
     * Handle navigation to business info creation from invoice generator
     */
    const handleNavigateToBusinessInfo = () => {
        navigateToAccount({ section: 'business-info', create: 'business-info' });
    };

    /**
     * Handle navigation to client info creation from invoice generator
     */
    const handleNavigateToClientInfo = () => {
        navigateToAccount({ section: 'client-info', create: 'client-info' });
    };

    /**
     * Handle data import from ExportImport component
     */
    const handleImport = (importData) => {
        // Migrate tasks to include new fields if needed
        const migratedTasks = (importData.tasks || []).map(task => ({
            ...task,
            completed: task.completed || false,
            archived: task.archived || false
        }));

        // Extract invoices from projects and migrate to separate storage
        const allInvoices = importData.invoices || [];
        const migratedProjects = (importData.projects || []).map(project => {
            const projectInvoices = project.invoices || [];
            
            // Add project invoices to the global invoices array
            allInvoices.push(...projectInvoices);
            
            // Store only invoice IDs in the project
            return {
                ...project,
                invoiceIds: projectInvoices.map(invoice => invoice.id)
            };
        });

        setProjects(migratedProjects);
        setTasks(migratedTasks);
        setInvoices(allInvoices);
        setTimeEntries(importData.timeEntries || []); // Import time entries if provided
        setCurrentTimer(null); // Clear any active timer
    };

    console.log('🔍 App - clientInfos:', clientInfos);

    return (
        <ToastProvider>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <h1 className="text-2xl font-bold text-gray-900">
                            Task. Time. Track.
                        </h1>
                        
                        <div className="flex space-x-4">
                            <button
                                onClick={() => navigateToProjects()}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    activeView === 'projects'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Projects
                            </button>
                            <button
                                onClick={() => navigateToAccount()}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    activeView === 'account'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Account
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeView === 'projects' && !selectedProject && (
                    <ProjectList
                        projects={projects}
                        setProjects={setProjects}
                        tasks={tasks}
                        setTasks={setTasks}
                        timeEntries={timeEntries}
                        setTimeEntries={setTimeEntries}
                        currentTimer={currentTimer}
                        setCurrentTimer={setCurrentTimer}
                        onSelectProject={(project) => {
                            navigateToProject(project.id);
                        }}
                    />
                )}

                {activeView === 'dashboard' && selectedProject && (
                    <ProjectDashboard
                        project={selectedProject}
                        projects={projects}
                        setProjects={setProjects}
                        tasks={tasks}
                        setTasks={setTasks}
                        timeEntries={timeEntries}
                        setTimeEntries={setTimeEntries}
                        currentTimer={currentTimer}
                        setCurrentTimer={setCurrentTimer}
                        onBackToProjects={navigateToProjects}
                        paymentMethods={paymentMethods}
                        onNavigateToPaymentMethods={handleNavigateToPaymentMethods}
                        businessInfos={businessInfos}
                        onNavigateToBusinessInfo={handleNavigateToBusinessInfo}
                        clientInfos={clientInfos}
                        onNavigateToClientInfo={handleNavigateToClientInfo}
                        invoices={invoices}
                        setInvoices={setInvoices}
                    />
                )}

                {activeView === 'account' && (
                    <Account
                        projects={projects}
                        tasks={tasks}
                        timeEntries={timeEntries}
                        invoices={invoices}
                        onImport={handleImport}
                        paymentMethods={paymentMethods}
                        setPaymentMethods={setPaymentMethods}
                        businessInfos={businessInfos}
                        setBusinessInfos={setBusinessInfos}
                        clientInfos={clientInfos}
                        setClientInfos={setClientInfos}
                    />
                )}
            </main>
        </div>
        </ToastProvider>
    );
}

export default App;
