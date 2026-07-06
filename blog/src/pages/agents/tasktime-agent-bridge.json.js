import { readFileSync } from 'node:fs';

export function GET() {
    const manifest = readFileSync(
        new URL('../../../../public/.well-known/tasktime-agent.json', import.meta.url),
        'utf8'
    );

    return new Response(manifest, {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
        },
    });
}
