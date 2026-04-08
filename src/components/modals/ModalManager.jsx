import React, { useState } from 'react';
import ClientModal from './ClientModal';
import ProjectModal from './ProjectModal';
import TemplateModal from './TemplateModal';
import PaymentMethodModal from './PaymentMethodModal';
import BusinessModal from './BusinessModal';
import InvoiceModal from '../invoice/InvoiceModal';
import TaskModal from './TaskModal';
import ExpenseModal from './ExpenseModal';

/**
 * ModalManager - Central manager for all form modals
 * Provides a unified interface to trigger any form modal from any view in the app
 * All modals now use Yjs hooks directly for data access
 */
const ModalManager = ({
    // Modal states
    activeModal,
    setActiveModal,
    editingItem,
    setEditingItem,
    modalOptions,
    setModalOptions
}) => {
    // Modal stack to preserve states when opening nested modals
    const [modalStack, setModalStack] = useState([]);
    
    // Store form states for each modal type
    const [modalFormStates, setModalFormStates] = useState({});

    // Function to save current modal's form state
    const saveCurrentModalState = (modalType, formData) => {
        setModalFormStates(prev => ({
            ...prev,
            [modalType]: {
                ...formData,
                timestamp: Date.now() // To track freshness
            }
        }));
    };

    // Function to get saved form state for a modal
    const getSavedModalState = (modalType) => {
        return modalFormStates[modalType] || null;
    };

    // Function to clear saved state when modal is successfully submitted
    const clearModalState = (modalType) => {
        setModalFormStates(prev => {
            const newState = { ...prev };
            delete newState[modalType];
            return newState;
        });
    };

    const closeModal = () => {
        if (modalStack.length > 0) {
            // If there's a modal in the stack, restore it
            const previousModal = modalStack[modalStack.length - 1];
            setActiveModal(previousModal.modal);
            setEditingItem(previousModal.item);
            setModalStack(prev => prev.slice(0, -1)); // Remove the last item from stack
        } else {
            // No previous modal, close everything
            setActiveModal(null);
            setEditingItem(null);
            // Clear modal options when closing
            if (setModalOptions) {
                setModalOptions(null);
            }
        }
    };

    // Function to open a new modal while preserving the current one
    const openNestedModal = (modalType, item = null) => {
        if (activeModal) {
            // Push current modal state to stack
            setModalStack(prev => [...prev, { modal: activeModal, item: editingItem }]);
        }
        setActiveModal(modalType);
        setEditingItem(item);
    };

    return (
        <>
            {/* Client Modal */}
            {activeModal === 'client' && (
                <ClientModal
                    key={`client-${editingItem?.id || 'new'}`}
                    isOpen={true}
                    onClose={closeModal}
                    editingClient={editingItem}
                />
            )}

            {/* Project Modal */}
            {activeModal === 'project' && (
                <ProjectModal
                    isOpen={true}
                    onClose={closeModal}
                    editingProject={editingItem}
                    modalOptions={modalOptions}
                    openClientModal={() => openNestedModal('client')}
                    saveFormState={(formData) => saveCurrentModalState('project', formData)}
                    getSavedState={() => getSavedModalState('project')}
                    clearSavedState={() => clearModalState('project')}
                />
            )}

            {/* Template Modal */}
            {activeModal === 'template' && (
                <TemplateModal
                    isOpen={true}
                    onClose={closeModal}
                    editingTemplate={editingItem}
                />
            )}

            {/* Payment Method Modal */}
            {activeModal === 'payment-method' && (
                <PaymentMethodModal
                    key={`payment-method-${editingItem?.id || 'new'}`}
                    isOpen={true}
                    onClose={closeModal}
                    editingPaymentMethod={editingItem}
                />
            )}

            {/* Business Modal */}
            {activeModal === 'business' && (
                <BusinessModal
                    key={`business-${editingItem?.id || 'new'}`}
                    isOpen={true}
                    onClose={closeModal}
                    editingBusinessInfo={editingItem}
                />
            )}

            {/* Task Modal */}
            {activeModal === 'task' && (
                <TaskModal
                    isOpen={true}
                    onClose={closeModal}
                    editingTask={editingItem}
                    modalOptions={modalOptions}
                    openProjectModal={() => openNestedModal('project')}
                    saveFormState={(formData) => saveCurrentModalState('task', formData)}
                    getSavedState={() => getSavedModalState('task')}
                    clearSavedState={() => clearModalState('task')}
                />
            )}

            {/* Expense Modal */}
            {activeModal === 'expense' && (
                <ExpenseModal
                    isOpen={true}
                    onClose={closeModal}
                    editingExpense={editingItem}
                    modalOptions={modalOptions}
                    saveFormState={(formData) => saveCurrentModalState('expense', formData)}
                    getSavedState={() => getSavedModalState('expense')}
                    clearSavedState={() => clearModalState('expense')}
                />
            )}
        </>
    );
};

export default ModalManager;
