# Client (Vite + React)

## Quick start (recommended: backend in Docker, frontend on host)

From the repo root:

```bash
docker compose up db backend -d          # API on http://localhost:5001
docker compose stop frontend             # free port 5173 for Vite
cd client
npm install                              # includes devDependencies
npm start                                # or: npm run dev
```

Open **http://localhost:5173**. Edits hot-reload in ~1s after the first start.

### First start feels frozen?

The first run after `npm install` (or after a lockfile change) can take **1–2 minutes** while Vite pre-bundles heavy libs (`ag-grid`, `recharts`, etc.). You may only see:

```
> vite
```

…with no other output for a while. **That is normal.** Subsequent starts are ~200ms.

To warm the cache ahead of time:

```bash
npm start   # first run only — wait up to ~2 min once; later starts are instant
```

## Node version

Use **Node 20 LTS** (matches Docker). Node 25+ is untested and may hang or behave oddly.

```bash
nvm use          # reads .nvmrc → 20
```

## Common failures

| Symptom | Fix |
|--------|-----|
| `Missing script: "dev"` | Use `npm start` or `npm run dev` (both work now). Run from **`client/`**, not repo root. |
| `Cannot find package 'vitest'` | Run `npm install` in `client/` (devDependencies must be installed). |
| `Port 5173 is already in use` | Stop Docker frontend: `docker compose stop frontend`. Kill stray Vite: `lsof -i :5173`. |
| Hangs at `> vite` forever | Wrong Node version, or first-time optimize still running — wait 2 min once, or run `npm run warmup`. |

## All-in-Docker dev (optional)

Hot reload inside Docker:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Uses `frontend-dev` (Vite) instead of the nginx production frontend.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` / `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm test` | Vitest |

API base URL defaults to `http://localhost:5001` when `VITE_API_BASE_URL` is unset.
