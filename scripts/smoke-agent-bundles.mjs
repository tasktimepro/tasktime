import { spawn } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = await mkdtemp(path.join(tmpdir(), 'tasktime-agent-bundles-'))

const bundles = [
  {
    name: 'OpenClaw',
    root: path.join(repoRoot, 'integrations/openclaw/tasktime'),
    expectedAgentId: 'tasktime.agent.openclaw',
    expectedAgentLabel: 'OpenClaw on this device',
  },
  {
    name: 'Claude Code',
    root: path.join(repoRoot, 'integrations/claude/tasktime'),
    expectedAgentId: 'tasktime.agent.claude-code',
    expectedAgentLabel: 'Claude Code on this device',
  },
]

try {
  await assertOpenClawNativePlugin()

  for (const bundle of bundles) {
    await assertBundleStartsManagedBridge(bundle)
  }

  console.log('TaskTime Pro managed agent bundle smoke test passed.')
} finally {
  await rm(tempDir, { force: true, recursive: true })
}

async function assertOpenClawNativePlugin() {
  const packageRoot = path.join(repoRoot, 'integrations/openclaw/tasktime')
  const packageJson = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'))
  const manifest = JSON.parse(await readFile(path.join(packageRoot, 'openclaw.plugin.json'), 'utf8'))
  const runtime = await import(pathToFileURL(path.join(packageRoot, 'dist/index.js')).href)
  const distFiles = await readdir(path.join(packageRoot, 'dist'))
  const services = []
  const tools = []
  const logged = []

  assert(packageJson.openclaw?.extensions?.includes('./dist/index.js'), 'OpenClaw package did not declare its native runtime entry')
  assert(JSON.stringify(distFiles.sort()) === JSON.stringify(['index.js']), 'OpenClaw native plugin dist contains unrelated app or runtime artifacts')
  assert(manifest.activation?.onStartup === true, 'OpenClaw native plugin must activate at Gateway startup')
  assert(manifest.skills?.includes('./skills'), 'OpenClaw native plugin did not retain its skill directory')
  assert(JSON.stringify(manifest.contracts?.tools) === JSON.stringify(runtime.OPENCLAW_TOOL_CONTRACT_NAMES), 'OpenClaw native tool contracts drifted from generated definitions')
  assert(existsSync(path.join(packageRoot, '.mcp.json')), 'OpenClaw package lost its generic compatibility bundle')

  runtime.default.register({
    config: {},
    pluginConfig: {
      scopes: ['read', 'write', 'billing', 'export', 'email', 'navigation'],
    },
    logger: {
      debug: (message) => logged.push(String(message)),
      info: (message) => logged.push(String(message)),
      warn: (message) => logged.push(String(message)),
      error: (message) => logged.push(String(message)),
    },
    registerService: (service) => services.push(service),
    registerTool: (tool) => tools.push(tool),
  })

  assert(services.length === 1, 'OpenClaw native plugin did not register exactly one bridge service')
  assert(tools.length === manifest.contracts.tools.length, 'OpenClaw native plugin did not register every configured generated tool')

  const service = services[0]
  await service.start({
    stateDir: tempDir,
    config: {},
    logger: {},
  })

  try {
    const pairingTool = tools.find((tool) => tool.name === 'tasktime__get_pairing_status')
    assert(pairingTool, 'OpenClaw native plugin did not register tasktime__get_pairing_status')
    const first = await pairingTool.execute('native-status-1', {})
    const second = await pairingTool.execute('native-status-2', {})
    assert(first.isError === false, 'OpenClaw native setup tool failed before browser pairing')
    assert(first.details?.data?.launchUrl?.includes('https://tasktime.pro/account?'), 'OpenClaw native setup tool did not return an ephemeral launch URL')
    assert(first.details?.data?.pid === second.details?.data?.pid, 'OpenClaw native plugin replaced the bridge child between tool calls')
    assert(first.details?.data?.bridgeInstanceId === second.details?.data?.bridgeInstanceId, 'OpenClaw native plugin replaced the bridge instance between tool calls')
    assert(!logged.some((message) => /agentBridgePairingCode|Pairing code:/i.test(message)), 'OpenClaw native plugin copied pairing credentials into Gateway logs')
  } finally {
    await service.stop({})
  }
}

async function assertBundleStartsManagedBridge(bundle) {
  const launcherSource = await readFile(path.join(bundle.root, 'scripts/run-tasktime-agent-bridge.mjs'), 'utf8')
  assert(!launcherSource.includes('tasktime-agent-bridge.log'), `${bundle.name} launcher still persists raw bridge stderr`)
  assert(!launcherSource.includes('createWriteStream'), `${bundle.name} launcher still opens a persistent stderr log`)

  const config = JSON.parse(await readFile(path.join(bundle.root, '.mcp.json'), 'utf8'))
  const server = config.mcpServers?.tasktime

  assert(server, `${bundle.name} .mcp.json did not define mcpServers.tasktime`)
  assert(server.command === 'node', `${bundle.name} MCP command should use node`)

  const statusFile = path.join(tempDir, `${slugify(bundle.name)}.status.json`)
  const args = server.args.map((arg) => arg.replaceAll('${CLAUDE_PLUGIN_ROOT}', bundle.root))

  args.push(
    '--pairing-ttl-ms',
    '60000',
    '--command-timeout-ms',
    '500',
    '--status-file',
    statusFile
  )

  const child = spawn(process.execPath, args, {
    cwd: bundle.root,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stderr = ''
  let stdoutBuffer = ''
  const stdoutLines = []
  const stdoutWaiters = []

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8')
  })

  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString('utf8')

    while (stdoutBuffer.includes('\n')) {
      const newlineIndex = stdoutBuffer.indexOf('\n')
      const line = stdoutBuffer.slice(0, newlineIndex).trim()
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1)

      if (!line) {
        continue
      }

      const waiter = stdoutWaiters.shift()
      if (waiter) {
        waiter(line)
      } else {
        stdoutLines.push(line)
      }
    }
  })

  try {
    const status = await waitForStatusFile(statusFile, child, () => stderr)

    assert(status.agent?.id === bundle.expectedAgentId, `${bundle.name} status file reported wrong agent id`)
    assert(status.agent?.label === bundle.expectedAgentLabel, `${bundle.name} status file reported wrong agent label`)
    assert(status.endpoint?.startsWith('ws://127.0.0.1:'), `${bundle.name} status file did not include loopback endpoint`)
    assert(status.schemaVersion === 2, `${bundle.name} status file did not use the non-secret discovery schema`)
    assert(!('launchUrl' in status), `${bundle.name} status file persisted a pairing launch URL`)
    assert(!('id' in status.pairing), `${bundle.name} status file persisted a pairing id`)
    assert(!('code' in status.pairing), `${bundle.name} status file persisted a pairing code`)
    assert(status.session?.paired === false, `${bundle.name} should start without a paired browser session`)

    writeJsonRpc(child, 'tools', 'tools/list')
    const toolsResponse = JSON.parse(await readStdoutLine(stdoutLines, stdoutWaiters, () => stderr))
    const toolNames = toolsResponse.result?.tools?.map((tool) => tool.name) ?? []

    assert(toolNames.includes('get_pairing_status'), `${bundle.name} tools/list did not expose get_pairing_status`)
    assert(toolNames.includes('refresh_pairing'), `${bundle.name} tools/list did not expose refresh_pairing`)

    writeJsonRpc(child, 'pairing-status', 'tools/call', {
      name: 'get_pairing_status',
      arguments: {},
    })
    const pairingStatusResponse = JSON.parse(await readStdoutLine(stdoutLines, stdoutWaiters, () => stderr))
    const pairingStatus = pairingStatusResponse.result?.structuredContent?.data

    assert(pairingStatus?.agent?.id === bundle.expectedAgentId, `${bundle.name} get_pairing_status reported wrong agent id`)
    assert(pairingStatus?.launchUrl?.includes('https://tasktime.pro/account?'), `${bundle.name} get_pairing_status did not include an ephemeral launch URL`)
    const launchUrl = new URL(pairingStatus.launchUrl)
    assert(launchUrl.searchParams.get('agentBridgeAgentId') === bundle.expectedAgentId, `${bundle.name} launch URL did not include stable agent id`)
    assert(launchUrl.searchParams.get('agentBridgeAgentLabel') === bundle.expectedAgentLabel, `${bundle.name} launch URL did not include stable agent label`)
  } finally {
    child.kill('SIGTERM')
    await waitForExit(child)
    child.stdin?.destroy()
    child.stdout?.destroy()
    child.stderr?.destroy()
  }
}

function writeJsonRpc(child, id, method, params) {
  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id,
    method,
    params,
  })}\n`)
}

async function waitForStatusFile(statusFile, child, getStderr) {
  const deadline = Date.now() + 5000

  while (Date.now() < deadline) {
    if (existsSync(statusFile)) {
      return JSON.parse(await readFile(statusFile, 'utf8'))
    }

    if (child.exitCode !== null) {
      throw new Error(`Bundle bridge exited before writing status file.\n${getStderr()}`)
    }

    await delay(25)
  }

  throw new Error(`Timed out waiting for bundle status file.\n${getStderr()}`)
}

function readStdoutLine(stdoutLines, stdoutWaiters, getStderr) {
  const line = stdoutLines.shift()

  if (line) {
    return Promise.resolve(line)
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for bundle stdout.\nstderr:\n${getStderr()}`))
    }, 2000)

    stdoutWaiters.push((value) => {
      clearTimeout(timeout)
      resolve(value)
    })
  })
}

function waitForExit(child) {
  if (child.exitCode !== null) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    child.once('exit', () => resolve())
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGKILL')
      }
      resolve()
    }, 1000)
  })
}

function slugify(value) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}
