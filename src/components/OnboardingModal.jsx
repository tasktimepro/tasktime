import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import {
    ArrowUpTrayIcon,
    CheckIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ClipboardDocumentCheckIcon,
    ClockIcon,
    TimerIcon,
    CloudCheckIcon,
    CloudUploadIcon,
    DocumentTextIcon,
    GoalIcon,
    HandCoinsIcon,
    KanbanIcon,
    LayoutDashboardIcon,
    ListTodoIcon,
    UserCircleIcon,
    UserGroupIcon,
} from '@/components/ui/icons';
import Modal from './Modal';
import LegalInlineLinks from './legal/LegalInlineLinks';
import { Layers3 as LayersIcon, RocketIcon, ShieldCheck as ShieldIcon } from 'lucide-react';

const STEPS = [
    { id: 'welcome', label: 'Welcome' },
    { id: 'sync', label: 'Sync' },
    { id: 'workflow', label: 'How it works' },
    { id: 'finish', label: 'Start' },
];

const BENEFIT_CARDS = [
    {
        icon: ShieldIcon,
        title: 'Privacy first',
        description: 'You own the data. TaskTime can never access or see your data.',
    },
    {
        icon: CloudCheckIcon,
        title: 'Local-first',
        description: 'Keep working offline. Everything saves locally right away, even without a connection.',
    },
    {
        icon: TimerIcon,
        title: 'Multi-timer support',
        description: 'Track time across multiple projects and hand off tasks to agents.',
    },
    {
        icon: KanbanIcon,
        title: 'Planner view',
        description: 'Map out work across the week and keep tasks visible before they become urgent.',
    },
    {
        icon: GoalIcon,
        title: 'Track goals & expenses',
        description: 'Track daily and weekly goals alongside expenses and recurring costs so progress stays visible.',
    },
    {
        icon: DocumentTextIcon,
        title: 'Invoices',
        description: 'Turn tracked work and costs into invoices when you are ready to bill.',
    },
];

const WORKFLOW_CARDS = [
    {
        icon: LayoutDashboardIcon,
        title: 'Dashboard',
        description: 'The dashboard gives you a quick view of what’s pending today, your recent activity, and key report metrics.',
    },
    {
        icon: ClipboardDocumentCheckIcon,
        title: 'Projects',
        description: 'Projects group work, rates, and billing setup so time and invoices stay tied to the right workstream.',
    },
    {
        icon: ListTodoIcon,
        title: 'Tasks',
        description: 'Tasks are where planning and tracking meet. Add one-off or recurring work, then run timers or log entries against it.',
    },
    {
        icon: UserGroupIcon,
        title: 'Clients',
        description: 'Clients help you organize billable work, store contact details, and keep projects and invoices connected to the right customer.',
    },
    {
        icon: HandCoinsIcon,
        title: 'Expenses',
        description: 'Track one-time and recurring costs alongside your work so they are visible before you invoice.',
    },
    {
        icon: DocumentTextIcon,
        title: 'Invoices',
        description: 'Invoices pull together tracked work, expenses, payment methods, and business details when you are ready to bill.',
    },
];

function FeatureCard({ icon, title, description }) {

    const Icon = icon;

    return (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
            <div className="mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-muted">
                <Icon className="h-5 w-5 text-foreground" />
            </div>
            <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
        </div>
    );
}

function DetailRow({ icon, title, description }) {

    const Icon = icon;

    return (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
            <div className="mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-muted">
                <Icon className="h-5 w-5 text-foreground" />
            </div>
            <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
        </div>
    );
}

/**
 * OnboardingModal component - Guided setup for first-time users.
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onComplete
 */
const OnboardingModal = ({
    isOpen,
    onComplete,
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const contentRef = useRef(null);
    const shouldResetScrollRef = useRef(false);

    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === STEPS.length - 1;
    const currentStepMeta = STEPS[currentStep];

    const goToStep = (nextStep) => {
        setCurrentStep(Math.min(Math.max(nextStep, 0), STEPS.length - 1));
    };

    const handlePrimaryAction = () => {
        if (!isLastStep) {
            shouldResetScrollRef.current = true;
            goToStep(currentStep + 1);
            return;
        }

        onComplete();
    };

    const handlePrevious = () => {
        if (!isFirstStep) {
            goToStep(currentStep - 1);
        }
    };

    const handleSkip = () => {
        onComplete();
    };

    useEffect(() => {
        if (!isOpen) {
            shouldResetScrollRef.current = false;
            return;
        }

        if (!shouldResetScrollRef.current || !contentRef.current) {
            return;
        }

        if (typeof contentRef.current.scrollTo === 'function') {
            contentRef.current.scrollTo({ top: 0, behavior: 'auto' });
        }

        contentRef.current.scrollTop = 0;
        shouldResetScrollRef.current = false;
    }, [currentStep, isOpen]);

    const primaryActionLabel = isLastStep ? 'Start Using TaskTime' : 'Next';

    const currentStepContent = (() => {
        if (currentStepMeta?.id === 'welcome') {
            return (
                <div className="space-y-6">
                    <div className="flex flex-col items-center space-y-4 text-center">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                            <ClockIcon className="h-6 w-6 text-foreground" />
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                                Welcome to TaskTime.
                            </h3>
                            <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                                TaskTime is a local-first task and time management app that helps you plan your work, track your time and expenses, and easily generate invoices.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {BENEFIT_CARDS.map((card) => (
                            <FeatureCard key={card.title} {...card} />
                        ))}
                    </div>

                    <Notice
                        title="Built for solo freelancers"
                        description="TaskTime was made for privacy-conscious solo freelancers who want something simple but complete enough for planning, tracking, expenses, and invoicing."
                    />

                    <LegalInlineLinks className="text-center" />
                </div>
            );
        }

        if (currentStepMeta?.id === 'sync') {
            return (
                <div className="space-y-6">
                    <div className="flex flex-col items-center space-y-3 text-center">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                            <CloudUploadIcon className="h-6 w-6 text-foreground" />
                        </div>
                        <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                            Sync with Google Drive
                        </h3>
                        <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                            TaskTime saves changes locally first. If you connect Google Drive, files sync in the background to your app folder so your workspace stays available across sessions and devices, while remaining private.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <DetailRow
                            icon={CloudCheckIcon}
                            title="Work keeps going offline"
                            description="No connection is required to keep tracking. Local saves happen immediately and uploads resume when you are online again."
                        />
                        <DetailRow
                            icon={ArrowUpTrayIcon}
                            title="Uploads run quietly"
                            description="Sync happens in the background and may still finish after you close and reopen the app."
                        />
                        <DetailRow
                            icon={CheckIcon}
                            title="Status stays visible"
                            description="Use the sync badge and Account > Sync to see whether you are idle, syncing, offline, or need to reconnect."
                        />
                        <DetailRow
                            icon={DocumentTextIcon}
                            title="Automatic backups"
                            description="Separate Drive backups keep up to 7 recent daily snapshots and 4 weekly Sunday backups."
                        />
                    </div>

                    <Notice
                        title="Optional by design"
                        description="Connect Drive when you want backup and multi-device continuity. Skip it if you prefer to stay fully local."
                    />
                </div>
            );
        }

        if (currentStepMeta?.id === 'workflow') {
            return (
                <div className="space-y-6">
                    <div className="flex flex-col items-center space-y-3 text-center">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                            <LayersIcon className="h-6 w-6 text-foreground" />
                        </div>
                        <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                            Working with TaskTime
                        </h3>
                        <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                            Projects, tasks, clients, and expenses work together so you can plan, track time, and bill without jumping between tools.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {WORKFLOW_CARDS.map((card) => (
                            <DetailRow key={card.title} {...card} />
                        ))}
                    </div>

                    <Notice
                        title="Start simple"
                        description="You can begin with one project and a few tasks, then add clients, expenses, and recurring work as your setup grows."
                    />
                </div>
            );
        }

        return (
            <div className="flex min-h-[16rem] flex-col items-center justify-center px-2 py-2 text-center sm:px-4">
                <div className="w-full max-w-lg space-y-2">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                        <ClockIcon className="h-6 w-6 text-foreground" />
                    </div>
                    <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                        It's TaskTime!
                    </h3>
                    <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                        Get started by creating a task, start a timer, and shape your week in the planner.
                    </p>
                    <div className="flex justify-center pt-2">
                        <Button
                            onClick={handlePrimaryAction}
                            leadingIcon={RocketIcon}
                            className="w-full sm:w-auto"
                        >
                            {primaryActionLabel}
                        </Button>
                    </div>
                </div>
            </div>
        );
    })();

    const footer = isLastStep ? null : (
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
                <span>
                    {currentStep + 1} of {STEPS.length}
                </span>
            </div>

            <div className="flex gap-2 sm:justify-end md:flex-none">
                {isFirstStep ? (
                    <Button
                        variant="secondary"
                        onClick={handleSkip}
                        className="flex-1 sm:flex-none"
                    >
                        Skip Onboarding
                    </Button>
                ) : (
                    <Button
                        variant="secondary"
                        onClick={handlePrevious}
                        leadingIcon={ChevronLeftIcon}
                        className="flex-1 sm:flex-none"
                    >
                        Back
                    </Button>
                )}

                <Button
                    onClick={handlePrimaryAction}
                    trailingIcon={ChevronRightIcon}
                    autoFocus={isFirstStep}
                    className="flex-1 sm:flex-none"
                >
                    {primaryActionLabel}
                </Button>
            </div>
        </div>
    );

    if (!currentStepMeta) {
        return null;
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleSkip}
            title="TaskTime setup"
            hideHeader
            size="4xl"
            showCloseButton={false}
            footer={footer}
            contentRef={contentRef}
        >
            <div>
                <div className={isLastStep ? 'min-h-[16rem]' : 'min-h-[22rem]'}>
                    {currentStepContent}
                </div>
            </div>
        </Modal>
    );
};

export default OnboardingModal;