import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSiteContract, checkSiteContract, readApprovalMetadata } from './site-contract.mjs';

test('approval export accepts literal metadata and fails closed on dynamic or spread definitions', () => {
    const parse = value => readApprovalMetadata(`const AGENT_COMMAND_REGISTRY = { tool: ${value} };`);
    assert.equal(parse('{ "requiresApproval": true }').get('tool'), true);
    assert.equal(parse('{ requiresApproval: false }').get('tool'), false);
    assert.equal(parse('{ description: "Read" }').get('tool'), false);
    assert.throws(() => parse('{ ...other }'), /Unsupported/);
    assert.throws(() => parse('{ requiresApproval: policy }'), /explicit boolean/);
    assert.throws(() => parse('other'), /Unsupported/);
});

test('exports reproducible public data without requiring a site checkout', async () => {
    const first = await createSiteContract();
    const second = await createSiteContract();
    assert.deepEqual(first, second);
    assert.equal(first.schemaVersion, 1);
    assert.equal(first.payload.origins.app, 'https://app.tasktime.pro');
    assert.equal(first.payload.pricing.status, 'review-only');
    assert.equal(first.payload.pricing.values.standardAnnualEur, 59);
    assert.equal(first.payload.tools.find(tool => tool.name === 'delete_all_account_data').requiresApproval, true);
    assert.equal(first.payload.tools.find(tool => tool.name === 'list_projects').requiresApproval, false);
    assert.ok(first.payload.tools.length > 100);
    assert.match(first.sha256, /^[a-f0-9]{64}$/);
    assert.match(first.source.commit, /^[a-f0-9]{40}$/);
    assert.equal(first.payload.discovery.app.localFirst, true);
});

test('detects stale or corrupted snapshots without requiring equal unrelated core commits', async t => {
    const directory = await mkdtemp(path.join(tmpdir(), 'tasktime-site-contract-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const target = path.join(directory, 'contract.json');
    const contract = await createSiteContract();
    contract.source.commit = 'a'.repeat(40);
    await writeFile(target, JSON.stringify(contract));
    await checkSiteContract(target);
    contract.payload.tools[0].description = 'Changed public behavior';
    await writeFile(target, JSON.stringify(contract));
    await assert.rejects(checkSiteContract(target), /stale|checksum/);
    assert.match(await readFile(target, 'utf8'), /Changed public behavior/);
});
