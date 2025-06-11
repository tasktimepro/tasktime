import React from 'react';
import ClientModal from './ClientModal';
import ProjectModal from './ProjectModal';
import TemplateModal from './TemplateModal';
import PaymentMethodModal from './PaymentMethodModal';
import BusinessModal from './BusinessModal';

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

    const closeModal = () => {
        setActiveModal(null);
        setEditingItem(null);
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
