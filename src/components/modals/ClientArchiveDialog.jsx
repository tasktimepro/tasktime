/**
 * ClientArchiveDialog - Reusable client archive confirmation modal.
 */

import PropTypes from 'prop-types';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';

const ClientArchiveDialog = ({
    isOpen,
    onClose,
    client,
    relatedProjects,
    onArchiveWithProjects,
    onArchiveOnly,
}) => {
    if (!client) return null;

    const hasRelatedProjects = relatedProjects && relatedProjects.length > 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={hasRelatedProjects ? 'Archive Client with Related Projects?' : 'Archive client?'}
            size="md"
            footer={
                hasRelatedProjects ? (
                    <div className="flex justify-end">
                        <Button
                            onClick={onClose}
                            variant="outline"
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <div className="flex justify-end space-x-3">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button onClick={onArchiveOnly}>Archive Client</Button>
                    </div>
                )
            }
        >
            {hasRelatedProjects ? (
                <div>
                    <p className="text-sm text-foreground mb-4">
                        The client "<span className="font-semibold">{client.title}</span>" has {relatedProjects.length} related project(s):
                    </p>
                    <ul className="text-sm text-muted-foreground mb-4 list-disc list-inside">
                        {relatedProjects.slice(0, 5).map(project => (
                            <li key={project.id}>{project.title}</li>
                        ))}
                        {relatedProjects.length > 5 && (
                            <li>...and {relatedProjects.length - 5} more</li>
                        )}
                    </ul>

                    <p className="text-sm text-foreground mb-6">
                        Would you like to archive the related projects as well?
                    </p>

                    <div className="flex flex-col space-y-3">
                        <Button
                            onClick={onArchiveWithProjects}
                            className="w-full"
                        >
                            Archive Client & Projects
                        </Button>

                        <Button
                            onClick={onArchiveOnly}
                            variant="outline"
                            className="w-full border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 focus:ring-ring dark:border-blue-700 dark:text-blue-300 dark:bg-blue-950 dark:hover:bg-blue-900"
                        >
                            Archive Client Only
                        </Button>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-foreground">
                    Are you sure you want to archive the client "<span className="font-semibold">{client.title}</span>"?
                </p>
            )}
        </Modal>
    );
};

ClientArchiveDialog.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    client: PropTypes.object,
    relatedProjects: PropTypes.array,
    onArchiveWithProjects: PropTypes.func,
    onArchiveOnly: PropTypes.func,
};

ClientArchiveDialog.defaultProps = {
    client: null,
    relatedProjects: [],
    onArchiveWithProjects: () => {},
    onArchiveOnly: () => {},
};

export default ClientArchiveDialog;
