const SCHEDULE_URL = 'http://billing-worker:8787/__scheduled?cron=*%2F5%20*%20*%20*%20*';
const SCHEDULE_INTERVAL_MS = 5 * 60 * 1000;
const RETRY_INTERVAL_MS = 5 * 1000;
const REQUEST_TIMEOUT_MS = 15 * 1000;
const MAX_CONSECUTIVE_FAILURES = 12;

let stopped = false;
let releaseWait = null;

function stop() {
    stopped = true;
    releaseWait?.();
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);

function wait(delayMs) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            releaseWait = null;
            resolve();
        }, delayMs);
        releaseWait = () => {
            clearTimeout(timeout);
            releaseWait = null;
            resolve();
        };
    });
}

async function runSchedule() {
    const response = await fetch(SCHEDULE_URL, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error('LOCAL_SCHEDULE_FAILED');
    await response.body?.cancel();
}

async function main() {
    let consecutiveFailures = 0;
    while (!stopped) {
        let delayMs = SCHEDULE_INTERVAL_MS;
        try {
            await runSchedule();
            consecutiveFailures = 0;
        } catch {
            consecutiveFailures += 1;
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                throw new Error('Local Worker scheduled recovery remained unavailable.');
            }
            delayMs = RETRY_INTERVAL_MS;
        }
        if (!stopped) await wait(delayMs);
    }
}

main().catch((error) => {
    const message = error instanceof Error
        ? error.message
        : 'Local Worker scheduled recovery failed.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
});
