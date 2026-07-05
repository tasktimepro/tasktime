/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { buildAgentBridgePairingUrl } from '@/agent/browser/bridgeEndpoint';
import {
    createAgentBridgeApprovalGrant,
    listAgentBridgeApprovalGrants,
    revokeAgentBridgeApprovalGrant as revokeStoredAgentBridgeApprovalGrant,
    saveAgentBridgeApprovalGrant,
} from '@/agent/browser/approvalTokens';
import { AgentAppSessionWebSocketClient } from '@/agent/transport/websocketClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Modal from '@/components/Modal';
import { useAgentCommandContext } from '@/hooks/useAgentCommandContext';

export const AGENT_BRIDGE_STATUS_LABELS = {
    idle: 'Disconnected',
    connecting: 'Connecting',
    open: 'Connected',
    closed: 'Disconnected',
    error: 'Connection Error',
};

const ACTIVITY_HISTORY_LIMIT = 8;
const APPROVAL_TIMEOUT_MS = 110_000;

const AgentBridgeContext = createContext(null);

export function formatAgentBridgeTime(timestamp) {
    if (!timestamp) {
        return 'None';
    }

    return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function getAgentBridgeStatusLabel({ agentAccessEnabled, currentActivity, session, status }) {
    if (!agentAccessEnabled) {
        return 'Disabled';
    }

    if (currentActivity) {
        return 'Acting';
    }

    if (session) {
        return 'Paired';
    }

    return AGENT_BRIDGE_STATUS_LABELS[status] || status;
}

export function getAgentBridgeStatusVariant(status, session, currentActivity) {
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

export function describeAgentBridgeActivity(activity) {
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

export function AgentBridgeProvider({ children, verifyApprovalToken }) {
    const commandContext = useAgentCommandContext();
    const commandContextRef = useRef(commandContext);
    const clientRef = useRef(null);
    const pendingApprovalRef = useRef(null);
    const [status, setStatus] = useState('idle');
    const [session, setSession] = useState(null);
    const [error, setError] = useState('');
    const [lastConnectedAt, setLastConnectedAt] = useState(null);
    const [lastActivity, setLastActivity] = useState(null);
    const [currentActivity, setCurrentActivity] = useState(null);
    const [activityHistory, setActivityHistory] = useState([]);
    const [pendingApproval, setPendingApproval] = useState(null);
    const [agentAccessEnabled, setAgentAccessEnabled] = useState(true);
    const [approvalGrants, setApprovalGrants] = useState([]);
    const [approvalGrantError, setApprovalGrantError] = useState('');

    useEffect(() => {
        commandContextRef.current = commandContext;
    }, [commandContext]);

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

    const closeClient = useCallback(() => {
        clientRef.current?.close();
        clientRef.current = null;
    }, []);

    const refreshApprovalGrants = useCallback(async () => {
        try {
            setApprovalGrants(await listAgentBridgeApprovalGrants());
            setApprovalGrantError('');
        } catch {
            setApprovalGrantError('Trusted approval grants are unavailable in this browser session.');
        }
    }, []);

    const connect = useCallback(({ endpoint, pairingId, pairingCode }) => {
        if (!agentAccessEnabled) {
            setError('Agent access is disabled for this page session.');
            return false;
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
            return false;
        }

        closeClient();
        setError('');
        setSession(null);
        setLastActivity(null);
        setCurrentActivity(null);
        resolvePendingApproval(false);

        const client = new AgentAppSessionWebSocketClient({
            url,
            context: commandContextRef.current,
            getContext: () => commandContextRef.current,
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
            verifyApprovalToken,
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
            return true;
        } catch (connectError) {
            setStatus('error');
            setError(connectError instanceof Error ? connectError.message : 'Unable to connect to the bridge.');
            return false;
        }
    }, [agentAccessEnabled, closeClient, resolvePendingApproval, verifyApprovalToken]);

    const disconnect = useCallback(() => {
        resolvePendingApproval(false);
        closeClient();
        setSession(null);
        setCurrentActivity(null);
        setStatus('closed');
    }, [closeClient, resolvePendingApproval]);

    const revoke = useCallback(() => {
        resolvePendingApproval(false);
        clientRef.current?.revoke();
        clientRef.current = null;
        setSession(null);
        setCurrentActivity(null);
        setStatus('closed');
    }, [resolvePendingApproval]);

    const createApprovalGrant = useCallback(async ({ clientId, label }) => {
        if (!session) {
            setApprovalGrantError('Pair the local bridge before trusting it for chat approvals.');
            return null;
        }

        const grant = createAgentBridgeApprovalGrant({
            clientId,
            label,
            scopes: Array.from(session.scopes),
        });

        try {
            await saveAgentBridgeApprovalGrant(grant);
        } catch {
            setApprovalGrantError('Unable to store the trusted approval grant.');
            return null;
        }

        if (clientRef.current?.sendApprovalGrant(grant) !== true) {
            await revokeStoredAgentBridgeApprovalGrant(grant.id);
            await refreshApprovalGrants();
            setApprovalGrantError('Unable to deliver the trusted approval grant to the local bridge.');
            return null;
        }

        await refreshApprovalGrants();
        return grant;
    }, [refreshApprovalGrants, session]);

    const revokeApprovalGrant = useCallback(async (grantId) => {
        const revokedAt = Date.now();

        try {
            await revokeStoredAgentBridgeApprovalGrant(grantId, revokedAt);
            clientRef.current?.sendApprovalGrantRevocation(grantId, revokedAt);
            await refreshApprovalGrants();
        } catch {
            setApprovalGrantError('Unable to revoke the trusted approval grant.');
        }
    }, [refreshApprovalGrants]);

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
        closeClient();
    }, [closeClient, resolvePendingApproval]);

    useEffect(() => {
        if (typeof globalThis.indexedDB === 'undefined') {
            return;
        }

        void refreshApprovalGrants();
    }, [refreshApprovalGrants]);

    const value = useMemo(() => ({
        status,
        session,
        error,
        lastConnectedAt,
        lastActivity,
        currentActivity,
        activityHistory,
        pendingApproval,
        agentAccessEnabled,
        approvalGrants,
        approvalGrantError,
        connect,
        disconnect,
        revoke,
        createApprovalGrant,
        revokeApprovalGrant,
        setAgentAccessState,
        resolvePendingApproval,
    }), [
        status,
        session,
        error,
        lastConnectedAt,
        lastActivity,
        currentActivity,
        activityHistory,
        pendingApproval,
        agentAccessEnabled,
        approvalGrants,
        approvalGrantError,
        connect,
        disconnect,
        revoke,
        createApprovalGrant,
        revokeApprovalGrant,
        setAgentAccessState,
        resolvePendingApproval,
    ]);

    return (
        <AgentBridgeContext.Provider value={value}>
            {children}
            <AgentBridgeApprovalModal
                pendingApproval={pendingApproval}
                onResolve={resolvePendingApproval}
            />
        </AgentBridgeContext.Provider>
    );
}

AgentBridgeProvider.propTypes = {
    children: PropTypes.node.isRequired,
    verifyApprovalToken: PropTypes.func,
};

export function useAgentBridge() {
    const context = useContext(AgentBridgeContext);

    if (!context) {
        throw new Error('useAgentBridge must be used within an AgentBridgeProvider');
    }

    return context;
}

function AgentBridgeApprovalModal({ pendingApproval, onResolve }) {
    const footer = (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
                variant="outline"
                onClick={() => onResolve(false)}
            >
                Deny
            </Button>
            <Button onClick={() => onResolve(true)}>
                Approve
            </Button>
        </div>
    );

    return (
        <Modal
            isOpen={Boolean(pendingApproval)}
            onClose={() => onResolve(false)}
            title="Agent Approval"
            description="A paired agent is requesting a sensitive action."
            size="md"
            footer={footer}
        >
            {pendingApproval && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">Sensitive command request</p>
                        <Badge variant="warning">Waiting</Badge>
                    </div>
                    <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
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
                            <span>{formatAgentBridgeTime(pendingApproval.expiresAt)}</span>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
}

AgentBridgeApprovalModal.propTypes = {
    pendingApproval: PropTypes.shape({
        command: PropTypes.string.isRequired,
        requestId: PropTypes.string.isRequired,
        expiresAt: PropTypes.number.isRequired,
    }),
    onResolve: PropTypes.func.isRequired,
};
