export interface DefaultableEntity {
    id: string;
    isDefault?: boolean;
}

export interface DefaultSelectionUpdate {
    id: string;
    updates: {
        isDefault: boolean;
    };
}

export function planDefaultSelection<T extends DefaultableEntity>({
    items,
    targetId,
    isInScope,
    requireExistingTarget = false,
}: {
    items: T[];
    targetId: string;
    isInScope?: (item: T, target: T | undefined) => boolean;
    requireExistingTarget?: boolean;
}): DefaultSelectionUpdate[] {
    const target = items.find((item) => item.id === targetId);

    if (requireExistingTarget && !target) {
        return [];
    }

    return [
        ...planDefaultClearing({
            items,
            exceptId: targetId,
            isInScope: isInScope
                ? (item) => isInScope(item, target)
                : undefined,
        }),
        {
            id: targetId,
            updates: { isDefault: true },
        },
    ];
}

export function planDefaultClearing<T extends DefaultableEntity>({
    items,
    exceptId,
    isInScope,
}: {
    items: T[];
    exceptId?: string;
    isInScope?: (item: T) => boolean;
}): DefaultSelectionUpdate[] {
    return items
        .filter((item) => item.isDefault && item.id !== exceptId)
        .filter((item) => isInScope ? isInScope(item) : true)
        .map((item) => ({
            id: item.id,
            updates: { isDefault: false },
        }));
}
