import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildAgentBridgePairingUrl, getAgentBridgeConnectionDiagnostics } from '@/agent/browser/bridgeEndpoint';
import { AgentAppSessionWebSocketClient } from '@/agent/transport/websocketClient';
import { PlugIcon, UnplugIcon, XMarkIcon } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import CustomCheckbox from '@/components/CustomCheckbox';
import { useAgentCommandContext } from '@/hooks/useAgentCommandContext';
import { cn } from '@/lib/utils';

const STATUS_LABELS = {
    idle: 'Disconnected',
    connecting: 'Connecting',
    open: 'Connected',
    closed: 'Disconnected',
    error: 'Connection Error',
};

const ACTIVITY_HISTORY_LIMIT = 8;
const APPROVAL_TIMEOUT_MS = 110_000;

function formatTime(timestamp) {
    if (!timestamp) {
        return 'None';
    }

    return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getStatusVariant(status, session, currentActivity) {
    if (currentActivity) {
        return 'warning';
    }

    if (status === 'open' && session) {
        return 'success';
    }

    if (status === 'connecting' || (status === 'open' && !session)) {
        return 'warning';
    }

    if (status === 'error') {
        return 'error';
    }

    return 'secondary';
}

function describeActivity(activity) {
    if (!activity) {
        return 'None';
    }

    if (activity.status === 'running') {
        return `Running ${activity.command}`;
    }

    if (activity.status === 'failed') {
        return `${activity.command} failed${activity.errorCode ? ` (${activity.errorCode})` : ''}`;
    }

    return `${activity.command} completed`;
}

function getNoticeVariant(severity) {
    if (severity === 'error') {
        return 'destructive';
    }

    if (severity === 'warning') {
        return 'warning';
    }

    return 'default';
}

export default function AgentBridgeSettings() {
    const context = useAgentCommandContext();
    const clientRef = useRef(null);
    const pendingApprovalRef = useRef(null);
    const [endpoint, setEndpoint] = useState('');
    const [pairingId, setPairingId] = useState('');
    const [pairingCode, setPairingCode] = useState('');
    const [status, setStatus] = useState('idle');
    const [session, setSession] = useState(null);
    const [error, setError] = useState('');
    const [lastConnectedAt, setLastConnectedAt] = useState(null);
    const [lastActivity, setLastActivity] = useState(null);
    const [currentActivity, setCurrentActivity] = useState(null);
    const [activityHistory, setActivityHistory] = useState([]);
    const [pendingApproval, setPendingApproval] = useState(null);
    const [agentAccessEnabled, setAgentAccessEnabled] = useState(true);

    const endpointDiagnostics = useMemo(
        () => getAgentBridgeConnectionDiagnostics(endpoint),
        [endpoint]
    );

    const resolvePendingApproval = useCallback((approved) => {
        const pending = pendingApprovalRef.current;

        if (!pending) {
            return;
        }

        window.clearTimeout(pending.timeoutId);
        pendingApprovalRef.current = null;
        setPendingApproval(null);
        pending.resolve(approved);
    }, []);

    const connect = useCallback(() => {
        if (!agentAccessEnabled) {
            setError('Agent access is disabled for this page session.');
            return;
        }

        let url;

        try {
            url = buildAgentBridgePairingUrl({
                endpoint,
                pairingId,
                pairingCode,
            });
        } catch (validationError) {
            setError(validationError instanceof Error ? validationError.message : 'Invalid bridge pairing details.');
            return;
        }

        clientRef.current?.close();
        setError('');
        setSession(null);
        setLastActivity(null);
        setCurrentActivity(null);
        resolvePendingApproval(false);

        const client = new AgentAppSessionWebSocketClient({
            url,
            context,
            autoReconnect: true,
            maxReconnectAttempts: 5,
            onStatusChange: (nextStatus) => {
                setStatus(nextStatus);

                if (nextStatus === 'open') {
                    setLastConnectedAt(Date.now());
                }

                if (nextStatus === 'error') {
                    resolvePendingApproval(false);
                    setError('Unable to connect to the local agent bridge. Check that tasktime-agent-bridge is still running, the endpoint and path match the bridge output, the pairing code has not expired or already been used, and your browser/CSP/local-network settings allow this localhost WebSocket.');
                }

                if (nextStatus === 'closed') {
                    resolvePendingApproval(false);
                }
            },
            onSessionChange: (nextSession) => {
                setSession(nextSession);
                setPairingCode('');
            },
            onCommandApprovalRequest: (request) => {
                resolvePendingApproval(false);

                return new Promise((resolve) => {
                    const requestedAt = Date.now();
                    const timeoutId = window.setTimeout(() => {
                        if (pendingApprovalRef.current?.requestId === request.requestId) {
                            pendingApprovalRef.current = null;
                            setPendingApproval(null);
                            resolve(false);
                        }
                    }, APPROVAL_TIMEOUT_MS);

                    pendingApprovalRef.current = {
                        ...request,
                        timeoutId,
                        resolve,
                    };
                    setPendingApproval({
                        ...request,
                        requestedAt,
                        expiresAt: requestedAt + APPROVAL_TIMEOUT_MS,
                    });
                });
            },
            onCommandStart: (activity) => {
                const startedActivity = {
                    ...activity,
                    status: 'running',
                    startedAt: Date.now(),
                };

                setCurrentActivity(startedActivity);
                setActivityHistory((previous) => [
                    startedActivity,
                    ...previous,
                ].slice(0, ACTIVITY_HISTORY_LIMIT));
            },
            onCommandActivity: (activity) => {
                const completedAt = Date.now();
                const completedActivity = {
                    ...activity,
                    status: activity.ok ? 'completed' : 'failed',
                    completedAt,
                };

                setLastActivity({
                    ...completedActivity,
                    at: completedAt,
                });
                setCurrentActivity((previous) => (
                    previous?.requestId === activity.requestId ? null : previous
                ));
                setActivityHistory((previous) => {
                    const matchingIndex = activity.requestId
                        ? previous.findIndex((item) => item.requestId === activity.requestId)
                        : -1;

                    if (matchingIndex === -1) {
                        return [
                            completedActivity,
                            ...previous,
                        ].slice(0, ACTIVITY_HISTORY_LIMIT);
                    }

                    const next = [...previous];
                    next[matchingIndex] = {
                        ...next[matchingIndex],
                        ...completedActivity,
                    };
                    return next.slice(0, ACTIVITY_HISTORY_LIMIT);
                });
            },
        });

        clientRef.current = client;

        try {
            client.connect();
        } catch (connectError) {
            setStatus('error');
            setError(connectError instanceof Error ? connectError.message : 'Unable to connect to the bridge.');
        }
    }, [agentAccessEnabled, context, endpoint, pairingCode, pairingId, resolvePendingApproval]);

    const disconnect = useCallback(() => {
        resolvePendingApproval(false);
        clientRef.current?.close();
        clientRef.current = null;
        setSession(null);
        setCurrentActivity(null);
        setStatus('closed');
    }, [resolvePendingApproval]);

    const revoke = useCallback(() => {
        resolvePendingApproval(false);
        clientRef.current?.revoke();
        clientRef.current = null;
        setSession(null);
        setCurrentActivity(null);
        setStatus('closed');
    }, [resolvePendingApproval]);

    const setAgentAccessState = useCallback((enabled) => {
        setAgentAccessEnabled(enabled);

        if (!enabled) {
            resolvePendingApproval(false);
            clientRef.current?.revoke();
            clientRef.current = null;
            setSession(null);
            setCurrentActivity(null);
            setLastActivity(null);
            setStatus('closed');
            setError('');
        }
    }, [resolvePendingApproval]);

    useEffect(() => () => {
        resolvePendingApproval(false);
        clientRef.current?.close();
        clientRef.current = null;
    }, [resolvePendingApproval]);

    const statusLabel = !agentAccessEnabled ? 'Disabled' : currentActivity ? 'Acting' : session ? 'Paired' : STATUS_LABELS[status] || status;
    const canConnect = Boolean(agentAccessEnabled && endpoint.trim() && pairingId.trim() && pairingCode.trim() && status !== 'connecting' && status !== 'open');
    const scopes = session ? Array.from(session.scopes) : [];
    const expiresAt = session ? new Date(session.expiresAt).toLocaleString() : 'None';

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-foreground">Agent Access</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage local bridge access for same-device agents.
                </p>
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle>Local Agent Bridge</CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Pair with a running local bridge process.
                                </p>
                            </div>
                            <Badge variant={getStatusVariant(status, session, currentActivity)}>
                                {statusLabel}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <div className="rounded-md border border-border bg-muted/30 p-3">
                            <CustomCheckbox
                                id="agent-access-enabled"
                                checked={agentAccessEnabled}
                                onChange={setAgentAccessState}
                                label="Enable local agent access"
                                labelClassName="text-sm font-medium text-foreground"
                            />
                        </div>

                        {!agentAccessEnabled && (
                            <Notice
                                title="Agent access disabled"
                                description="Pairing is blocked and any connected local bridge session has been revoked for this page session. Standard TaskTime features are unchanged."
                                variant="default"
                                compact
                            />
                        )}

                        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                            <div className="space-y-2">
                                <Label htmlFor="agent-bridge-endpoint">Bridge endpoint</Label>
                                <Input
                                    id="agent-bridge-endpoint"
                                    value={endpoint}
                                    onChange={(event) => setEndpoint(event.target.value)}
                                    placeholder="ws://127.0.0.1:12345/tasktime-agent"
                                    autoComplete="off"
                                    spellCheck={false}
                                    disabled={!agentAccessEnabled || status === 'connecting' || status === 'open'}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="agent-bridge-pairing-id">Pairing ID</Label>
                                <Input
                                    id="agent-bridge-pairing-id"
                                    value={pairingId}
                                    onChange={(event) => setPairingId(event.target.value)}
                                    autoComplete="off"
                                    spellCheck={false}
                                    disabled={!agentAccessEnabled || status === 'connecting' || status === 'open'}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="agent-bridge-pairing-code">Pairing code</Label>
                                <Input
                                    id="agent-bridge-pairing-code"
                                    value={pairingCode}
                                    onChange={(event) => setPairingCode(event.target.value)}
                                    autoComplete="one-time-code"
                                    disabled={!agentAccessEnabled || status === 'connecting' || status === 'open'}
                                />
                            </div>
                        </div>

                        {error && (
                            <Notice
                                title="Agent bridge connection failed"
                                description={error}
                                variant="destructive"
                                compact
                            />
                        )}

                        {endpointDiagnostics.length > 0 && (
                            <div className="space-y-2">
                                {endpointDiagnostics.map((diagnostic) => (
                                    <Notice
                                        key={`${diagnostic.severity}-${diagnostic.title}`}
                                        title={diagnostic.title}
                                        description={diagnostic.message}
                                        variant={getNoticeVariant(diagnostic.severity)}
                                        compact
                                    />
                                ))}
                            </div>
                        )}

                        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-4 sm:gap-6">
                                <div>
                                    <span className="block font-medium text-foreground">Scopes</span>
                                    <span>{scopes.length > 0 ? scopes.join(', ') : 'None'}</span>
                                </div>
                                <div>
                                    <span className="block font-medium text-foreground">Current action</span>
                                    <span>{describeActivity(currentActivity)}</span>
                                </div>
                                <div>
                                    <span className="block font-medium text-foreground">Last activity</span>
                                    <span>{lastActivity ? `${describeActivity(lastActivity)} at ${formatTime(lastActivity.at)}` : 'None'}</span>
                                </div>
                                <div>
                                    <span className="block font-medium text-foreground">Expires</span>
                                    <span>{expiresAt}</span>
                                </div>
                            </div>
                            <div className="flex shrink-0 gap-2">
                                {status === 'open' ? (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={disconnect}
                                            leadingIcon={UnplugIcon}
                                        >
                                            Disconnect
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={revoke}
                                            leadingIcon={XMarkIcon}
                                        >
                                            Revoke
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        onClick={connect}
                                        disabled={!canConnect}
                                        loading={status === 'connecting'}
                                        loadingText="Connecting"
                                        leadingIcon={PlugIcon}
                                    >
                                        Connect
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {pendingApproval && (
                    <Card className="border-amber-300 bg-amber-50/50">
                        <CardHeader>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <CardTitle>Agent Approval</CardTitle>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        A paired agent is requesting a sensitive action.
                                    </p>
                                </div>
                                <Badge variant="warning">Waiting</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                                <div>
                                    <span className="block font-medium text-foreground">Command</span>
                                    <span>{pendingApproval.command}</span>
                                </div>
                                <div>
                                    <span className="block font-medium text-foreground">Request</span>
                                    <span>{pendingApproval.requestId}</span>
                                </div>
                                <div>
                                    <span className="block font-medium text-foreground">Expires</span>
                                    <span>{formatTime(pendingApproval.expiresAt)}</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => resolvePendingApproval(false)}
                                >
                                    Deny
                                </Button>
                                <Button onClick={() => resolvePendingApproval(true)}>
                                    Approve
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className={cn(
                    'grid gap-3 rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground',
                    'sm:grid-cols-3'
                )}>
                    <div>
                        <span className="block font-medium text-foreground">Connection</span>
                        <span>{statusLabel}</span>
                    </div>
                    <div>
                        <span className="block font-medium text-foreground">Connected at</span>
                        <span>{formatTime(lastConnectedAt)}</span>
                    </div>
                    <div>
                        <span className="block font-medium text-foreground">Session token</span>
                        <span>Memory only</span>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Agent Activity</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Recent command status for this page session.
                        </p>
                    </CardHeader>
                    <CardContent>
                        {activityHistory.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No agent activity yet.</p>
                        ) : (
                            <div className="divide-y divide-border rounded-md border border-border">
                                {activityHistory.map((activity, index) => (
                                    <div
                                        key={`${activity.requestId || activity.command}-${activity.startedAt || activity.completedAt || index}`}
                                        className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
                                    >
                                        <div className="min-w-0">
                                            <div className="font-medium text-foreground">
                                                {activity.command}
                                            </div>
                                            <div className="truncate text-muted-foreground">
                                                {activity.requestId || 'No request ID'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:justify-end">
                                            <Badge variant={activity.status === 'failed' ? 'error' : activity.status === 'running' ? 'warning' : 'success'}>
                                                {activity.status}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {formatTime(activity.completedAt || activity.startedAt)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
