import { chmod } from 'node:fs/promises'

await chmod(new URL('../agent-bridge/dist/tasktime-agent-bridge.mjs', import.meta.url), 0o755)
