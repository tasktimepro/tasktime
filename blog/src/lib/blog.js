import { getCollection } from 'astro:content';

export const BLOG_PAGE_SIZE = 10;

export function sortBlogPosts(posts) {
    return [...posts].sort(
        (left, right) => right.data.publishedAt.valueOf() - left.data.publishedAt.valueOf()
    );
}

export async function getPublishedBlogPosts() {
    const posts = await getCollection('blog', ({ data }) => !data.draft);

    return sortBlogPosts(posts);
}

export function getBlogPageCount(posts, pageSize = BLOG_PAGE_SIZE) {
    return Math.max(1, Math.ceil(posts.length / pageSize));
}

export function getBlogPageHref(pageNumber) {
    return pageNumber <= 1 ? '/blog/' : `/blog/page/${pageNumber}/`;
}

export function getBlogPostsForPage(posts, pageNumber, pageSize = BLOG_PAGE_SIZE) {
    const startIndex = (pageNumber - 1) * pageSize;

    return posts.slice(startIndex, startIndex + pageSize);
}

export function formatBlogDate(value) {
    return new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(value);
}
