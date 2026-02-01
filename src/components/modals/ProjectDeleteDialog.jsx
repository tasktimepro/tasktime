/**
 * ProjectDeleteDialog - Reusable project deletion confirmation modal.
 */

import PropTypes from 'prop-types';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';

const ProjectDeleteDialog = ({
    isOpen,
    onClose,
    project,
    hasInvoices,
    onConfirmDelete,
    onArchive,
    onForceDelete,
}) => {
    if (!project) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={hasInvoices ? 'Project Has Invoices' : 'Confirm Deletion'}
            size="md"
            footer={
                hasInvoices ? (
                    <div className="flex justify-end space-x-3">
                        <Button
                            onClick={onClose}
                            variant="outline"
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <div className="flex justify-end space-x-3">
                        <Button
                            onClick={onClose}
                            variant="outline"
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={onConfirmDelete}
                            variant="destructive"
                        >
                            Delete Project
                        </Button>
                    </div>
                )
            }
        >
            {hasInvoices ? (
                <>
                    <p className="text-sm text-foreground mb-4">
                        The project "<span className="font-semibold">{project.title}</span>" has invoices attached to it.
                    </p>

                    <p className="text-sm text-foreground mb-6">
                        <strong>Recommended:</strong> Archive this project to preserve the invoices for record-keeping purposes.
                    </p>

                    <div className="flex flex-col space-y-3">
                        <Button
                            onClick={onArchive}
                            className="w-full"
                        >
                            Archive Project (Recommended)
                        </Button>

                        <Button
                            onClick={onForceDelete}
                            variant="outline"
                            className="w-full border-red-300 text-red-700 bg-red-50 hover:bg-red-100 focus:ring-ring dark:border-red-700 dark:text-red-300 dark:bg-red-950 dark:hover:bg-red-900"
                        >
                            Force Delete Project & All Invoices
                        </Button>
                    </div>
                </>
            ) : (
                <p className="text-sm text-foreground">
                    Are you sure you want to delete the project "<span className="font-semibold">{project.title}</span>"? This action cannot be undone and will delete all related tasks and time entries.
                </p>
            )}
        </Modal>
    );
};

ProjectDeleteDialog.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    project: PropTypes.object,
    hasInvoices: PropTypes.bool,
    onConfirmDelete: PropTypes.func,
    onArchive: PropTypes.func,
    onForceDelete: PropTypes.func,
};

ProjectDeleteDialog.defaultProps = {
    project: null,
    hasInvoices: false,
    onConfirmDelete: () => {},
    onArchive: () => {},
    onForceDelete: () => {},
};

export default ProjectDeleteDialog;
