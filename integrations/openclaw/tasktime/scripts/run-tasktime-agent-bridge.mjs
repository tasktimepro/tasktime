#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bridgeCandidates = [
    new URL('../vendor/tasktime-agent-bridge.mjs', import.meta.url),
    new URL('../node_modules/@tasktimepro/agent-bridge/dist/tasktime-agent-bridge.mjs', import.meta.url),
    new URL('../../../../agent-bridge/dist/tasktime-agent-bridge.mjs', import.meta.url),
].map((url) => fileURLToPath(url));
const userArgs = process.argv.slice(2);
const bridgePath = bridgeCandidates.find((candidate) => existsSync(candidate));

const command = bridgePath
    ? process.execPath
    : 'tasktime-agent-bridge';
const args = bridgePath
    ? [bridgePath, ...userArgs]
    : userArgs;

const child = spawn(command, args, {
    stdio: 'inherit',
});

child.on('error', (error) => {
    console.error(`Failed to launch TaskTime Pro agent bridge: ${error.message}`);
    process.exitCode = 1;
});

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }

    process.exitCode = code ?? 0;
});
