import type { CloudProvider, SyncData, SyncMeta } from './CloudProvider';
import { isSyncDebugEnabled, syncLog } from '../debugLogger';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DATA_FILE_NAME = 'tasktime-data.json';
const META_FILE_NAME = 'tasktime-meta.json';

export class AuthorizationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthorizationError';
    }
}

export class GoogleDriveProvider implements CloudProvider {

    private accessToken: string;
    private dataFileId: string | null = null;
    private metaFileId: string | null = null;
    private cachedRemoteModifiedTime: number | null = null;

    constructor(accessToken: string) {

        this.accessToken = accessToken;
    }

    private async request(
        endpoint: string,
        options: RequestInit = {},
        retryCount = 0
    ): Promise<Response> {

        const response = await fetch(`${DRIVE_API}${endpoint}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                ...options.headers,
            },
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new AuthorizationError('Google authorization expired. Reconnect Google Drive.');
            }

            // Retry transient errors once
            if ((response.status >= 500 || response.status === 429) && retryCount < 1) {
                await new Promise(r => setTimeout(r, 1000));
                return this.request(endpoint, options, retryCount + 1);
            }

            throw new Error(`Drive API error: ${response.status}`);
        }

        return response;
    }

    async initialize(): Promise<void> {

        const response = await this.request(
            '/files?spaces=appDataFolder&fields=files(id,name,modifiedTime,size)'
        );
        const { files } = await response.json();

        for (const file of files) {

            if (file.name === DATA_FILE_NAME) {

                this.dataFileId = file.id;
            } else if (file.name === META_FILE_NAME) {

                this.metaFileId = file.id;
            }
        }
    }

    async debugSnapshot(): Promise<void> {

        if (!isSyncDebugEnabled()) {
            return;
        }

        try {

            const response = await this.request(
                '/files?spaces=appDataFolder&fields=files(id,name,modifiedTime,size)'
            );
            const { files } = await response.json();

            if (!files?.length) {
                syncLog('debug:drive snapshot -> no file detected in appDataFolder');
                return;
            }

            syncLog('debug:drive snapshot:list', files);

            const dataFile = files.find((file: { name: string }) => file.name === DATA_FILE_NAME);

            if (!dataFile) {
                syncLog('debug:drive snapshot:data -> no data file detected');
                return;
            }

            // Ensure we remember the data file id for later operations
            if (!this.dataFileId) {
                this.dataFileId = dataFile.id;
            }

            const dataResponse = await this.request(
                `/files/${dataFile.id}?alt=media`
            );
            const json = await dataResponse.json();

            syncLog('debug:drive snapshot:data', {
                fileId: dataFile.id,
                modifiedTime: dataFile.modifiedTime,
                size: dataFile.size,
                data: json,
            });
        } catch (error) {

            syncLog('debug:drive snapshot:error', error);
        }
    }

    async getMeta(): Promise<SyncMeta | null> {

        if (!this.metaFileId) {

            return null;
        }

        const response = await this.request(
            `/files/${this.metaFileId}?alt=media`
        );

        return response.json();
    }

    async hasRemoteChanges(lastSyncedAt: number): Promise<boolean> {

        // If this is a new device (never synced), check if remote data exists
        if (lastSyncedAt === 0) {
            return this.dataFileId !== null;
        }

        if (!this.metaFileId) {
            return false;
        }

        // Use modifiedTime for quick check first (cheap API call)
        const response = await this.request(
            `/files/${this.metaFileId}?fields=modifiedTime`
        );
        const { modifiedTime } = await response.json();
        const remoteModifiedTime = new Date(modifiedTime).getTime();

        // Cache to avoid redundant checks within the same session
        // but only if we've already synced (lastSyncedAt > 0)
        if (this.cachedRemoteModifiedTime === remoteModifiedTime) {
            return false;
        }

        this.cachedRemoteModifiedTime = remoteModifiedTime;
        return remoteModifiedTime > lastSyncedAt;
    }

    /**
     * Invalidate cached remote modified time after a push
     */
    invalidateCache(): void {
        this.cachedRemoteModifiedTime = null;
    }

    async pull(): Promise<SyncData | null> {

        if (!this.dataFileId) {

            return null;
        }

        const response = await this.request(
            `/files/${this.dataFileId}?alt=media`
        );

        return response.json();
    }

    async push(data: SyncData, meta: SyncMeta): Promise<void> {

        await this.uploadFile(DATA_FILE_NAME, this.dataFileId, data);
        await this.uploadFile(META_FILE_NAME, this.metaFileId, meta);
    }

    private async uploadFile(
        name: string,
        existingId: string | null,
        content: object
    ): Promise<string> {

        const metadata = {
            name,
            mimeType: 'application/json',
            ...(!existingId && { parents: ['appDataFolder'] }),
        };

        const form = new FormData();
        form.append(
            'metadata',
            new Blob([JSON.stringify(metadata)], { type: 'application/json' })
        );
        form.append(
            'file',
            new Blob([JSON.stringify(content)], { type: 'application/json' })
        );

        const endpoint = existingId
            ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

        const method = existingId ? 'PATCH' : 'POST';

        const response = await fetch(endpoint, {
            method,
            headers: { Authorization: `Bearer ${this.accessToken}` },
            body: form,
        });

        if (!response.ok) {

            throw new Error(`Drive upload error: ${response.status}`);
        }

        const result = await response.json();

        if (!existingId) {

            if (name === DATA_FILE_NAME) {

                this.dataFileId = result.id;
            }
            if (name === META_FILE_NAME) {

                this.metaFileId = result.id;
            }
        }

        return result.id;
    }
}
