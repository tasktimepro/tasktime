import { useState } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import ProjectList from './components/ProjectList';
import ProjectDashboard from './components/ProjectDashboard';

/**
 * Main App component - Entry point for the Task Time Tracker
 */
function App() {
    console.log('✅ App component is rendering successfully');
    
    // localStorage state management
    const [projects, setProjects] = useLocalStorage('projects', []);
    const [tasks, setTasks] = useLocalStorage('tasks', []);
    const [timeEntries, setTimeEntries] = useLocalStorage('timeEntries', []);
    const [currentTimer, setCurrentTimer] = useLocalStorage('currentTimer', null);

    console.log('📊 Loaded projects:', projects.length);

    // UI state
    const [selectedProject, setSelectedProject] = useState(null);
    const [activeView, setActiveView] = useState('projects'); // 'projects' | 'dashboard'

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

        // Migrate projects to include invoices if needed
        const migratedProjects = (importData.projects || []).map(project => ({
            ...project,
            invoices: project.invoices || []
        }));

        setProjects(migratedProjects);
        setTasks(migratedTasks);
        setTimeEntries([]); // Clear time entries on import
        setCurrentTimer(null); // Clear any active timer
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <h1 className="text-2xl font-bold text-gray-900">
                            Task Time Tracker
                        </h1>
                        
                        <div className="flex space-x-4">
                            <button
                                onClick={() => {
                                    setActiveView('projects');
                                    setSelectedProject(null);
                                }}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    activeView === 'projects'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Projects
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
                        onSelectProject={(project) => {
                            setSelectedProject(project);
                            setActiveView('dashboard');
                        }}
                        onImport={handleImport}
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
                        onBackToProjects={() => {
                            setSelectedProject(null);
                            setActiveView('projects');
                        }}
                    />
                )}
            </main>
        </div>
    );
}

export default App;
