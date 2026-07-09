import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { Socket } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const bridgePath = new URL('../agent-bridge/dist/tasktime-agent-bridge.mjs', import.meta.url)

await assertSymlinkManifestWorks()

const child = spawn(process.execPath, [
  bridgePath.pathname,
  '--origin',
  'http://localhost:3101',
  '--pairing-ttl-ms',
  '60000',
  '--command-timeout-ms',
  '500',
], {
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
  const endpoint = await waitForEndpoint()

  await assertInvalidPairingRejected(endpoint)

  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: 'tools',
    method: 'tools/list',
  })}\n`)

  const toolsResponse = JSON.parse(await readStdoutLine())
  assert(toolsResponse.result?.tools?.some((tool) => tool.name === 'get_dashboard_summary'), 'tools/list did not include get_dashboard_summary')
  assert(toolsResponse.result?.tools?.some((tool) => tool.name === 'get_pairing_status'), 'tools/list did not include get_pairing_status')
  assert(toolsResponse.result?.tools?.some((tool) => tool.name === 'refresh_pairing'), 'tools/list did not include refresh_pairing')
  assert(!toolsResponse.result?.tools?.some((tool) => tool.name === 'finalize_invoice'), 'default bridge scopes must not expose finalize_invoice')
  assert(!toolsResponse.result?.tools?.some((tool) => tool.name === 'mark_invoice_paid'), 'default bridge scopes must not expose mark_invoice_paid')

  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: 'pairing-status',
    method: 'tools/call',
    params: {
      name: 'get_pairing_status',
      arguments: {},
    },
  })}\n`)

  const statusResponse = JSON.parse(await readStdoutLine())
  assert(statusResponse.result?.structuredContent?.data?.endpoint, 'get_pairing_status did not return an endpoint')
  assert(statusResponse.result?.structuredContent?.data?.session?.paired === false, 'get_pairing_status should report no paired session before browser pairing')

  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id: 'call-before-pairing',
    method: 'tools/call',
    params: {
      name: 'get_dashboard_summary',
      arguments: {},
    },
  })}\n`)

  const callResponse = JSON.parse(await readStdoutLine())
  assert(callResponse.result?.isError === true, 'tools/call before pairing should be an MCP tool error')
  assert(
    callResponse.result?.structuredContent?.error?.code === 'UNAVAILABLE',
    'tools/call before pairing should report UNAVAILABLE'
  )

  console.log('TaskTime Pro agent bridge smoke test passed.')
} finally {
  child.kill('SIGTERM')
  await waitForExit()
}

async function waitForEndpoint() {
  const deadline = Date.now() + 5000

  while (Date.now() < deadline) {
    const match = stderr.match(/App endpoint:\s+(ws:\/\/[^\s]+)/)

    if (match) {
      return new URL(match[1])
    }

    if (child.exitCode !== null) {
      throw new Error(`Bridge exited before printing endpoint.\n${stderr}`)
    }

    await delay(25)
  }

  throw new Error(`Timed out waiting for bridge endpoint.\n${stderr}`)
}

async function assertInvalidPairingRejected(endpoint) {
  const response = await websocketHandshake(endpoint, 'bad-pairing', 'bad-code')

  assert(response.startsWith('HTTP/1.1 403'), `Expected invalid pairing to return 403, got: ${response.split('\r\n')[0]}`)
}

function websocketHandshake(endpoint, pairingId, pairingCode) {
  return new Promise((resolve, reject) => {
    const socket = new Socket()
    let buffer = Buffer.alloc(0)
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error('Timed out waiting for invalid pairing handshake response.'))
    }, 1000)

    socket.on('error', reject)
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])

      if (buffer.includes('\r\n\r\n')) {
        clearTimeout(timeout)
        socket.destroy()
        resolve(buffer.toString('utf8'))
      }
    })

    socket.connect(Number(endpoint.port), endpoint.hostname, () => {
      const path = `${endpoint.pathname}?pairingId=${encodeURIComponent(pairingId)}&pairingCode=${encodeURIComponent(pairingCode)}`
      socket.write([
        `GET ${path} HTTP/1.1`,
        `Host: ${endpoint.host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Origin: http://localhost:3101',
        `Sec-WebSocket-Key: ${randomBytes(16).toString('base64')}`,
        'Sec-WebSocket-Version: 13',
        '',
        '',
      ].join('\r\n'))
    })
  })
}

function readStdoutLine() {
  const line = stdoutLines.shift()

  if (line) {
    return Promise.resolve(line)
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for bridge stdout.\nstderr:\n${stderr}`))
    }, 2000)

    stdoutWaiters.push((value) => {
      clearTimeout(timeout)
      resolve(value)
    })
  })
}

function waitForExit() {
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function assertSymlinkManifestWorks() {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'tasktime-agent-bridge-'))
  const symlinkPath = path.join(tempDir, 'tasktime-agent-bridge')

  try {
    await symlink(bridgePath.pathname, symlinkPath)

    const result = spawnSync(symlinkPath, ['--manifest'], {
      encoding: 'utf8',
    })

    assert(result.status === 0, `Symlink manifest command failed.\nstderr:\n${result.stderr}`)
    assert(JSON.parse(result.stdout).bridge?.binary === 'tasktime-agent-bridge', 'Symlink manifest output was invalid.')
  } finally {
    await rm(tempDir, { force: true, recursive: true })
  }
}
