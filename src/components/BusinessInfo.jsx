import { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, BuildingOfficeIcon } from '@/components/ui/icons';
import { MoreHorizontal } from 'lucide-react';
import { useToast } from '../hooks/useToast.ts';
import { useBusinessInfos } from '../hooks/useBusinessInfos.ts';
import { toDisplayDate } from '../utils/dateUtils.ts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import Modal from './Modal';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * BusinessInfo component - Manages global business information for invoices
 */
const BusinessInfo = ({ 
    autoOpenCreate = false,
    // Modal functions
    openBusinessModal = null,
    editBusinessModal = null
}) => {
    const { showSuccess } = useToast();
    const { businessInfos, deleteBusinessInfo } = useBusinessInfos();
    const [pendingDeleteBusinessId, setPendingDeleteBusinessId] = useState(null);

    // Auto-open create modal when autoOpenCreate prop changes
    useEffect(() => {
        if (autoOpenCreate && openBusinessModal) {
            openBusinessModal();
        }
    }, [autoOpenCreate, openBusinessModal]);

    /**
     * Delete a business info
     */
    const handleDeleteBusinessInfo = (businessInfoId) => {
        setPendingDeleteBusinessId(businessInfoId);
    };

    const closeDeleteBusinessModal = () => {

        setPendingDeleteBusinessId(null);
    };

    const confirmDeleteBusiness = () => {

        if (!pendingDeleteBusinessId) {

            return;
        }

        deleteBusinessInfo(pendingDeleteBusinessId);
        showSuccess('Business info deleted successfully');
        setPendingDeleteBusinessId(null);
    };

    const pendingDeleteBusiness = pendingDeleteBusinessId
        ? businessInfos.find((info) => info.id === pendingDeleteBusinessId)
        : null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Your Business</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage sender business information for your invoices
                    </p>
                </div>

                <Button
                    onClick={() => openBusinessModal && openBusinessModal()}
                    leadingIcon={PlusIcon}
                >
                    New Business
                </Button>
            </div>



            {/* Business List */}
            {businessInfos.length === 0 ? (
                <div className="text-center py-12">
                    <BuildingOfficeIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h4 className="mt-2 text-sm font-medium text-foreground">No business yet</h4>
                    <p className="mt-1 text-sm text-muted-foreground">Get started by creating your first business.</p>

                    <div className="mt-6">
                        <Button
                            onClick={() => openBusinessModal && openBusinessModal()}
                            leadingIcon={PlusIcon}
                        >
                            New Business
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {businessInfos.map((info) => (
                        <Card
                            key={info.id}
                            className="hover:shadow-md transition-shadow"
                        >
                            <CardContent className="pt-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                            <BuildingOfficeIcon className="h-6 w-6 text-muted-foreground" />
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <h4 className="text-lg font-medium text-foreground">
                                                        {info.title || info.name}
                                                    </h4>
                                                    {info.isDefault && (
                                                        <Badge variant="secondary">Default</Badge>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-sm text-muted-foreground space-y-1">
                                                    {info.businessName && <p>Business/Name: {info.businessName}</p>}
                                                    {info.address && <p>Address: {info.address}</p>}
                                                    {info.city && <p>City: {info.city}</p>}
                                                    {(info.state || info.zip) && (
                                                        <p>State/ZIP: {`${info.state || ''} ${info.zip || ''}`.trim()}</p>
                                                    )}
                                                    {info.country && <p>Country: {info.country}</p>}
                                                    {info.registrationNumber && <p>Registration: {info.registrationNumber}</p>}
                                                    {info.vat && <p>VAT: {info.vat}</p>}
                                                    {info.taxNumber && <p>Tax Number: {info.taxNumber}</p>}
                                                    {info.email && <p>Email: {info.email}</p>}
                                                    {info.phone && <p>Phone: {info.phone}</p>}
                                                    {info.custom && info.custom.length > 0 && (
                                                        <div className="space-y-1">
                                                            {info.custom.map((field, index) => (
                                                                <p key={index}>{field.label}: {field.value}</p>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    Created {toDisplayDate(info.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Three-dot dropdown menu for Edit and Delete */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:bg-muted rounded-full transition-colors group"
                                                title="More actions"
                                                aria-label="More actions"
                                            >
                                                <MoreHorizontal className="h-5 w-5 group-hover:text-muted-foreground" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                                onClick={() => editBusinessModal && editBusinessModal(info)}
                                                className="cursor-pointer hover:bg-yellow-50 focus:bg-yellow-50 hover:text-yellow-600 focus:text-yellow-600"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                                <span>Edit</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleDeleteBusinessInfo(info.id)}
                                                className="cursor-pointer hover:bg-red-50 focus:bg-red-50 hover:text-red-600 focus:text-red-600"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                                <span>Delete</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                isOpen={Boolean(pendingDeleteBusinessId)}
                onClose={closeDeleteBusinessModal}
                title="Delete business?"
                description="This will permanently remove the business entry."
                footer={(
                    <div className="flex justify-end space-x-3">
                        <Button
                            variant="outline"
                            onClick={closeDeleteBusinessModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteBusiness}
                        >
                            Delete
                        </Button>
                    </div>
                )}
            >
                <Notice
                    title={pendingDeleteBusiness
                        ? `Deleting "${pendingDeleteBusiness.title || pendingDeleteBusiness.name}" cannot be undone.`
                        : 'Deleting this business cannot be undone.'}
                    variant="destructive"
                />
            </Modal>
        </div>
    );
};

export default BusinessInfo;
