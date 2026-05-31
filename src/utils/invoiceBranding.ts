import type { InvoiceTemplateLayoutStyle, InvoiceTemplateLogoPlacement } from '@/stores/yjs/types';

export const DEFAULT_INVOICE_LAYOUT_STYLE: InvoiceTemplateLayoutStyle = 'classic';

const CURRENT_LAYOUT_STYLES = new Set<InvoiceTemplateLayoutStyle>([
    'classic',
    'neutral',
]);

export const INVOICE_LAYOUT_STYLE_LABELS: Record<InvoiceTemplateLayoutStyle, string> = {
    classic: 'Classic',
    neutral: 'Minimal',
};

export const DEFAULT_INVOICE_LOGO_PLACEMENT: InvoiceTemplateLogoPlacement = 'invoice-left-logo-right';

const CURRENT_LOGO_PLACEMENTS = new Set<InvoiceTemplateLogoPlacement>([
    'invoice-left-logo-right',
    'invoice-center-logo-center',
    'invoice-right-logo-left',
]);

export const INVOICE_LOGO_PLACEMENT_LABELS: Record<InvoiceTemplateLogoPlacement, string> = {
    'invoice-left-logo-right': 'Invoice Left, Logo Right',
    'invoice-center-logo-center': 'Invoice & Logo Center',
    'invoice-right-logo-left': 'Invoice Right, Logo Left',
};

export function normalizeInvoiceLogoPlacement(value: InvoiceTemplateLogoPlacement | string | null | undefined): InvoiceTemplateLogoPlacement {
    if (!value || !CURRENT_LOGO_PLACEMENTS.has(value as InvoiceTemplateLogoPlacement)) {
        return DEFAULT_INVOICE_LOGO_PLACEMENT;
    }

    return value as InvoiceTemplateLogoPlacement;
}

export function normalizeInvoiceLayoutStyle(value: InvoiceTemplateLayoutStyle | string | null | undefined): InvoiceTemplateLayoutStyle {
    if (!value || !CURRENT_LAYOUT_STYLES.has(value as InvoiceTemplateLayoutStyle)) {
        return DEFAULT_INVOICE_LAYOUT_STYLE;
    }

    return value as InvoiceTemplateLayoutStyle;
}