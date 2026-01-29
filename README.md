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

### Build

```bash
make build
```

## Data Storage

TaskTime stores all data locally in IndexedDB (`tasktime-db`). Clearing browser data will remove all projects and time entries. Use Export/Import for backups.

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
