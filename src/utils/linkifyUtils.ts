/**
 * Linkify utilities for text rendering.
 */

import type { ReactNode } from 'react';

export const LINKIFY_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

export type LinkifyPart =
    | { type: 'text'; value: string }
    | { type: 'link'; value: string; href: string };

type CreateElement = (type: any, props: any, ...children: ReactNode[]) => ReactNode;

type LinkifyNodeOptions = {
    linkClassName?: string;
};

/**
 * Converts URLs in text to anchor elements.
 *
 * @param text
 */
export const linkifyParts = (text?: string | null): LinkifyPart[] => {
    if (!text) return [];

    const parts = text.split(LINKIFY_REGEX);
    return parts
        .filter(Boolean)
        .map((part) => {
            if (!part.match(LINKIFY_REGEX)) {
                return { type: 'text', value: part };
            }

            const href = part.startsWith('http') ? part : `https://${part}`;
            return { type: 'link', value: part, href };
        });
};

/**
 * Converts URLs in text to React nodes using a provided createElement.
 *
 * @param text
 * @param createElement
 * @param options
 */
export const linkifyNodes = (
    text: string | null | undefined,
    createElement: CreateElement,
    options?: LinkifyNodeOptions
): Array<ReactNode> | null => {
    if (!text) return null;

    const linkClassName = options?.linkClassName || 'text-blue-600 dark:text-blue-400 hover:underline';

    return linkifyParts(text).map((part, index) => {
        if (part.type === 'text') {
            return createElement('span', { key: `text-${index}` }, part.value);
        }

        return createElement(
            'a',
            {
                key: `link-${index}`,
                href: part.href,
                target: '_blank',
                rel: 'noopener noreferrer',
                className: linkClassName
            },
            part.value
        );
    });
};
