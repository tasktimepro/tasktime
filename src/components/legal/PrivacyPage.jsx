import LegalPageLayout from './LegalPageLayout';

const LAST_UPDATED = '9 April 2026';

/**
 * Public privacy policy page.
 */
const PrivacyPage = () => {
    return (
        <LegalPageLayout
            pageKey="privacy"
            title="Privacy Policy"
            summary="TaskTime is a local-first app. Your data lives in your browser and, if you choose, in your own Google Drive. We cannot see it, we do not collect it, and we have no server that stores it."
            lastUpdated={LAST_UPDATED}
            highlights={[
                'Your data never touches our servers. It stays in your browser and your own Google Drive.',
                'We cannot read your projects, tasks, invoices, expenses, or anything else you put in the app.',
                'No cookies, no tracking.',
            ]}
        >
            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">1. We cannot access your data</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    TaskTime stores all of your projects, tasks, time entries, expenses, invoices, and preferences directly in your browser using IndexedDB. That data never leaves your device unless you explicitly turn on Google Drive sync, and even then it goes straight to <strong>your own</strong> Google Drive account — not to any server we operate.
                </p>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    We have no database of user content. We cannot look up, read, or recover your data because we simply do not have it.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">2. Google Drive sync goes to your own Drive</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    If you connect Google Drive, TaskTime syncs your data between your browser and a hidden app-data folder inside <strong>your own</strong> Google Drive storage. The files belong to you and are accessible only through your Google account. We do not have access to your Google Drive or its contents.
                </p>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    To make sync work, a small authentication service handles the Google sign-in flow and keeps your OAuth session alive. That service sees a session identifier and an encrypted refresh token — it never sees, stores, or inspects the actual files being synced. All file data travels directly between your browser and Google&apos;s servers.
                </p>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    Sync is entirely optional. TaskTime works fully offline without it, and you can disconnect at any time.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">3. No cookies, no tracking</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    TaskTime does not use cookies, advertising pixels, or any form of cross-site tracking. The app uses your browser&apos;s local storage (localStorage and IndexedDB) only to keep your workspace available and to remember your preferences.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">4. What we do store</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    The only thing stored outside your browser is the encrypted OAuth refresh token used to keep your Google Drive sync session alive. It is held on a Cloudflare Worker with no access to your Drive files. If you disconnect sync, the token is discarded.
                </p>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    That is the complete list. There is no user database, no email list, and no analytics pipeline.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">5. Data retention</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    Your local data stays on your device until you delete it or clear your browser storage. Synced copies stay in your Google Drive until you delete them there. The encrypted session token is kept only while your sync connection is active.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">6. Security</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    Because your data lives in your browser and your own Google Drive, its security depends on your device, your browser, and your Google account. We cannot guarantee the security of those systems, but we have deliberately chosen an architecture that keeps your data out of our hands entirely.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">7. You are in control</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    You can export your data at any time for backup. You can connect or disconnect Google Drive sync whenever you want. You can delete all local data from the Account page. Because we never have your data in the first place, there is nothing for us to delete on our end.
                </p>
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">8. Changes to this policy</h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                    This policy may be updated as TaskTime evolves. The current version will always be posted here with the date it was last changed.
                </p>
            </section>
        </LegalPageLayout>
    );
};

export default PrivacyPage;