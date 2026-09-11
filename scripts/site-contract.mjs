import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const inputPaths = [
    'src/agent/bridge/mcpTools.ts',
    'src/agent/commands/registry.ts',
    'agent-bridge/discovery/tasktime-agent.json',
    'src/config/origins.ts',
    'src/config/localReviewPricing.ts',
    'package.json',
    'scripts/site-contract.mjs',
];
const digest = value => createHash('sha256').update(value).digest('hex');

// These modules contain public constants and type-only imports. Compiling them
// avoids executing the command handlers, browser services, or application store.
async function loadConstants(relativePath) {
    const source = await readFile(path.join(root, relativePath), 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    });
    return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

export function readApprovalMetadata(source) {
    const file = ts.createSourceFile('registry.ts', source, ts.ScriptTarget.Latest, true);
    let registry;
    function visit(node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'AGENT_COMMAND_REGISTRY') {
            registry = node.initializer;
        }
        ts.forEachChild(node, visit);
    }
    visit(file);
    if (!registry || !ts.isObjectLiteralExpression(registry)) throw new Error('Unsupported command registry shape');
    return new Map(registry.properties.map(property => {
        if (!ts.isPropertyAssignment(property) || !ts.isObjectLiteralExpression(property.initializer)) {
            throw new Error('Unsupported command metadata shape');
        }
        if (property.initializer.properties.some(field => ts.isSpreadAssignment(field)
            || (field.name && ts.isComputedPropertyName(field.name)))) {
            throw new Error('Unsupported dynamic command metadata');
        }
        const approval = property.initializer.properties.find(field => field.name?.text === 'requiresApproval');
        if (approval && (!ts.isPropertyAssignment(approval)
            || ![ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(approval.initializer.kind))) {
            throw new Error('Approval metadata must be an explicit boolean');
        }
        return [property.name.getText(file).replace(/^['"]|['"]$/g, ''), approval?.initializer.kind === ts.SyntaxKind.TrueKeyword];
    }));
}

export async function createSiteContract() {
    const [toolModule, originModule, pricingModule, discovery, registry, packageJson] = await Promise.all([
        loadConstants(inputPaths[0]), loadConstants(inputPaths[3]), loadConstants(inputPaths[4]),
        readFile(path.join(root, inputPaths[2]), 'utf8').then(JSON.parse),
        readFile(path.join(root, inputPaths[1]), 'utf8'),
        readFile(path.join(root, 'package.json'), 'utf8').then(JSON.parse),
    ]);
    const approvals = readApprovalMetadata(registry);
    const tools = toolModule.MCP_TOOL_DEFINITIONS.map(tool => {
        if (!approvals.has(tool.name)) throw new Error(`Tool has no command metadata: ${tool.name}`);
        return { ...tool, requiresApproval: approvals.get(tool.name) };
    });
    const payload = {
        appVersion: packageJson.version,
        origins: { app: originModule.PRODUCTION_APP_ORIGIN, site: originModule.PRODUCTION_MARKETING_ORIGIN },
        discovery,
        tools,
        // This is explicitly a local review fixture, never a live offer catalog.
        pricing: { status: 'review-only', values: pricingModule.LOCAL_REVIEW_PRICING },
    };
    const git = args => execFileSync('git', ['-c', `safe.directory=${root.replace(/\/$/, '')}`, ...args], { cwd: root, encoding: 'utf8' }).trim();
    const inputsSha256 = digest((await Promise.all(inputPaths.map(async file => `${file}\0${await readFile(path.join(root, file), 'utf8')}`))).join('\0'));
    return {
        schemaVersion: 1,
        source: {
            repository: 'https://github.com/tasktimepro/tasktime',
            commit: git(['rev-parse', 'HEAD']),
            inputsSha256,
            dirty: Boolean(git(['status', '--porcelain', '--', ...inputPaths])),
        },
        sha256: digest(JSON.stringify(payload)),
        payload,
    };
}

export async function checkSiteContract(target) {
    const snapshot = JSON.parse(await readFile(target, 'utf8'));
    const current = await createSiteContract();
    if (snapshot.schemaVersion !== 1 || snapshot.sha256 !== digest(JSON.stringify(snapshot.payload))) {
        throw new Error('Invalid site contract schema or checksum');
    }
    if (snapshot.sha256 !== current.sha256) throw new Error('Site contract is stale; explicitly export and review an updated snapshot');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
    const [mode, target] = process.argv.slice(2);
    if (!['--output', '--check'].includes(mode) || !target) throw new Error('Usage: site-contract.mjs --output <file> | --check <file>');
    if (mode === '--check') {
        await checkSiteContract(target);
    } else {
        await mkdir(path.dirname(path.resolve(target)), { recursive: true });
        await writeFile(target, `${JSON.stringify(await createSiteContract(), null, 2)}\n`);
    }
}
