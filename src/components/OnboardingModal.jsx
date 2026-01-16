import { useState, useEffect } from 'react';
import {
    ChevronLeftIcon,
    /**
     * OnboardingModal component - removed in cleanup phase.
     */
    const OnboardingModal = () => {
        return null;
    };

    export default OnboardingModal;
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
