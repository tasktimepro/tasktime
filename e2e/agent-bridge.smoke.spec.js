import { expect, test } from '@playwright/test';

test.describe('Agent bridge smoke', () => {
    test('paired access survives refresh and same-profile close/reopen without another pairing code', async ({ context, page }) => {
        await context.addInitScript(() => {
            window.localStorage.setItem('tasktime-onboarding-completed', 'true');
            window.__tasktimeAgentBridgeSockets = [];
            const NativeWebSocket = window.WebSocket;

            class DurableFakeAgentBridgeWebSocket {
                static CONNECTING = 0;
                static OPEN = 1;
                static CLOSING = 2;
                static CLOSED = 3;

                constructor(url) {
                    if (!String(url).includes('/tasktime-agent')) {
                        return new NativeWebSocket(url);
                    }

                    this.url = url;
                    this.readyState = DurableFakeAgentBridgeWebSocket.CONNECTING;
                    this.sent = [];
                    this.onopen = null;
                    this.onmessage = null;
                    this.onerror = null;
                    this.onclose = null;
                    window.__tasktimeAgentBridgeSockets.push(this);
                }

                send(data) {
                    this.sent.push(data);
                    const message = JSON.parse(data);

                    if (message.type === 'agent_bridge_reconnect_register') {
                        queueMicrotask(() => this.__message(JSON.stringify({
                            type: 'agent_bridge_reconnect_registered',
                            protocolVersion: 1,
                            bridgeInstanceId: 'bridge-e2e',
                            keyId: 'browser-key-e2e',
                            expiresAt: Date.now() + 60_000,
                        })));
                    }

                    if (message.type === 'agent_bridge_reconnect_proof') {
                        queueMicrotask(() => this.__message(JSON.stringify({
                            type: 'agent_bridge_session',
                            protocolVersion: 1,
                            sessionToken: 'reopened-token',
                            scopes: ['read', 'navigation'],
                            expiresAt: Date.now() + 60_000,
                            agentId: 'tasktime.agent.openclaw',
                            agentLabel: 'OpenClaw on this device',
                        })));
                    }
                }

                close() {
                    this.readyState = DurableFakeAgentBridgeWebSocket.CLOSED;
                    this.onclose?.(new CloseEvent('close'));
                }

                __open() {
                    this.readyState = DurableFakeAgentBridgeWebSocket.OPEN;
                    this.onopen?.(new Event('open'));
                    const url = new URL(this.url);

                    if (url.searchParams.has('sessionToken')) {
                        queueMicrotask(() => this.__message(JSON.stringify({
                            type: 'agent_bridge_session',
                            protocolVersion: 1,
                            sessionToken: url.searchParams.get('sessionToken'),
                            scopes: ['read', 'navigation'],
                            expiresAt: Date.now() + 60_000,
                            agentId: 'tasktime.agent.openclaw',
                            agentLabel: 'OpenClaw on this device',
                        })));
                    }

                    if (url.searchParams.has('reconnectKeyId')) {
                        queueMicrotask(() => this.__message(JSON.stringify({
                            type: 'agent_bridge_reconnect_challenge',
                            protocolVersion: 1,
                            bridgeInstanceId: 'bridge-e2e',
                            keyId: 'browser-key-e2e',
                            challengeId: `challenge-${Date.now()}`,
                            nonce: 'e2e-reconnect-nonce',
                            origin: window.location.origin,
                            expiresAt: Date.now() + 30_000,
                        })));
                    }
                }

                __message(data) {
                    this.onmessage?.(new MessageEvent('message', { data }));
                }
            }

            window.WebSocket = DurableFakeAgentBridgeWebSocket;
        });

        await page.goto('/account?section=agent');
        await page.getByLabel('Bridge endpoint').fill('ws://127.0.0.1:39123/tasktime-agent');
        await page.getByLabel('Pairing ID').fill('pairing-continuity');
        await page.getByLabel('Pairing code').fill('123456');
        await page.getByRole('button', { name: 'Connect', exact: true }).click();
        await page.waitForFunction(() => window.__tasktimeAgentBridgeSockets.some((socket) => socket.url.includes('pairingId=pairing-continuity')));
        await page.evaluate(() => {
            const socket = window.__tasktimeAgentBridgeSockets.find((candidate) => candidate.url.includes('pairingId=pairing-continuity'));
            socket.__open();
            socket.__message(JSON.stringify({
                type: 'agent_bridge_session',
                protocolVersion: 1,
                sessionToken: 'paired-continuity-token',
                scopes: ['read', 'navigation'],
                expiresAt: Date.now() + 60_000,
                agentId: 'tasktime.agent.openclaw',
                agentLabel: 'OpenClaw on this device',
            }));
        });
        await expect(page.getByText('Securely remembered')).toBeVisible();
        expect(await page.evaluate(() => window.sessionStorage.getItem('tasktime.agent.bridge.session.v1'))).toContain('paired-continuity-token');

        await page.reload();
        await page.waitForTimeout(1_000);
        const restoreState = await page.evaluate(() => ({
            record: window.sessionStorage.getItem('tasktime.agent.bridge.session.v1'),
            urls: window.__tasktimeAgentBridgeSockets.map((socket) => socket.url),
            webSocketName: window.WebSocket.name,
        }));
        expect(restoreState).toMatchObject({
            record: expect.stringContaining('paired-continuity-token'),
            urls: expect.arrayContaining([
                expect.stringContaining('sessionToken=paired-continuity-token'),
            ]),
            webSocketName: 'DurableFakeAgentBridgeWebSocket',
        });
        expect(await page.evaluate(() => window.sessionStorage.getItem('tasktime.agent.bridge.session.v1'))).toContain('paired-continuity-token');
        const resumeUrls = await page.evaluate(() => window.__tasktimeAgentBridgeSockets.map((socket) => socket.url));
        expect(resumeUrls).toEqual(expect.arrayContaining([
            expect.stringContaining('sessionToken=paired-continuity-token'),
        ]));
        await page.evaluate(() => window.__tasktimeAgentBridgeSockets.find((socket) => socket.url.includes('sessionToken=paired-continuity-token')).__open());
        await expect(page.getByText('Paired', { exact: true }).first()).toBeVisible();

        await page.close();
        const reopenedPage = await context.newPage();
        await reopenedPage.goto('/account?section=agent');
        await reopenedPage.waitForFunction(() => window.__tasktimeAgentBridgeSockets.some((socket) => socket.url.includes('reconnectKeyId=browser-key-e2e')));
        expect(await reopenedPage.evaluate(() => window.__tasktimeAgentBridgeSockets.find((socket) => socket.url.includes('reconnectKeyId=browser-key-e2e')).url)).toContain('reconnectKeyId=browser-key-e2e');
        await reopenedPage.evaluate(() => window.__tasktimeAgentBridgeSockets.find((socket) => socket.url.includes('reconnectKeyId=browser-key-e2e')).__open());
        await expect(reopenedPage.getByText('Paired', { exact: true }).first()).toBeVisible();
        await expect(reopenedPage.getByText('Securely remembered')).toBeVisible();
    });

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

        await expect(page.getByText('Current tab only')).toBeVisible();
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

        expect(sentMessages).toEqual(expect.arrayContaining([
            expect.objectContaining({
                requestId: 'agent-navigation-1',
                response: expect.objectContaining({
                    ok: true,
                    command: 'open_reports_view',
                }),
            }),
        ]));
    });
});
