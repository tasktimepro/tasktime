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
import useIsMobileLayout from '../hooks/useIsMobileLayout';
import { cn } from '@/lib/utils';
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
    const isMobileLayout = useIsMobileLayout();
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
        <div className={cn('space-y-6', isMobileLayout && 'space-y-4 overflow-x-hidden')}>
            {/* Header */}
            <div className={cn('flex justify-between gap-3', isMobileLayout ? 'flex-col items-start' : 'items-center')}>
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Your Business</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage sender business information
                    </p>
                </div>

                <Button
                    onClick={() => openBusinessModal && openBusinessModal()}
                    leadingIcon={PlusIcon}
                    className={cn(isMobileLayout && 'w-full sm:w-auto')}
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
                            <CardContent className={cn(isMobileLayout ? 'p-4' : 'pt-5')}>
                                <div className={cn('justify-between gap-3', isMobileLayout ? 'space-y-3' : 'flex items-center')}>
                                    <div className="flex-1">
                                        <div className="flex items-start space-x-3 min-w-0">
                                            <BuildingOfficeIcon className="h-6 w-6 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="text-lg font-medium text-foreground break-words">
                                                        {info.title || info.name}
                                                    </h4>
                                                    {info.isDefault && (
                                                        <Badge variant="secondary">Default</Badge>
                                                    )}
                                                </div>
                                                <div className="mt-1 text-sm text-muted-foreground space-y-1 break-words">
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
                                    <div className={cn(isMobileLayout && 'flex justify-end')}>
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
                                                className="status-warning-action cursor-pointer"
                                            >
                                                <PencilIcon className="h-4 w-4" />
                                                <span>Edit</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => handleDeleteBusinessInfo(info.id)}
                                                className="status-danger-action cursor-pointer"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                                <span>Delete</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    </div>
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
