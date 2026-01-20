import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { ExclamationTriangleIcon } from '@/components/ui/icons';

const collections = [
    { key: 'projects', label: 'Projects' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'timeEntries', label: 'Time Entries' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'clients', label: 'Clients' },
    { key: 'businessInfos', label: 'Business Info' },
    { key: 'invoiceTemplates', label: 'Templates' },
    { key: 'paymentMethods', label: 'Payment Methods' },
];

const getCount = (data, key) => Array.isArray(data?.[key]) ? data[key].length : 0;

const ConflictModal = ({
    isOpen,
    localData,
    remoteData,
    onResolve
}) => {

    const footer = (
        <div className="flex flex-col gap-2 w-full">
            <Button
                className="w-full"
                onClick={() => onResolve('merge')}
            >
                Auto Merge (Recommended)
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => onResolve('local')}
                >
                    Keep Local
                </Button>
                <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => onResolve('remote')}
                >
                    Use Drive
                </Button>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => undefined}
            title="Sync conflict detected"
            description="Changes were made on this device and another device."
            showCloseButton={false}
            footer={footer}
            size="md"
        >
            <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-900/20 dark:text-yellow-100">
                    <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
                    <div>
                        <div className="font-medium">Two versions found</div>
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            We detected changes from another device. You can keep your local changes, use the Drive version, or let TaskTime merge updates.
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-md border border-border/60 p-4">
                        <div className="text-sm font-semibold text-foreground">Local version</div>
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {collections.map((item) => (
                                <li key={`local-${item.key}`}>{item.label}: {getCount(localData, item.key)}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-md border border-border/60 p-4">
                        <div className="text-sm font-semibold text-foreground">Drive version</div>
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {collections.map((item) => (
                                <li key={`remote-${item.key}`}>{item.label}: {getCount(remoteData, item.key)}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ConflictModal;
