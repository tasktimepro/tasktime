declare module '@/components/Modal' {
    import { ReactNode } from 'react';
    
    interface ModalProps {
        isOpen: boolean;
        onClose: () => void;
        children: ReactNode;
        title?: string;
        description?: string;
        size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
        showCloseButton?: boolean;
        className?: string;
        footer?: ReactNode;
    }
    
    const Modal: (props: ModalProps) => JSX.Element;
    export default Modal;
}

declare module '@/components/ui/button' {
    import { ButtonHTMLAttributes, ElementType, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';

    interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
        variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
        size?: 'default' | 'xs' | 'sm' | 'lg' | 'xl' | 'icon' | 'icon-sm' | 'icon-xs';
        asChild?: boolean;
        leadingIcon?: ElementType;
        trailingIcon?: ElementType;
        loading?: boolean;
        loadingText?: string;
        iconOnly?: boolean;
        fullWidth?: boolean;
        iconClassName?: string;
        children?: ReactNode;
    }

    export const Button: ForwardRefExoticComponent<ButtonProps & RefAttributes<HTMLButtonElement>>;
    export const buttonVariants: (...args: unknown[]) => string;
}

declare module 'html2pdf.js' {
    type Html2PdfChain = {
        set: (options: Record<string, unknown>) => Html2PdfChain;
        from: (source: string | HTMLElement) => Html2PdfChain;
        save: () => Promise<void>;
    };

    const html2pdf: () => Html2PdfChain;
    export default html2pdf;
}
