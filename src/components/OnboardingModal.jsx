import { useState, useEffect } from 'react';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    ClockIcon,
    DocumentTextIcon,
    ChartBarIcon,
    CheckIcon,
    RocketLaunchIcon,
    PlusIcon,
    CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateId } from '../utils/idUtils';
import { useToast } from '../hooks/useToast';
import { DEFAULT_CURRENCY, getPreferredCurrency, getCurrencyOptions } from '../utils/currencyUtils';

/**
 * OnboardingModal component - Guides new users through the application
 */
const OnboardingModal = ({
    isOpen,
    onComplete,
    onCreateProject,
    onCreateTask
}) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [projectFormData, setProjectFormData] = useState({
        title: '',
        hourlyRate: '',
        currency: getPreferredCurrency()
    });
    const [taskFormData, setTaskFormData] = useState({
        title: ''
    });
    const [createdProjectId, setCreatedProjectId] = useState(null);
    const { showSuccess } = useToast();

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentSlide(0);
            setProjectFormData({ title: '', hourlyRate: '', currency: getPreferredCurrency() });
            setTaskFormData({ title: '' });
            setCreatedProjectId(null);
        }
    }, [isOpen]);

    const slides = [
        {
            id: 'welcome',
            title: '👋 Welcome to TaskTime!',
            content: (
                <div className="text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="bg-muted p-4 rounded-full">
                            <ClockIcon className="h-12 w-12 text-foreground" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-foreground">
                            Your freelance flow simplified
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            TaskTime helps you track time by task and create professional invoices without the mess. 
                            Perfect for freelancers, consultants, and small business owners who want to:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            <div className="flex items-start space-x-3 text-left">
                                <ClockIcon className="h-5 w-5 text-foreground mt-1 flex-shrink-0" />
                                <div>
                                    <div className="font-medium text-foreground">Track time precisely</div>
                                    <div className="text-sm text-muted-foreground">Start/stop timers for tasks</div>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3 text-left">
                                <DocumentTextIcon className="h-5 w-5 text-foreground mt-1 flex-shrink-0" />
                                <div>
                                    <div className="font-medium text-foreground">Generate invoices</div>
                                    <div className="text-sm text-muted-foreground">Professional PDFs instantly</div>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3 text-left">
                                <ChartBarIcon className="h-5 w-5 text-foreground mt-1 flex-shrink-0" />
                                <div>
                                    <div className="font-medium text-foreground">Monitor progress</div>
                                    <div className="text-sm text-muted-foreground">Detailed reports & metrics</div>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3 text-left">
                                <CurrencyDollarIcon className="h-5 w-5 text-foreground mt-1 flex-shrink-0" />
                                <div>
                                    <div className="font-medium text-foreground">Get paid faster</div>
                                    <div className="text-sm text-muted-foreground">Streamlined billing process</div>
                                </div>
                            </div>
                        </div>
                        <p className="text-foreground font-medium mt-6">
                            Let's get you set up in just a few steps!
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'create-project',
            title: '🎯 Create Your First Project',
            content: (
                <div className="space-y-6">
                    <div className="text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="bg-muted p-3 rounded-full">
                                <PlusIcon className="h-8 w-8 text-foreground" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                Projects help organize your work
                            </h3>
                            <p className="text-muted-foreground">
                                Create a project for each client or type of work. Set your rate and start tracking time!
                            </p>
                        </div>
                    </div>
                    
                    <div className="max-w-md mx-auto space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="project-name">Project Name *</Label>
                            <Input
                                id="project-name"
                                type="text"
                                value={projectFormData.title}
                                onChange={(e) => setProjectFormData({ ...projectFormData, title: e.target.value })}
                                placeholder="e.g., Website Design for Acme Corp"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="hourly-rate">Hourly Rate</Label>
                                <Input
                                    id="hourly-rate"
                                    type="number"
                                    value={projectFormData.hourlyRate}
                                    onChange={(e) => setProjectFormData({ ...projectFormData, hourlyRate: e.target.value })}
                                    placeholder="75"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="currency">Currency</Label>
                                <select
                                    id="currency"
                                    value={projectFormData.currency}
                                    onChange={(e) => setProjectFormData({ ...projectFormData, currency: e.target.value })}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {getCurrencyOptions().map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                            💡 Don't worry, you can always change these later or add more projects
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'create-task',
            title: '📝 Add Your First Task',
            content: (
                <div className="space-y-6">
                    <div className="text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="bg-muted p-3 rounded-full">
                                <CheckIcon className="h-8 w-8 text-foreground" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                Tasks break down your work
                            </h3>
                            <p className="text-muted-foreground">
                                Add specific tasks within your project. Each task can have its own timer for precise tracking.
                            </p>
                        </div>
                    </div>
                    
                    <div className="max-w-md mx-auto space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-name">Task Name *</Label>
                            <Input
                                id="task-name"
                                type="text"
                                value={taskFormData.title}
                                onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                                placeholder="e.g., Create homepage mockup"
                            />
                        </div>
                        
                        <div className="bg-muted border border-border rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                                <ClockIcon className="h-5 w-5 text-foreground mt-0.5 flex-shrink-0" />
                                <div className="text-sm">
                                    <div className="font-medium text-blue-900 mb-1">Pro Tip:</div>
                                    <div className="text-muted-foreground">
                                        Keep task names specific and actionable. You can create subtasks and organize them later!
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'invoices',
            title: '💰 About Invoices',
            content: (
                <div className="space-y-6">
                    <div className="text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="bg-muted p-3 rounded-full">
                                <DocumentTextIcon className="h-8 w-8 text-foreground" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                Professional invoicing made simple
                            </h3>
                            <p className="text-muted-foreground">
                                When you're ready to bill, TaskTime makes it easy to create professional invoices.
                            </p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h4 className="font-medium text-foreground">How it works:</h4>
                            <div className="space-y-3">
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-muted text-foreground rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                                    <div className="text-sm text-muted-foreground">Track time on your tasks</div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-muted text-foreground rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                                    <div className="text-sm text-muted-foreground">Select tasks to include in invoice</div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-muted text-foreground rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                                    <div className="text-sm text-muted-foreground">Generate professional PDF invoice</div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-muted text-foreground rounded-full flex items-center justify-center text-sm font-semibold">4</div>
                                    <div className="text-sm text-muted-foreground">Send to client and get paid!</div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <h4 className="font-medium text-foreground">Features include:</h4>
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <CheckIcon className="h-4 w-4 text-foreground" />
                                    <span className="text-sm text-muted-foreground">Customizable templates</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <CheckIcon className="h-4 w-4 text-foreground" />
                                    <span className="text-sm text-muted-foreground">Automatic calculations</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <CheckIcon className="h-4 w-4 text-foreground" />
                                    <span className="text-sm text-muted-foreground">Tax support</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <CheckIcon className="h-4 w-4 text-foreground" />
                                    <span className="text-sm text-muted-foreground">Multiple currencies</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <CheckIcon className="h-4 w-4 text-foreground" />
                                    <span className="text-sm text-muted-foreground">Payment tracking</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-muted border border-border rounded-lg p-4">
                        <div className="text-center">
                            <div className="font-medium text-green-900 mb-1">Access invoices anytime</div>
                            <div className="text-sm text-green-700">
                                Find the "Invoices" tab in the main navigation to manage all your billing
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'dashboard',
            title: '📊 Your Dashboard',
            content: (
                <div className="space-y-6">
                    <div className="text-center space-y-4">
                        <div className="flex justify-center">
                            <div className="bg-indigo-100 p-3 rounded-full">
                                <ChartBarIcon className="h-8 w-8 text-indigo-600" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                Keep track of everything
                            </h3>
                            <p className="text-muted-foreground">
                                Your dashboard gives you a bird's-eye view of your work and earnings.
                            </p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h4 className="font-medium text-foreground">Quick access to:</h4>
                            <div className="space-y-3">
                                <div className="flex items-start space-x-3">
                                    <ClockIcon className="h-5 w-5 text-foreground mt-0.5 flex-shrink-0" />
                                    <div>
                                        <div className="font-medium text-foreground">Recent Tasks</div>
                                        <div className="text-sm text-muted-foreground">Continue where you left off</div>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <ChartBarIcon className="h-5 w-5 text-foreground mt-0.5 flex-shrink-0" />
                                    <div>
                                        <div className="font-medium text-foreground">Time & Earnings</div>
                                        <div className="text-sm text-muted-foreground">This month, last month, this year</div>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <DocumentTextIcon className="h-5 w-5 text-foreground mt-0.5 flex-shrink-0" />
                                    <div>
                                        <div className="font-medium text-foreground">Invoice Status</div>
                                        <div className="text-sm text-muted-foreground">Outstanding and overdue tracking</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <h4 className="font-medium text-foreground">Smart features:</h4>
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <CheckIcon className="h-4 w-4 text-foreground" />
                                    <span className="text-sm text-muted-foreground">Global timer for any task</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <CheckIcon className="h-4 w-4 text-foreground" />
                                    <span className="text-sm text-muted-foreground">Quick task completion</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <CheckIcon className="h-4 w-4 text-foreground" />
                                    <span className="text-sm text-muted-foreground">Project navigation</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <CheckIcon className="h-4 w-4 text-foreground" />
                                    <span className="text-sm text-muted-foreground">Search and filter</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-muted border border-border rounded-lg p-4">
                        <div className="text-center">
                            <div className="font-medium text-blue-900 mb-1">🏠 Always just a click away</div>
                            <div className="text-sm text-muted-foreground">
                                Click the TaskTime logo or "Dashboard" tab to return here anytime
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'complete',
            title: '🚀 You\'re All Set!',
            content: (
                <div className="text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="bg-muted p-4 rounded-full">
                            <RocketLaunchIcon className="h-12 w-12 text-foreground" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-foreground">
                            Welcome to TaskTime!
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            You now have everything you need to start tracking time and creating professional invoices. 
                            Remember, you can always access help and settings from the Account section.
                        </p>
                        
                        <div className="bg-muted border border-border rounded-lg p-6 mt-6">
                            <h4 className="font-semibold text-foreground mb-3">Quick tips to get started:</h4>
                            <div className="text-left space-y-2">
                                <div className="flex items-center space-x-2">
                                    <span className="text-foreground">1.</span>
                                    <span className="text-sm text-foreground">Start a timer on your first task</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="text-foreground">2.</span>
                                    <span className="text-sm text-foreground">Set up your business info in Invoices → Your Business</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="text-foreground">3.</span>
                                    <span className="text-sm text-foreground">Add client information for invoicing</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="text-foreground">4.</span>
                                    <span className="text-sm text-foreground">Create your first invoice when ready</span>
                                </div>
                            </div>
                        </div>
                        
                        <p className="text-foreground font-medium">
                            Happy time tracking! 🎯
                        </p>
                    </div>
                </div>
            )
        }
    ];

    const currentSlideData = slides[currentSlide];
    const isLastSlide = currentSlide === slides.length - 1;
    const isFirstSlide = currentSlide === 0;

    const handleNext = () => {
        if (currentSlide === 1) {
            // Create project slide
            if (!projectFormData.title.trim()) {
                showSuccess('Please enter a project name to continue', 'warning');
                return;
            }
            
            // Create the project
            const newProject = {
                id: generateId(),
                title: projectFormData.title,
                hourlyRate: projectFormData.hourlyRate ? parseFloat(projectFormData.hourlyRate) : null,
                currency: projectFormData.currency,
                flatRate: false,
                archived: false,
                isPersonal: false, // Default to non-personal for onboarding
                createdAt: new Date().toISOString()
            };
            
            onCreateProject(newProject);
            setCreatedProjectId(newProject.id);
            showSuccess('Project created successfully!');
        } else if (currentSlide === 2) {
            // Create task slide
            if (!taskFormData.title.trim()) {
                showSuccess('Please enter a task name to continue', 'warning');
                return;
            }
            
            if (!createdProjectId) {
                showSuccess('Project not found. Please go back and create a project first.', 'error');
                return;
            }
            
            // Create the task
            const newTask = {
                id: generateId(),
                title: taskFormData.title,
                projectId: createdProjectId,
                completed: false,
                archived: false,
                billable: true,
                createdAt: new Date().toISOString()
            };
            
            onCreateTask(newTask);
            showSuccess('Task created successfully!');
        }
        
        if (isLastSlide) {
            onComplete();
        } else {
            setCurrentSlide(prev => prev + 1);
        }
    };

    const handlePrevious = () => {
        if (!isFirstSlide) {
            setCurrentSlide(prev => prev - 1);
        }
    };

    const handleSkip = () => {
        onComplete();
    };

    const canProceed = () => {
        if (currentSlide === 1) {
            return projectFormData.title.trim();
        }
        if (currentSlide === 2) {
            return taskFormData.title.trim();
        }
        return true;
    };

    const footer = (
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
                {/* Progress indicators */}
                <div className="flex space-x-2">
                    {slides.map((_, index) => (
                        <div
                            key={index}
                            className={`w-2 h-2 rounded-full transition-colors ${
                                index === currentSlide
                                    ? 'bg-primary'
                                    : index < currentSlide
                                    ? 'bg-muted0'
                                    : 'bg-muted'
                            }`}
                        />
                    ))}
                </div>
                <span className="text-sm text-muted-foreground">
                    {currentSlide + 1} of {slides.length}
                </span>
            </div>
            
            <div className="flex space-x-3">
                {!isFirstSlide && (
                    <Button
                        variant="secondary"
                        onClick={handlePrevious}
                        leadingIcon={ChevronLeftIcon}
                    >
                        Back
                    </Button>
                )}
                
                <Button
                    variant="ghost"
                    onClick={handleSkip}
                >
                    Skip Setup
                </Button>
                
                <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    trailingIcon={isLastSlide ? undefined : ChevronRightIcon}
                    leadingIcon={isLastSlide ? RocketLaunchIcon : undefined}
                >
                    {isLastSlide ? (
                        'Start Using TaskTime'
                    ) : (
                        currentSlide === 1 ? 'Create Project' : currentSlide === 2 ? 'Create Task' : 'Next'
                    )}
                </Button>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleSkip}
            title={currentSlideData.title}
            size="4xl"
            footer={footer}
            showCloseButton={false}
        >
            <div className="min-h-[400px]">
                {currentSlideData.content}
            </div>
        </Modal>
    );
};

export default OnboardingModal;
