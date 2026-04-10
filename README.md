# TaskTime

A local-first task time tracking and invoicing app for freelancers. Runs entirely in the browser with IndexedDB storage.

## Features
- Project and client management
- Hierarchical tasks with completion and archiving
- Single active timer with pause/stop and heartbeat autosave
- Dashboard metrics with multi-currency support
- Invoice generation with PDF export
- Export/import for backup and restore

## Tech Stack
- React 19 + Vite
- Tailwind CSS + shadcn/ui (Radix)
- IndexedDB (via `idb`)
- Lucide icons

## Development

All npm/node commands run through Docker.

```bash
make install
make dev
```

App runs at http://localhost:3101

During normal local development, the Astro blog is also proxied through the same origin, so you can open http://localhost:3101/blog without switching to preview mode.

### Build

```bash
make build
```

### Prod-Like Local Preview

To test the merged app plus static blog locally using the same build path as production:

```bash
make preview
```

This builds the main app, builds the Astro blog, merges the blog output into `dist/blog`, and serves the combined artifact locally.

Default preview URL: `http://localhost:3101`

The default preview port is `3101` so it matches the normal local app URL. `make preview` stops the existing dev container first so you do not have to do that manually.

If you want to run the preview without stopping anything automatically first:

```bash
make preview-build
```

If you want to reuse a different port:

```bash
make preview PREVIEW_PORT=4173
```

## Data Storage

TaskTime stores all data locally in IndexedDB (`tasktime-db`). Clearing browser data will remove all projects and time entries. Use Export/Import for backups.

### Sync & Schema Changes (Pre‑Production)
If you change data structures during development, ensure Drive data is cleared or isolated before testing. Old cloud state can reintroduce incompatible records after a local wipe. For production, plan explicit schema/versioning and migration safeguards.

## Project Structure (high level)

```
src/
  components/
  hooks/
  utils/
  contexts/
  constants/
  styles/
```

## License

MIT
