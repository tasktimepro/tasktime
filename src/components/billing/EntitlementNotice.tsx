import React from 'react';
import { Notice } from '@/components/ui/notice';

export function EntitlementNotice({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Notice title={title}>
            <div className="text-sm">
                {children}
            </div>
        </Notice>
    );
}
