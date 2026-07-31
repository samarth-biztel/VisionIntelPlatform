# Deployment

## Deployment Model

The project is split into two deployable apps:

| App | Folder | Deploy Shape |
|---|---|---|
| Rust Core backend | `backend/` | Long-running Rust service |
| Frontend web app | `frontend/` | Static Vite build now, Tauri shell later |

The frontend can still be deployed as a Vercel static site. The backend is no longer a Node serverless function; it should run as a persistent Rust service because the Core owns supervision and the future frame transport path.

## Backend Service

### Build And Run

```bash
cd backend
npm install
npm run build
npm run start
```

`npm run start` launches the Rust API on:

```text
http://localhost:7080
```

The npm scripts are compatibility wrappers around Cargo. On Windows they call `scripts/cargo-gnu.ps1`, which uses the `stable-x86_64-pc-windows-gnu` Rust toolchain.

## Backend Config Files

The backend prefers YAML config files:

```text
backend/config/device.yaml
backend/config/site.yaml
```

JSON files remain as fallback compatibility:

```text
backend/config/device.json
backend/config/site.json
```

The API exposes the loaded source files through `/api/config` and `/api/dashboard-summary`.

## Frontend on Vercel

### Settings

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

The frontend has:

```text
frontend/vercel.json
```

## Connecting Frontend to Backend

If backend and frontend are separate domains, add this environment variable to the frontend project:

```text
VITE_API_BASE_URL=https://your-backend-domain.example
```

If you later deploy both behind the same domain, the frontend can use relative `/api` routes without this variable.

## Local Development

Terminal 1:

```bash
cd backend
npm install
npm run dev
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Pre-Deployment Checks

Run backend checks before deploying backend changes:

```bash
cd backend
npm run build
```

This runs JavaScript contract checks, Python contract checks, Rust backend tests, and a Rust API startup check.

Run frontend checks before deploying frontend changes:

```bash
cd frontend
npm run build
```

## Production Notes

| Concern | Recommendation |
|---|---|
| Long-running hardware services | Run the Rust Core as a persistent edge-box or server service |
| In-memory bus | Replace or back with production transport when distributed deployment needs it |
| Lifecycle execution | Use persistent audit logs before exposing operator controls in production |
| Dependency reports | Persist snapshots once a database is introduced |
| Heartbeats | Persist history once database is introduced |
| Camera frames | Store heavy assets outside the API process |
| Secrets | Use environment variables, never committed `.env` files |