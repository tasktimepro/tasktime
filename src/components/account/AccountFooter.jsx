import { cn } from '@/lib/utils';

const currentYear = new Date().getFullYear();

/**
 * Shared footer shown under every Account tab.
 */
const AccountFooter = ({ className }) => {
    return (
        <footer className={cn('flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between', className)}>
            <p className="inline-flex items-center gap-2">
                <span>© {currentYear} TaskTime. All rights reserved.</span>
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
                <a
                    href="https://x.com/tasktimepro"
                    className="inline-flex items-center justify-center text-foreground hover:text-primary"
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label="TaskTime on X"
                >
                    <img src="/x.svg" alt="" aria-hidden="true" className="h-6 w-6" />
                </a>
                <a
                    href="/blog/"
                    className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                    target="_blank"
                    rel="noreferrer noopener"
                >
                    Blog
                </a>
                <a
                    href="/contact/"
                    className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                    target="_blank"
                    rel="noreferrer noopener"
                >
                    Contact
                </a>
                <a
                    href="/privacy/"
                    className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                    target="_blank"
                    rel="noreferrer noopener"
                >
                    Privacy Policy
                </a>
                <a
                    href="/terms/"
                    className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                    target="_blank"
                    rel="noreferrer noopener"
                >
                    Terms & Conditions
                </a>
            </div>
        </footer>
    );
};

export default AccountFooter;
