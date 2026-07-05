import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAgentBridgeConnectionDiagnostics } from '@/agent/browser/bridgeEndpoint';
import { CheckIcon, PlugIcon, UnplugIcon, XMarkIcon } from '@/components/ui/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import CustomCheckbox from '@/components/CustomCheckbox';
import {
    describeAgentBridgeActivity,
    formatAgentBridgeTime,
    getAgentBridgeStatusLabel,
    getAgentBridgeStatusVariant,
    useAgentBridge,
} from '@/contexts/AgentBridgeContext.jsx';
import { cn } from '@/lib/utils';

const AGENT_BRIDGE_LAUNCH_PARAMS = {
    endpoint: 'agentBridgeEndpoint',
    pairingId: 'agentBridgePairingId',
    pairingCode: 'agentBridgePairingCode',
};

function readAgentBridgeLaunchPairingFields(search = typeof window === 'undefined' ? '' : window.location.search) {
    const params = new URLSearchParams(search);
    const hasLaunchPairingParam = Object.values(AGENT_BRIDGE_LAUNCH_PARAMS).some((param) => params.has(param));

    if (!hasLaunchPairingParam) {
        return null;
    }

    return {
        endpoint: params.get(AGENT_BRIDGE_LAUNCH_PARAMS.endpoint)?.trim() || '',
        pairingId: params.get(AGENT_BRIDGE_LAUNCH_PARAMS.pairingId)?.trim() || '',
        pairingCode: params.get(AGENT_BRIDGE_LAUNCH_PARAMS.pairingCode)?.trim() || '',
    };
}

function clearAgentBridgeLaunchPairingParams() {
    if (typeof window === 'undefined') {
        return;
    }

    const url = new URL(window.location.href);
    let changed = false;

    Object.values(AGENT_BRIDGE_LAUNCH_PARAMS).forEach((param) => {
        if (url.searchParams.has(param)) {
            url.searchParams.delete(param);
            changed = true;
        }
    });

    if (changed) {
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
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

function formatGrantTimestamp(timestamp) {
    if (!timestamp) {
        return 'None';
    }

    return new Date(timestamp).toLocaleString();
}

export default function AgentBridgeSettings() {
    const {
        status,
        session,
        error,
        lastConnectedAt,
        lastActivity,
        currentActivity,
        activityHistory,
        agentAccessEnabled,
        approvalGrants,
        approvalGrantError,
        connect,
        disconnect,
        revoke,
        createApprovalGrant,
        revokeApprovalGrant,
        setAgentAccessState,
    } = useAgentBridge();
    const [launchPairingFields] = useState(() => readAgentBridgeLaunchPairingFields());
    const [endpoint, setEndpoint] = useState(launchPairingFields?.endpoint || '');
    const [pairingId, setPairingId] = useState(launchPairingFields?.pairingId || '');
    const [pairingCode, setPairingCode] = useState(launchPairingFields?.pairingCode || '');
    const [isCreatingGrant, setIsCreatingGrant] = useState(false);
    const [revokingGrantId, setRevokingGrantId] = useState(null);

    const endpointDiagnostics = useMemo(
        () => getAgentBridgeConnectionDiagnostics(endpoint),
        [endpoint]
    );

    const handleConnect = useCallback(() => {
        connect({
            endpoint,
            pairingId,
            pairingCode,
        });
    }, [connect, endpoint, pairingCode, pairingId]);

    const currentGrantClientId = endpoint.trim() || 'local-agent-bridge';

    const handleCreateApprovalGrant = useCallback(async () => {
        setIsCreatingGrant(true);

        try {
            await createApprovalGrant({
                clientId: currentGrantClientId,
                label: 'Local agent bridge',
            });
        } finally {
            setIsCreatingGrant(false);
        }
    }, [createApprovalGrant, currentGrantClientId]);

    const handleRevokeApprovalGrant = useCallback(async (grantId) => {
        setRevokingGrantId(grantId);

        try {
            await revokeApprovalGrant(grantId);
        } finally {
            setRevokingGrantId(null);
        }
    }, [revokeApprovalGrant]);

    useEffect(() => {
        if (launchPairingFields) {
            clearAgentBridgeLaunchPairingParams();
        }
    }, [launchPairingFields]);

    useEffect(() => {
        if (session) {
            setPairingCode('');
        }
    }, [session]);

    const statusLabel = getAgentBridgeStatusLabel({
        agentAccessEnabled,
        currentActivity,
        session,
        status,
    });
    const canConnect = Boolean(agentAccessEnabled && endpoint.trim() && pairingId.trim() && pairingCode.trim() && status !== 'connecting' && status !== 'open');
    const scopes = session ? Array.from(session.scopes) : [];
    const expiresAt = session ? new Date(session.expiresAt).toLocaleString() : 'None';
    const activeApprovalGrant = approvalGrants.find((grant) => !grant.revokedAt && grant.clientId === currentGrantClientId);

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
                            <Badge variant={getAgentBridgeStatusVariant(status, session, currentActivity)}>
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
                                    <span>{describeAgentBridgeActivity(currentActivity)}</span>
                                </div>
                                <div>
                                    <span className="block font-medium text-foreground">Last activity</span>
                                    <span>{lastActivity ? `${describeAgentBridgeActivity(lastActivity)} at ${formatAgentBridgeTime(lastActivity.at)}` : 'None'}</span>
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
                                        onClick={handleConnect}
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
                        <span>{formatAgentBridgeTime(lastConnectedAt)}</span>
                    </div>
                    <div>
                        <span className="block font-medium text-foreground">Session token</span>
                        <span>Memory only</span>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle>Trusted Chat Approvals</CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Approval tokens from trusted local agents can satisfy sensitive command prompts.
                                </p>
                            </div>
                            <Button
                                onClick={handleCreateApprovalGrant}
                                disabled={!session || Boolean(activeApprovalGrant)}
                                loading={isCreatingGrant}
                                loadingText="Trusting"
                                leadingIcon={CheckIcon}
                            >
                                Trust Current Agent
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {approvalGrantError && (
                            <Notice
                                title="Trusted approval grant unavailable"
                                description={approvalGrantError}
                                variant="destructive"
                                compact
                            />
                        )}

                        {approvalGrants.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No trusted approval grants.</p>
                        ) : (
                            <div className="divide-y divide-border rounded-md border border-border">
                                {approvalGrants.map((grant) => {
                                    const revoked = Boolean(grant.revokedAt);

                                    return (
                                        <div
                                            key={grant.id}
                                            className="grid gap-3 px-3 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto]"
                                        >
                                            <div className="min-w-0 space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-medium text-foreground">
                                                        {grant.label || grant.clientId}
                                                    </span>
                                                    <Badge variant={revoked ? 'secondary' : 'success'}>
                                                        {revoked ? 'Revoked' : 'Trusted'}
                                                    </Badge>
                                                </div>
                                                <div className="truncate text-muted-foreground">
                                                    {grant.clientId}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Scopes: {grant.scopes.join(', ')}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Created: {formatGrantTimestamp(grant.createdAt)}
                                                </div>
                                            </div>
                                            <div className="flex items-center md:justify-end">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleRevokeApprovalGrant(grant.id)}
                                                    disabled={revoked || revokingGrantId === grant.id}
                                                    loading={revokingGrantId === grant.id}
                                                    loadingText="Revoking"
                                                    leadingIcon={XMarkIcon}
                                                >
                                                    Revoke Grant
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

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
                                                {formatAgentBridgeTime(activity.completedAt || activity.startedAt)}
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
