import { getAgentToolCatalog } from '../../lib/agentTools.js';

export function GET() {
    return new Response(JSON.stringify(getAgentToolCatalog(), null, 2), {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
        },
    });
}
