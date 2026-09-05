import { describe, expect, it } from 'vitest';
import {
    DEFAULT_AGENT_DOCUMENTATION_URLS,
    PRODUCTION_APP_ORIGIN,
    PRODUCTION_MARKETING_ORIGIN,
    createTaskTimeOriginConfig,
} from './origins';

describe('TaskTime origin configuration', () => {
    it('keeps the public site, application, Worker, and agent roles distinct', () => {
        expect(createTaskTimeOriginConfig()).toEqual({
            marketingOrigin: PRODUCTION_MARKETING_ORIGIN,
            appOrigin: PRODUCTION_APP_ORIGIN,
            workerOrigin: null,
            agentDocsOrigin: PRODUCTION_MARKETING_ORIGIN,
        });
        expect(DEFAULT_AGENT_DOCUMENTATION_URLS).toEqual(expect.objectContaining({
            llmsTxt: 'https://tasktime.pro/llms.txt',
            agentDocs: 'https://tasktime.pro/agents/',
            quickstart: 'https://tasktime.pro/agents/quickstart/',
            security: 'https://tasktime.pro/agents/security/',
        }));
    });

    it('accepts explicit app/site loopback rehearsal configuration', () => {
        expect(createTaskTimeOriginConfig({
            marketingOrigin: 'http://localhost:3101',
            appOrigin: 'http://127.0.0.1:3102',
            workerOrigin: 'http://localhost:8787',
            agentDocsOrigin: 'http://localhost:3101',
        })).toEqual({
            marketingOrigin: 'http://localhost:3101',
            appOrigin: 'http://127.0.0.1:3102',
            workerOrigin: 'http://localhost:8787',
            agentDocsOrigin: 'http://localhost:3101',
        });
    });

    it.each([
        'https://user:secret@app.tasktime.pro',
        'https://*.tasktime.pro',
        'https://app.tasktime.pro/account',
        'https://app.tasktime.pro?section=billing',
        'https://app.tasktime.pro/#fragment',
        'http://app.tasktime.pro',
        'ftp://app.tasktime.pro',
    ])('rejects invalid production app origins without echoing them: %s', (appOrigin) => {
        let thrown: Error | null = null;

        try {
            createTaskTimeOriginConfig({ appOrigin });
        } catch (error) {
            thrown = error as Error;
        }

        expect(thrown?.message).toBe('Invalid app origin configuration.');
        expect(thrown?.message).not.toContain(appOrigin);
    });

    it('rejects a Worker URL with a path', () => {
        expect(() => createTaskTimeOriginConfig({
            workerOrigin: 'https://sync.tasktime.pro/auth',
        })).toThrow('Invalid Worker origin configuration.');
    });
});
