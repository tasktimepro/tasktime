# Technology Stack

| Area | Technology | Role |
|---|---|---|
| Application | React 19, Vite 7 | Browser UI and production bundling |
| Language | JavaScript plus gradual TypeScript | Existing mixed codebase; migration is incremental |
| Styling/UI | Tailwind CSS 4, Radix UI, shadcn-style wrappers, Lucide | Tokens, primitives, components, and icons |
| Rich text | TipTap | Versioned project notes |
| Local data | Yjs, y-indexeddb, IndexedDB | CRDT state and offline persistence |
| Validation | Zod | Runtime boundary and persisted-data validation |
| PWA | vite-plugin-pwa, custom service worker registration | Installability, caching, and offline boot |
| Public site | Astro | Blog, legal pages, agent docs, discovery artifacts |
| Agent interface | Local WebSocket/browser transport and MCP bridge | Same-device scoped agent access |
| Cloud adapter | Google Drive appDataFolder plus Cloudflare Worker control plane | Direct optional Drive sync; Worker OAuth/token, push, and metrics boundary |
| Diagnostics | DebugBundle browser SDK | Optional captured runtime evidence |
| Tests | Vitest, Testing Library, Playwright | Unit/component/integration and browser flows |
| Tooling | Docker Compose, Make, GitHub Actions | Reproducible development and CI release gates |

## Constraints

- Run Node/npm commands inside Docker.
- Do not replace existing libraries or add dependencies without a concrete unmet need.
- Maintain stable JavaScript imports during gradual TypeScript conversion.
- Keep the private infrastructure implementation outside this public repository.
- Treat lockfiles and CI release commands as supply-chain/reproducibility controls.
