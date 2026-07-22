import { readFile, writeFile } from 'node:fs/promises';

const packageRoot = new URL('../integrations/openclaw/tasktime/', import.meta.url);
const manifestUrl = new URL('openclaw.plugin.json', packageRoot);
const runtime = await import(new URL('dist/index.js', packageRoot));
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));

manifest.contracts = {
    ...manifest.contracts,
    tools: runtime.OPENCLAW_TOOL_CONTRACT_NAMES,
};

await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
