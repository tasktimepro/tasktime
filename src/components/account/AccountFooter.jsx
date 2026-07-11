import { cn } from '@/lib/utils';

const currentYear = new Date().getFullYear();

/**
 * Shared footer shown under every Account tab.
 */
const AccountFooter = ({ className }) => {
    return (
        <footer className={cn('flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between', className)}>
            <p className="inline-flex items-center gap-2">
                <span>© {currentYear} TaskTime Pro. All rights reserved.</span>
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
                <a
                    href="https://x.com/tasktimepro"
                    className="inline-flex items-center justify-center text-foreground hover:text-primary"
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label="TaskTime Pro on X"
                >
                    <img src="/x.svg" alt="" aria-hidden="true" className="h-6 w-6" />
                </a>
                <a
                    href="https://github.com/tasktimepro/tasktime"
                    className="inline-flex items-center justify-center text-foreground hover:text-primary"
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label="TaskTime Pro on GitHub"
                >
                    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="h-6 w-6">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                    </svg>
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
