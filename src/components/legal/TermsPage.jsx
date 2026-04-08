import LegalPageLayout from './LegalPageLayout';

const LAST_UPDATED = '9 April 2026';

/**
 * Public terms and conditions page.
 */
const TermsPage = () => {
    return (
        <LegalPageLayout
            pageKey="terms"
            title="Terms & Conditions"
            summary="These are the ground rules for using TaskTime. The short version: your data is yours, the app is provided as-is, and you are responsible for your own records and backups."
            lastUpdated={LAST_UPDATED}
            highlights={[
                'TaskTime is a local-first tool — your data lives in your browser, not on our servers.',
                'The app is provided as-is without warranties. Keep your own backups.',
                'Liability is limited to the fullest extent permitted by law.',
            ]}
        >
            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">1. Acceptance</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    By using TaskTime you agree to these terms. If you don&apos;t agree, don&apos;t use the app.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">2. What TaskTime is</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    TaskTime is a local-first productivity app for freelancers. It helps you track time, manage tasks and expenses, and generate invoices. Everything runs in your browser and is stored on your device. There is no account, no server-side database, and no way for us to see what you put in the app.
                </p>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    TaskTime is a tool, not professional advice. You are responsible for reviewing anything you create, export, or send — including invoices, time records, and expense reports.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">3. Your data, your responsibility</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    Because your data lives entirely in your browser (and optionally in your own Google Drive), you are responsible for keeping backups, maintaining accurate records, and securing your devices and accounts. If you clear your browser data and have no sync or export, that data is gone — we cannot recover it for you because we never had it.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">4. Google Drive sync</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    Google Drive sync is optional. When enabled, it stores your data in <strong>your own</strong> Google Drive account. The sync feature depends on Google&apos;s services and is governed by Google&apos;s own terms and privacy policies. We are not responsible for Google&apos;s availability, outages, or policy changes.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">5. No warranties</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    TaskTime is provided as-is and as-available. To the fullest extent permitted by law, we disclaim all warranties — express, implied, or statutory — including warranties of merchantability, fitness for a particular purpose, accuracy, reliability, and uninterrupted operation.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">6. Limitation of liability</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    To the fullest extent permitted by law, TaskTime and its operator will not be liable for data loss, sync failures, corrupted records, interrupted business, lost profits, or any indirect, incidental, special, or consequential damages arising from your use of the app.
                </p>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    Where liability cannot be fully excluded by law, total liability is limited to the amount you paid for TaskTime in the twelve months before the event — which may be zero.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">7. Changes and availability</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    TaskTime may be updated, changed, or discontinued at any time. Features — including sync behavior and supported integrations — may evolve. Keep your own backups of anything important.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">8. Termination</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    You can stop using TaskTime at any time. Access to connected features may be restricted or suspended if necessary for security, abuse prevention, or legal reasons.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">9. Changes to these terms</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    These terms may be updated as TaskTime evolves. The current version will always be posted here with the date it was last changed. Continued use after an update means you accept the new terms.
                </p>
            </section>
        </LegalPageLayout>
    );
};

export default TermsPage;