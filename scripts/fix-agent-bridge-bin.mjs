import { chmod, readFile, writeFile } from 'node:fs/promises'

const bridgeUrl = new URL('../agent-bridge/dist/tasktime-agent-bridge.mjs', import.meta.url)
const bridgeSource = await readFile(bridgeUrl, 'utf8')

await writeFile(bridgeUrl, bridgeSource.replace(/[ \t]+$/gm, ''))
await chmod(bridgeUrl, 0o755)
