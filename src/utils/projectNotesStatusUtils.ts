export function hasPendingProjectNotesCloudSave({ isSavingLocal, isDirty, pendingSyncChanges, lastLocalSavedAt, lastSyncedAt }) {
    if (isSavingLocal || isDirty || pendingSyncChanges) {
        return true;
    }

    if (lastLocalSavedAt == null) {
        return false;
    }

    return lastSyncedAt == null || lastSyncedAt < lastLocalSavedAt;
}

export function getSaveStatusText(options) {
    return hasPendingProjectNotesCloudSave(options) ? 'Saved locally' : '';
}

export function getCloudButtonLabel(hasPendingCloudSave, isDriveConnected) {
    if (!isDriveConnected) {
        return 'Saved locally';
    }

    return hasPendingCloudSave ? 'Save to cloud' : 'In sync';
}