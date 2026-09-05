export const PRODUCTION_MARKETING_ORIGIN = 'https://tasktime.pro';
export const PRODUCTION_APP_ORIGIN = 'https://app.tasktime.pro';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface TaskTimeOriginConfigInput {
    marketingOrigin?: string;
    appOrigin?: string;
    workerOrigin?: string | null;
    agentDocsOrigin?: string;
}

export interface TaskTimeOriginConfig {
    marketingOrigin: string;
    appOrigin: string;
    workerOrigin: string | null;
    agentDocsOrigin: string;
}

export interface AgentDocumentationUrls {
    llmsTxt: string;
    agentDocs: string;
    quickstart: string;
    security: string;
    tools: string;
    mcpToolsJson: string;
    skill: string;
    claude: string;
    openClaw: string;
    debugging: string;
}

export class TaskTimeOriginConfigurationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TaskTimeOriginConfigurationError';
    }
}

function isLoopbackHostname(hostname: string): boolean {
    if (LOOPBACK_HOSTS.has(hostname)) {
        return true;
    }

    const parts = hostname.split('.');

    return parts.length === 4
        && parts[0] === '127'
        && parts.every((part) => /^\d+$/u.test(part) && Number(part) <= 255);
}

/**
 * Parse a configuration value as one exact browser origin. Error messages do
 * not echo the value because configuration can accidentally contain credentials.
 */
export function parseExactWebOrigin(value: string, label: string): string {
    let parsed: URL;

    try {
        parsed = new URL(value);
    } catch {
        throw new TaskTimeOriginConfigurationError(`Invalid ${label} origin configuration.`);
    }

    const secureOrigin = parsed.protocol === 'https:';
    const explicitLoopbackOrigin = parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname);

    if (
        value.includes('*')
        || value !== parsed.origin
        || parsed.username !== ''
        || parsed.password !== ''
        || (!secureOrigin && !explicitLoopbackOrigin)
    ) {
        throw new TaskTimeOriginConfigurationError(`Invalid ${label} origin configuration.`);
    }

    return parsed.origin;
}

export function createTaskTimeOriginConfig(
    input: TaskTimeOriginConfigInput = {}
): TaskTimeOriginConfig {
    const marketingOrigin = parseExactWebOrigin(
        input.marketingOrigin ?? PRODUCTION_MARKETING_ORIGIN,
        'marketing'
    );
    const appOrigin = parseExactWebOrigin(
        input.appOrigin ?? PRODUCTION_APP_ORIGIN,
        'app'
    );
    const workerOrigin = input.workerOrigin
        ? parseExactWebOrigin(input.workerOrigin, 'Worker')
        : null;
    const agentDocsOrigin = parseExactWebOrigin(
        input.agentDocsOrigin ?? marketingOrigin,
        'agent documentation'
    );

    return {
        marketingOrigin,
        appOrigin,
        workerOrigin,
        agentDocsOrigin,
    };
}

export function createAgentDocumentationUrls(
    origin = PRODUCTION_MARKETING_ORIGIN
): AgentDocumentationUrls {
    origin = parseExactWebOrigin(origin, 'agent documentation');

    return {
        llmsTxt: `${origin}/llms.txt`,
        agentDocs: `${origin}/agents/`,
        quickstart: `${origin}/agents/quickstart/`,
        security: `${origin}/agents/security/`,
        tools: `${origin}/agents/tools/`,
        mcpToolsJson: `${origin}/agents/mcp-tools.json`,
        skill: `${origin}/agents/skill.md`,
        claude: `${origin}/agents/claude/`,
        openClaw: `${origin}/agents/openclaw/`,
        debugging: `${origin}/agents/debugging/`,
    };
}

export const DEFAULT_AGENT_DOCUMENTATION_URLS = createAgentDocumentationUrls();
