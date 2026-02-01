/**
 * ClientDeleteDialog - Reusable client deletion confirmation modal.
 */

import PropTypes from 'prop-types';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';

const ClientDeleteDialog = ({
    isOpen,
    onClose,
    client,
    relatedProjects,
    onArchiveRecommended,
    onDeleteOnly,
    onDeleteAll,
}) => {
    if (!client) return null;

    const hasRelatedProjects = relatedProjects && relatedProjects.length > 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={hasRelatedProjects ? 'Client Has Related Projects' : 'Delete client?'}
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
                        <Button variant="destructive" onClick={onDeleteOnly}>Delete Client</Button>
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
                        <strong>Recommended:</strong> Archive this client to preserve project relationships for record-keeping purposes.
                    </p>

                    <div className="flex flex-col space-y-3">
                        <Button
                            onClick={onArchiveRecommended}
                            className="w-full"
                        >
                            Archive Client (Recommended)
                        </Button>

                        <Button
                            onClick={onDeleteOnly}
                            variant="outline"
                            className="w-full border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:ring-yellow-500 dark:border-yellow-700 dark:text-yellow-300 dark:bg-yellow-950 dark:hover:bg-yellow-900"
                        >
                            Delete & Remove Client Reference
                        </Button>

                        <Button
                            onClick={onDeleteAll}
                            variant="outline"
                            className="w-full border-red-300 text-red-700 bg-red-50 hover:bg-red-100 focus:ring-ring dark:border-red-700 dark:text-red-300 dark:bg-red-950 dark:hover:bg-red-900"
                        >
                            Delete Client & All Projects
                        </Button>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-foreground">
                    Are you sure you want to delete the client "<span className="font-semibold">{client.title}</span>"? This action cannot be undone.
                </p>
            )}
        </Modal>
    );
};

ClientDeleteDialog.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    client: PropTypes.object,
    relatedProjects: PropTypes.array,
    onArchiveRecommended: PropTypes.func,
    onDeleteOnly: PropTypes.func,
    onDeleteAll: PropTypes.func,
};

ClientDeleteDialog.defaultProps = {
    client: null,
    relatedProjects: [],
    onArchiveRecommended: () => {},
    onDeleteOnly: () => {},
    onDeleteAll: () => {},
};

export default ClientDeleteDialog;
