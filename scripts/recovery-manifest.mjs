import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const manifest = {
    schemaVersion: 1,
    purpose: 'temporary-old-origin-readonly-backup',
    source: { repository: 'https://github.com/tasktimepro/tasktime', commit: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain').length > 0 },
    file: 'reader.js',
    sha256: createHash('sha256').update(readFileSync('artifacts/site-recovery/reader.js')).digest('hex'),
};
writeFileSync('artifacts/site-recovery/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
