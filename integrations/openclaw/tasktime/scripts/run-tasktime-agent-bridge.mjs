#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bridgeCandidates = [
    new URL('../vendor/tasktime-agent-bridge.mjs', import.meta.url),
    new URL('../node_modules/@tasktimepro/agent-bridge/dist/tasktime-agent-bridge.mjs', import.meta.url),
    new URL('../../../../agent-bridge/dist/tasktime-agent-bridge.mjs', import.meta.url),
].map((url) => fileURLToPath(url));
const userArgs = process.argv.slice(2);
const bridgePath = bridgeCandidates.find((candidate) => existsSync(candidate));
const hasStatusFile = userArgs.includes('--status-file');
const effectiveArgs = hasStatusFile
    ? userArgs
    : [
        ...userArgs,
        '--status-file',
        resolve(__dirname, '../tasktime-agent-bridge.status.json'),
    ];

const command = bridgePath
    ? process.execPath
    : 'tasktime-agent-bridge';
const args = bridgePath
    ? [bridgePath, ...effectiveArgs]
    : effectiveArgs;
const child = spawn(command, args, {
    stdio: 'inherit',
});
const forwardedSignals = ['SIGINT', 'SIGTERM', 'SIGHUP'];

for (const signal of forwardedSignals) {
    process.once(signal, () => {
        if (child.exitCode === null && child.signalCode === null) {
            child.kill(signal);
        }
    });
}

child.on('error', (error) => {
    const message = `Failed to launch TaskTime Pro agent bridge: ${error.message}\n`;
    process.stderr.write(message);
    process.exitCode = 1;
});

child.on('exit', (code, signal) => {
    for (const forwardedSignal of forwardedSignals) {
        process.removeAllListeners(forwardedSignal);
    }

    if (signal) {
        process.kill(process.pid, signal);
        return;
    }

    process.exitCode = code ?? 0;
});
