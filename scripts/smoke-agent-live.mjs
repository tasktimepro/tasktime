import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from '@playwright/test'

const bridgePath = new URL('../agent-bridge/dist/tasktime-agent-bridge.mjs', import.meta.url)
const baseUrl = process.env.TASKTIME_AGENT_LIVE_BASE_URL || 'http://127.0.0.1:3101'
const appOrigin = new URL(baseUrl).origin
const host = process.env.TASKTIME_AGENT_LIVE_HOST || new URL(baseUrl).hostname || '127.0.0.1'
const port = process.env.TASKTIME_AGENT_LIVE_PORT || new URL(baseUrl).port || '3101'
const shouldStartApp = process.env.TASKTIME_AGENT_LIVE_START_APP !== '0'
const testStamp = Date.now()
const clientTitle = `Agent Live Client ${testStamp}`
const projectTitle = `Agent Live Smoke ${testStamp}`
const taskTitle = `MCP timer smoke ${testStamp}`
const invoiceProjectTitle = `Agent Invoice Smoke ${testStamp}`
const invoiceTaskTitle = `Invoiceable MCP work ${testStamp}`
const processes = []
let nextRpcId = 1
let browser

if (!existsSync(bridgePath)) {
  throw new Error('Agent bridge bundle not found. Run npm run build:agent-bridge before smoke:agent-live.')
}

try {
  if (shouldStartApp) {
    log('starting Vite app server')
    const vite = spawnProcess('vite', 'npm', ['run', 'dev', '--', '--host', host, '--port', port])
    vite.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`))
    vite.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`))
  }

  await waitForHttp(baseUrl)
  log(`app server is reachable at ${baseUrl}`)

  log('starting packaged MCP bridge')
  const bridge = spawnProcess('bridge', process.execPath, [
    bridgePath.pathname,
    '--origin',
    appOrigin,
    '--origin',
    'http://localhost:3101',
    '--app-url',
    baseUrl,
    '--scopes',
    'read,write,navigation,billing,export,email',
    '--pairing-ttl-ms',
    '120000',
    '--command-timeout-ms',
    '30000',
  ])
  const bridgeLines = collectLines(bridge)
  const challenge = await waitForBridgeChallenge(bridgeLines)
  log(`bridge challenge ready at ${challenge.endpoint}`)

  await assertToolExposure(bridgeLines, bridge)
  await assertUnavailableBeforePairing(bridgeLines, bridge)

  browser = await chromium.launch({
    executablePath: findChromiumExecutable(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('tasktime-onboarding-completed', 'true')
    localStorage.removeItem('tasktime-onboarding-pending')
  })

  const page = await context.newPage()
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      console.log(`[browser:${message.type()}] ${message.text()}`)
    }
  })

  await pairBrowserSession(page, challenge)
  await waitForPairedBridge(bridgeLines, bridge)

  const projectResult = await callTool(bridgeLines, bridge, 'create_project', {
    title: projectTitle,
    isPersonal: true,
    taskView: 'kanban',
    idempotencyKey: `project-${testStamp}`,
  })
  const projectId = entityId(projectResult, 'project')
  assert(projectId, `create_project did not return a project id: ${JSON.stringify(projectResult)}`)
  log(`created project ${projectId}`)

  const taskResult = await callTool(bridgeLines, bridge, 'create_task', {
    title: taskTitle,
    projectId,
    billable: false,
    note: 'Created by live MCP smoke',
    idempotencyKey: `task-${testStamp}`,
  })
  const taskId = entityId(taskResult, 'task')
  assert(taskId, `create_task did not return a task id: ${JSON.stringify(taskResult)}`)
  log(`created task ${taskId}`)

  await assertNavigation(bridgeLines, bridge, page, projectId, projectTitle)

  const timerStart = await callTool(bridgeLines, bridge, 'start_timer', {
    taskId,
    note: 'Live MCP smoke timer',
    idempotencyKey: `timer-${testStamp}`,
  })
  const timerKey = payload(timerStart).timer?.timerKey || payload(timerStart).timerKey || projectId
  log(`started timer ${timerKey}`)

  await assertActiveTimer(bridgeLines, bridge, { projectId, taskId, timerKey, isPaused: false })

  const updatedTimer = await callTool(bridgeLines, bridge, 'update_timer', {
    taskId,
    note: 'Live MCP smoke timer updated',
  })
  assert(payload(updatedTimer).note === 'Live MCP smoke timer updated', 'update_timer did not update the timer note')
  log('updated active timer note')

  const pausedTimer = await callTool(bridgeLines, bridge, 'pause_timer', { taskId })
  assert(payload(pausedTimer).paused === true, 'pause_timer did not return a paused timer')
  await assertActiveTimer(bridgeLines, bridge, { projectId, taskId, timerKey, isPaused: true })
  log('paused timer and verified paused state')

  const resumedTimer = await callTool(bridgeLines, bridge, 'resume_timer', { taskId })
  assert(payload(resumedTimer).paused === false, 'resume_timer did not return a running timer')
  await assertActiveTimer(bridgeLines, bridge, { projectId, taskId, timerKey, isPaused: false })
  log('resumed timer and verified running state')

  await delay(1250)
  const stopped = await callTool(bridgeLines, bridge, 'stop_timer', { taskId }, 20000)
  const entry = payload(stopped).entry || payload(stopped).timeEntry || payload(stopped)
  const entryId = entry.id
  assert(entryId, `stop_timer did not return an entry id: ${JSON.stringify(stopped)}`)
  assert(entry.taskId === taskId, `stop_timer entry task mismatch: ${JSON.stringify(stopped)}`)
  assert(entry.end > entry.start, `stop_timer entry timing invalid: ${JSON.stringify(stopped)}`)
  log(`stopped timer and created entry ${entryId}`)

  const activeAfterStop = await callTool(bridgeLines, bridge, 'get_active_timers')
  const timersAfterStop = listFromResult(activeAfterStop, 'timers')
  assert(!timersAfterStop.some((timer) => timer.taskId === taskId || timer.projectId === projectId), 'timer remained active after stop_timer')

  const entriesResult = await callTool(bridgeLines, bridge, 'list_recent_entries', {
    taskId,
    limit: 10,
  })
  const entries = listFromResult(entriesResult, 'entries')
  assert(entries.some((candidate) => candidate.id === entryId), `created entry not found in list_recent_entries: ${JSON.stringify(entriesResult)}`)
  log('verified created time entry through MCP')

  await assertNavigation(bridgeLines, bridge, page, projectId, projectTitle)
  await page.getByText(taskTitle).waitFor({ timeout: 15000 })
  log('verified throwaway project/task render in the UI')

  const invoiceSmoke = await runInvoiceLiveSmoke({
    lines: bridgeLines,
    bridge,
    page,
  })

  console.log(JSON.stringify({
    ok: true,
    projectId,
    taskId,
    entryId,
    projectTitle,
    taskTitle,
    invoiceSmoke,
  }, null, 2))
  console.log('TaskTime Pro live agent MCP smoke test passed.')
} finally {
  if (browser) {
    await browser.close().catch(() => {})
  }

  for (const { child } of processes.reverse()) {
    if (child.exitCode === null) {
      child.kill('SIGTERM')
    }
  }

  await delay(500)

  for (const { child } of processes.reverse()) {
    if (child.exitCode === null) {
      child.kill('SIGKILL')
    }
  }
}

function log(message) {
  console.log(`[live-agent-smoke] ${message}`)
}

function payload(result) {
  return result?.data ?? result
}

function entityId(result, key) {
  const body = payload(result)

  return body?.[key]?.id || body?.id
}

function listFromResult(result, key) {
  const body = payload(result)

  if (Array.isArray(body)) {
    return body
  }

  return Array.isArray(body?.[key]) ? body[key] : []
}

function spawnProcess(name, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  })

  processes.push({ name, child })

  child.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
      console.error(`[${name}] exited with code=${code} signal=${signal}`)
    }
  })

  return child
}

async function waitForHttp(url, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs
  let lastError

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)

      if (response.ok) {
        return
      }

      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }

    await delay(250)
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || 'unknown error'}`)
}

function collectLines(child) {
  let stdout = ''
  let stderr = ''
  const stdoutLines = []
  const stdoutWaiters = []

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString('utf8')

    while (stdout.includes('\n')) {
      const index = stdout.indexOf('\n')
      const line = stdout.slice(0, index).trim()
      stdout = stdout.slice(index + 1)

      if (!line) {
        continue
      }

      const waiter = stdoutWaiters.shift()

      if (waiter) {
        waiter.resolve(line)
      } else {
        stdoutLines.push(line)
      }
    }
  })

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8')
  })

  return {
    get stderr() {
      return stderr
    },
    async readLine(timeoutMs = 5000) {
      const line = stdoutLines.shift()

      if (line) {
        return line
      }

      return new Promise((resolve, reject) => {
        const waiter = { resolve: null }
        const timeout = setTimeout(() => {
          const index = stdoutWaiters.indexOf(waiter)

          if (index >= 0) {
            stdoutWaiters.splice(index, 1)
          }

          reject(new Error(`Timed out waiting for bridge stdout. stderr:\n${stderr}`))
        }, timeoutMs)

        waiter.resolve = (value) => {
          clearTimeout(timeout)
          resolve(value)
        }

        stdoutWaiters.push(waiter)
      })
    },
  }
}

async function waitForBridgeChallenge(lines, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const text = lines.stderr
    const endpoint = text.match(/App endpoint:\s+(ws:\/\/[^\s]+)/)?.[1]
    const pairingId = text.match(/Pairing ID:\s+([^\s]+)/)?.[1]
    const pairingCode = text.match(/Pairing code:\s+([^\s]+)/)?.[1]

    if (endpoint && pairingId && pairingCode) {
      return { endpoint, pairingId, pairingCode }
    }

    await delay(50)
  }

  throw new Error(`Timed out waiting for bridge challenge. stderr:\n${lines.stderr}`)
}

async function rpc(lines, child, method, params, timeoutMs = 15000) {
  const id = `live-${nextRpcId++}`

  child.stdin.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id,
    method,
    params,
  })}\n`)

  const response = JSON.parse(await lines.readLine(timeoutMs))

  if (response.id !== id) {
    throw new Error(`Unexpected RPC id. wanted ${id}, got ${response.id}. response=${JSON.stringify(response)}`)
  }

  if (response.error) {
    throw new Error(`RPC ${method} failed: ${JSON.stringify(response.error)}`)
  }

  return response.result
}

async function callTool(lines, bridge, name, args = {}, timeoutMs = 20000) {
  const result = await rpc(lines, bridge, 'tools/call', {
    name,
    arguments: args,
  }, timeoutMs)

  if (result.isError) {
    throw new Error(`Tool ${name} failed: ${JSON.stringify(result.structuredContent || result.content || result)}`)
  }

  return result.structuredContent ?? result
}

async function assertToolExposure(lines, bridge) {
  const response = await rpc(lines, bridge, 'tools/list')
  const toolNames = new Set(response.tools?.map((tool) => tool.name) || [])

  for (const toolName of [
    'create_project',
    'create_client',
    'create_task',
    'add_manual_time_entry',
    'start_timer',
    'pause_timer',
    'resume_timer',
    'update_timer',
    'stop_timer',
    'list_recent_entries',
    'find_unbilled_time',
    'open_project_view',
    'preview_invoice_from_unbilled_work',
    'create_invoice_draft',
    'finalize_invoice',
    'export_invoice_pdf',
    'send_invoice_email',
  ]) {
    assert(toolNames.has(toolName), `tools/list did not expose ${toolName}`)
  }

  log('validated MCP tool exposure for agent release scopes')
}

async function assertUnavailableBeforePairing(lines, bridge) {
  const result = await rpc(lines, bridge, 'tools/call', {
    name: 'list_projects',
    arguments: {},
  })

  assert(result.isError === true, 'tools/call before pairing should be an MCP tool error')
  assert(result.structuredContent?.error?.code === 'UNAVAILABLE', 'tools/call before pairing should report UNAVAILABLE')
  assert(result.structuredContent?.error?.details?.recovery?.action === 'launch_tasktime', 'UNAVAILABLE response should include launch_tasktime recovery hint')
  log('validated pre-pairing UNAVAILABLE recovery response')
}

async function pairBrowserSession(page, challenge) {
  const url = new URL('/account', baseUrl)
  url.searchParams.set('section', 'agent')
  url.searchParams.set('agentBridgeEndpoint', challenge.endpoint)
  url.searchParams.set('agentBridgePairingId', challenge.pairingId)
  url.searchParams.set('agentBridgePairingCode', challenge.pairingCode)

  log('opening Agent Access pairing URL')
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Agent Access' }).waitFor({ timeout: 30000 })

  const checkbox = page.getByLabel('Enable local agent access')

  if (!(await checkbox.isChecked())) {
    await checkbox.check()
  }

  await page.getByRole('button', { name: /^(Approve & Connect|Connect)$/ }).click()
}

async function waitForPairedBridge(lines, bridge) {
  log('waiting for MCP calls to become available after browser pairing')

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await callTool(lines, bridge, 'list_projects', {}, 5000)
      log('paired MCP list_projects succeeded')
      return
    } catch (error) {
      const message = String(error.message)

      if (!message.includes('UNAVAILABLE') && !message.includes('not paired')) {
        throw error
      }
    }

    await delay(250)
  }

  throw new Error('Bridge did not become available after pairing.')
}

async function assertNavigation(lines, bridge, page, projectId, expectedTitle) {
  const result = await callTool(lines, bridge, 'open_project_view', { projectId })
  const route = payload(result).route || payload(result).path

  assert(route === `/projects/${projectId}`, `open_project_view returned an unexpected route: ${JSON.stringify(result)}`)
  await page.waitForURL(`**/projects/${projectId}`, { timeout: 15000 })
  await page.getByText(expectedTitle).waitFor({ timeout: 15000 })
  log('validated navigation command against the live browser session')
}

async function assertActiveTimer(lines, bridge, { projectId, taskId, timerKey, isPaused }) {
  const activeTimers = await callTool(lines, bridge, 'get_active_timers')
  const timers = listFromResult(activeTimers, 'timers')
  const timer = timers.find((candidate) => (
    candidate.taskId === taskId
    || candidate.timerKey === timerKey
    || candidate.projectId === projectId
  ))

  assert(timer, `active timer not found: ${JSON.stringify(activeTimers)}`)
  assert(timer.isPaused === isPaused, `active timer paused state mismatch: ${JSON.stringify(timer)}`)
}

async function runInvoiceLiveSmoke({ lines, bridge, page }) {
  const clientResult = await callTool(lines, bridge, 'create_client', {
    title: clientTitle,
    email: `agent-live-${testStamp}@example.invalid`,
    defaultHourlyRate: 150,
    defaultCurrency: 'USD',
    idempotencyKey: `client-${testStamp}`,
  })
  const clientId = entityId(clientResult, 'client')
  assert(clientId, `create_client did not return a client id: ${JSON.stringify(clientResult)}`)
  log(`created client ${clientId}`)

  const projectResult = await callTool(lines, bridge, 'create_project', {
    title: invoiceProjectTitle,
    preferredClientId: clientId,
    isPersonal: false,
    hourlyRate: 150,
    flatRate: false,
    idempotencyKey: `invoice-project-${testStamp}`,
  })
  const projectId = entityId(projectResult, 'project')
  assert(projectId, `create_project for invoice smoke did not return a project id: ${JSON.stringify(projectResult)}`)
  log(`created invoice project ${projectId}`)

  const taskResult = await callTool(lines, bridge, 'create_task', {
    title: invoiceTaskTitle,
    projectId,
    billable: true,
    idempotencyKey: `invoice-task-${testStamp}`,
  })
  const taskId = entityId(taskResult, 'task')
  assert(taskId, `create_task for invoice smoke did not return a task id: ${JSON.stringify(taskResult)}`)
  log(`created invoice task ${taskId}`)

  const entryEnd = Math.floor((Date.now() - 30 * 60 * 1000) / 1000) * 1000
  const entryStart = entryEnd - 60 * 60 * 1000
  const entryDate = new Date(entryStart).toISOString().slice(0, 10)
  const entryResult = await callTool(lines, bridge, 'add_manual_time_entry', {
    taskId,
    start: entryStart,
    end: entryEnd,
    note: 'Live MCP invoice smoke billable work',
    idempotencyKey: `invoice-entry-${testStamp}`,
  })
  const entryId = entityId(entryResult, 'entry') || entityId(entryResult, 'timeEntry')
  assert(entryId, `add_manual_time_entry did not return an entry id: ${JSON.stringify(entryResult)}`)
  log(`created billable manual entry ${entryId}`)

  const previewResult = await callTool(lines, bridge, 'preview_invoice_from_unbilled_work', {
    projectId,
  })
  const preview = payload(previewResult).preview
  assert(preview?.total === 150, `invoice preview total mismatch: ${JSON.stringify(previewResult)}`)
  assert(preview?.unbilledHours === 1, `invoice preview hours mismatch: ${JSON.stringify(previewResult)}`)
  log('verified invoice preview from unbilled work')

  const draftResult = await callTool(lines, bridge, 'create_invoice_draft', {
    projectId,
    clientId,
    invoiceDate: entryDate,
    notes: 'Live MCP invoice draft smoke',
    idempotencyKey: `invoice-draft-${testStamp}`,
  })
  const draft = payload(draftResult).invoice
  const invoiceId = draft?.id
  assert(invoiceId, `create_invoice_draft did not return an invoice id: ${JSON.stringify(draftResult)}`)
  assert(draft.status === 'draft', `draft invoice status mismatch: ${JSON.stringify(draftResult)}`)
  assert(draft.clientId === clientId, `draft invoice client mismatch: ${JSON.stringify(draftResult)}`)
  assert(draft.projectId === projectId, `draft invoice project mismatch: ${JSON.stringify(draftResult)}`)
  assert(draft.total === 150, `draft invoice total mismatch: ${JSON.stringify(draftResult)}`)
  assert(payload(draftResult).sideEffects?.marksEntriesBilled === false, 'draft creation should not mark entries billed')
  log(`created invoice draft ${invoiceId}`)

  const unbilledBeforeFinalize = await callTool(lines, bridge, 'find_unbilled_time', {
    projectId,
    taskId,
    limit: 10,
  })
  assert(
    listFromResult(unbilledBeforeFinalize, 'entries').some((entry) => entry.id === entryId),
    `manual entry should be unbilled before finalize: ${JSON.stringify(unbilledBeforeFinalize)}`
  )

  const finalizePromise = callToolWithVisibleApproval(lines, bridge, page, 'finalize_invoice', {
    invoiceId,
    confirmFinalize: true,
    idempotencyKey: `invoice-finalize-${testStamp}`,
  }, 30000)
  const finalizedResult = await finalizePromise
  const finalized = payload(finalizedResult)
  assert(finalized.invoice?.id === invoiceId, `finalize_invoice returned wrong invoice: ${JSON.stringify(finalizedResult)}`)
  assert(finalized.invoice?.status === 'sent', `finalized invoice status mismatch: ${JSON.stringify(finalizedResult)}`)
  assert(finalized.invoice?.total === 150, `finalized invoice total mismatch: ${JSON.stringify(finalizedResult)}`)
  assert(finalized.billedEntryCount === 1, `finalize_invoice billed entry count mismatch: ${JSON.stringify(finalizedResult)}`)
  assert(finalized.updatedTaskCount === 1, `finalize_invoice updated task count mismatch: ${JSON.stringify(finalizedResult)}`)
  assert(finalized.updatedProjectInvoiceReferences === true, `finalize_invoice did not link project invoice references: ${JSON.stringify(finalizedResult)}`)
  log('finalized invoice with browser approval')

  const invoicesResult = await callTool(lines, bridge, 'list_invoices', {
    clientId,
    projectId,
    status: 'sent',
    limit: 5,
  })
  const invoices = listFromResult(invoicesResult, 'invoices')
  const listedInvoice = invoices.find((invoice) => invoice.id === invoiceId)
  assert(listedInvoice, `finalized invoice not found in list_invoices: ${JSON.stringify(invoicesResult)}`)
  assert(listedInvoice.total === 150, `listed invoice total mismatch: ${JSON.stringify(invoicesResult)}`)
  assert(listedInvoice.status === 'sent', `listed invoice status mismatch: ${JSON.stringify(invoicesResult)}`)
  log('verified finalized invoice through list_invoices')

  const unbilledAfterFinalize = await callTool(lines, bridge, 'find_unbilled_time', {
    projectId,
    taskId,
    limit: 10,
  })
  assert(
    !listFromResult(unbilledAfterFinalize, 'entries').some((entry) => entry.id === entryId),
    `manual entry should no longer be unbilled after finalize: ${JSON.stringify(unbilledAfterFinalize)}`
  )
  log('verified finalized invoice removed entry from unbilled work')

  await assertNavigation(lines, bridge, page, projectId, invoiceProjectTitle)
  await page.getByText(invoiceTaskTitle).waitFor({ timeout: 15000 })
  log('verified client-linked invoice project/task render in the UI')

  return {
    clientId,
    projectId,
    taskId,
    entryId,
    invoiceId,
    invoiceNumber: finalized.invoice.invoiceNumber,
    total: finalized.invoice.total,
    status: finalized.invoice.status,
  }
}

async function callToolWithVisibleApproval(lines, bridge, page, name, args = {}, timeoutMs = 30000) {
  const pendingCall = callTool(lines, bridge, name, args, timeoutMs)

  await page.getByRole('heading', { name: 'Agent Approval' }).waitFor({ timeout: 15000 })
  await page.getByText(name).waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'Approve' }).click()

  return pendingCall
}

function findChromiumExecutable() {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH

  if (configured && existsSync(configured)) {
    return configured
  }

  for (const candidate of ['/usr/bin/chromium-browser', '/usr/bin/chromium']) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return undefined
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}
