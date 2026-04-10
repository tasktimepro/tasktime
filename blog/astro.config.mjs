import { defineConfig } from 'astro/config';

export default defineConfig({
    site: 'https://tasktime.pro',
    output: 'static',
    trailingSlash: 'never',
    devToolbar: {
        enabled: false,
    },
});