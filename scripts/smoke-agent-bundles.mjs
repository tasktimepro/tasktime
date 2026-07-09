import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
  for (const bundle of bundles) {
    await assertBundleStartsManagedBridge(bundle)
  }

  console.log('TaskTime Pro managed agent bundle smoke test passed.')
} finally {
  await rm(tempDir, { force: true, recursive: true })
}

async function assertBundleStartsManagedBridge(bundle) {
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
    assert(status.launchUrl?.includes('https://tasktime.pro/account?'), `${bundle.name} status file did not include launch URL`)
    const launchUrl = new URL(status.launchUrl)
    assert(launchUrl.searchParams.get('agentBridgeAgentId') === bundle.expectedAgentId, `${bundle.name} launch URL did not include stable agent id`)
    assert(launchUrl.searchParams.get('agentBridgeAgentLabel') === bundle.expectedAgentLabel, `${bundle.name} launch URL did not include stable agent label`)
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
    assert(pairingStatus?.launchUrl === status.launchUrl, `${bundle.name} get_pairing_status did not match status file launch URL`)
  } finally {
    child.kill('SIGTERM')
    await waitForExit(child)
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
