import { expect, test } from '@playwright/test';

test.describe('Agent bridge smoke', () => {
    test('agent navigation command changes the live app route and keeps command input hidden', async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('tasktime-onboarding-completed', 'true');
            window.__tasktimeAgentBridgeSockets = [];

            class FakeAgentBridgeWebSocket {
                static CONNECTING = 0;
                static OPEN = 1;
                static CLOSING = 2;
                static CLOSED = 3;

                constructor(url) {
                    this.url = url;
                    this.readyState = FakeAgentBridgeWebSocket.CONNECTING;
                    this.sent = [];
                    this.onopen = null;
                    this.onmessage = null;
                    this.onerror = null;
                    this.onclose = null;
                    window.__tasktimeAgentBridgeSockets.push(this);
                }

                send(data) {
                    this.sent.push(data);
                }

                close() {
                    this.readyState = FakeAgentBridgeWebSocket.CLOSED;
                    this.onclose?.(new CloseEvent('close'));
                }

                __open() {
                    this.readyState = FakeAgentBridgeWebSocket.OPEN;
                    this.onopen?.(new Event('open'));
                }

                __message(data) {
                    this.onmessage?.(new MessageEvent('message', { data }));
                }
            }

            window.WebSocket = FakeAgentBridgeWebSocket;
        });

        await page.goto('/account?section=agent');

        await expect(page.getByRole('heading', { name: 'Agent Access' })).toBeVisible();
        await page.getByLabel('Bridge endpoint').fill('ws://127.0.0.1:39123/tasktime-agent');
        await page.getByLabel('Pairing ID').fill('pairing-1');
        await page.getByLabel('Pairing code').fill('123456');
        await page.getByRole('button', { name: 'Connect', exact: true }).click();

        await page.waitForFunction(() => {
            return window.__tasktimeAgentBridgeSockets.some((socket) => socket.url.includes('/tasktime-agent?'));
        });
        await page.evaluate(() => {
            const socket = window.__tasktimeAgentBridgeSockets.find((candidate) => candidate.url.includes('/tasktime-agent?'));
            socket.__open();
            socket.__message(JSON.stringify({
                type: 'agent_bridge_session',
                protocolVersion: 1,
                sessionToken: 'paired-token',
                scopes: ['navigation'],
                expiresAt: Date.now() + 60_000,
            }));
        });

        await expect(page.getByText('Memory only')).toBeVisible();
        await expect(page.getByText('navigation')).toBeVisible();

        await page.evaluate(() => {
            const socket = window.__tasktimeAgentBridgeSockets.find((candidate) => candidate.url.includes('/tasktime-agent?'));
            socket.__message(JSON.stringify({
                protocolVersion: 1,
                requestId: 'agent-navigation-1',
                sessionToken: 'paired-token',
                command: 'open_reports_view',
                input: {
                    secret: 'do not show this in the UI',
                },
            }));
        });

        await expect(page).toHaveURL(/\/reports$/);
        await expect(page.getByRole('heading', { name: /^Reports$/ })).toBeVisible();
        await expect(page.getByText('do not show this in the UI')).toHaveCount(0);

        const sentMessages = await page.evaluate(() => {
            const socket = window.__tasktimeAgentBridgeSockets.find((candidate) => candidate.url.includes('/tasktime-agent?'));
            return socket.sent.map((value) => JSON.parse(value));
        });

        expect(sentMessages).toEqual([
            expect.objectContaining({
                requestId: 'agent-navigation-1',
                response: expect.objectContaining({
                    ok: true,
                    command: 'open_reports_view',
                }),
            }),
        ]);
    });
});
