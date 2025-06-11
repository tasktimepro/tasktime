import React, { useState } from 'react';
import ClientModal from './ClientModal';
import ProjectModal from './ProjectModal';
import TemplateModal from './TemplateModal';
import PaymentMethodModal from './PaymentMethodModal';
import BusinessModal from './BusinessModal';
import InvoiceModal from '../invoice/InvoiceModal';

/**
 * ModalManager - Central manager for all form modals
 * Provides a unified interface to trigger any form modal from any view in the app
 */
const ModalManager = ({
    // Modal states
    activeModal,
    setActiveModal,
    editingItem,
    setEditingItem,
    
    // Client modal props
    clients,
    setClients,

    // Project modal props
    projects,
    setProjects,
    
    // Template modal props
    invoiceTemplates,
    setInvoiceTemplates,
    
    // Payment method modal props
    paymentMethods,
    setPaymentMethods,
    
    // Business modal props
    businessInfos,
    setBusinessInfos
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
            console.log('Restoring previous modal:', previousModal.modal, 'with item:', previousModal.item);
            setActiveModal(previousModal.modal);
            setEditingItem(previousModal.item);
            setModalStack(prev => prev.slice(0, -1)); // Remove the last item from stack
        } else {
            // No previous modal, close everything
            console.log('Closing all modals');
            setActiveModal(null);
            setEditingItem(null);
        }
    };

    // Function to open a new modal while preserving the current one
    const openNestedModal = (modalType, item = null) => {
        if (activeModal) {
            // Push current modal state to stack
            console.log('Pushing to stack:', activeModal, 'with item:', editingItem);
            setModalStack(prev => [...prev, { modal: activeModal, item: editingItem }]);
        }
        console.log('Opening nested modal:', modalType, 'with item:', item);
        setActiveModal(modalType);
        setEditingItem(item);
    };

    return (
        <>
            {/* Client Modal */}
            {activeModal === 'client' && (
                <ClientModal
                    isOpen={true}
                    onClose={closeModal}
                    clients={clients}
                    setClients={setClients}
                    editingClient={editingItem}
                />
            )}

            {/* Project Modal */}
            {activeModal === 'project' && (
                <ProjectModal
                    isOpen={true}
                    onClose={closeModal}
                    projects={projects}
                    setProjects={setProjects}
                    editingProject={editingItem}
                    clients={clients}
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
                    invoiceTemplates={invoiceTemplates}
                    setInvoiceTemplates={setInvoiceTemplates}
                    editingTemplate={editingItem}
                />
            )}

            {/* Payment Method Modal */}
            {activeModal === 'payment-method' && (
                <PaymentMethodModal
                    isOpen={true}
                    onClose={closeModal}
                    paymentMethods={paymentMethods}
                    setPaymentMethods={setPaymentMethods}
                    editingPaymentMethod={editingItem}
                />
            )}

            {/* Business Modal */}
            {activeModal === 'business' && (
                <BusinessModal
                    isOpen={true}
                    onClose={closeModal}
                    businessInfos={businessInfos}
                    setBusinessInfos={setBusinessInfos}
                    editingBusinessInfo={editingItem}
                />
            )}
        </>
    );
};

export default ModalManager;
