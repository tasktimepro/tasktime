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
    hasSharedInvoices,
    onConfirmDelete,
    onArchive,
    onForceDelete,
}) => {
    if (!project) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={hasSharedInvoices ? 'Project Has Shared Invoices' : (hasInvoices ? 'Project Has Invoices' : 'Confirm Deletion')}
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
            {hasSharedInvoices ? (
                <>
                    <p className="text-sm text-foreground mb-4">
                        The project "<span className="font-semibold">{project.title}</span>" is referenced by one or more shared invoices.
                    </p>

                    <p className="text-sm text-foreground mb-6">
                        Archive the project to preserve invoice history. Hard deletion is blocked while shared invoices still reference this project.
                    </p>

                    <div className="flex flex-col space-y-3">
                        <Button
                            onClick={onArchive}
                            className="w-full"
                        >
                            Archive Project
                        </Button>
                    </div>
                </>
            ) : hasInvoices ? (
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
                            className="w-full status-danger-border status-danger-surface status-danger-text hover:opacity-90"
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
    hasSharedInvoices: PropTypes.bool,
    onConfirmDelete: PropTypes.func,
    onArchive: PropTypes.func,
    onForceDelete: PropTypes.func,
};

ProjectDeleteDialog.defaultProps = {
    project: null,
    hasInvoices: false,
    hasSharedInvoices: false,
    onConfirmDelete: () => {},
    onArchive: () => {},
    onForceDelete: () => {},
};

export default ProjectDeleteDialog;
