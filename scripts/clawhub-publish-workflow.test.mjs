import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';

// Exercise the dispatched shell arguments without contacting a registry.
for (const useToken of [false, true]) {
    test(`ClawHub ${useToken ? 'token' : 'OIDC'} publication preserves the authorized ref and exact commit`, () => {
        const workflow = readFileSync(new URL('../.github/workflows/publish-clawhub-plugin.yml', import.meta.url), 'utf8');
        const step = workflow.split('      - name: Publish ClawHub package release\n')[1].split('\n      - name:')[0];
        const shell = step.split('        run: |\n')[1]
            .split('\n').map(line => line.replace(/^          /, '')).join('\n')
            .replaceAll('${{ inputs.use_token }}', String(useToken))
            .replaceAll('${{ steps.release.outputs.version }}', '1.2.0');
        const result = spawnSync('bash', ['-c', 'npx() { printf "%s\\0" "$@"; };\n' + shell], {
            encoding: 'utf8',
            env: { ...process.env, GITHUB_REF: 'refs/heads/main', GITHUB_SHA: 'a'.repeat(40), GITHUB_REPOSITORY: 'tasktimepro/tasktime', CLAWHUB_CLI_VERSION: '0.23.1', PACKAGE_PATH: 'integrations/openclaw/tasktime' },
        });
        assert.equal(result.status, 0, result.stderr);
        const args = result.stdout.split('\0');
        assert.equal(args[args.indexOf('--source-ref') + 1], 'refs/heads/main');
        assert.equal(args[args.indexOf('--source-commit') + 1], 'a'.repeat(40));
        assert.equal(args.includes('--owner'), useToken);
        assert.equal(args[args.indexOf('--version') + 1], '1.2.0');
    });
}
