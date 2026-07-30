# ☁️ Deployment

## Deployment Model

The project is intentionally split into two deployable apps:

| App | Folder | Vercel Root Directory |
|---|---|---|
| Backend | `backend/` | `backend` |
| Frontend | `frontend/` | `frontend` |

Deploy them as two Vercel projects for the cleanest setup.

## Backend on Vercel

### Settings

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | leave empty |

The backend has:

```text
backend/api/index.js
backend/vercel.json
```

Vercel uses `api/index.js` as the serverless API function.

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

If backend and frontend are separate domains, add this environment variable to the frontend Vercel project:

```text
VITE_API_BASE_URL=https://your-backend-domain.vercel.app
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

## Production Notes

| Concern | Recommendation |
|---|---|
| Long-running hardware services | Prefer a Node service/edge box instead of pure serverless |
| In-memory bus | Replace with Redis/NATS/Kafka/MQTT for multi-instance deployments |
| Heartbeats | Persist history once database is introduced |
| Camera frames | Store heavy assets outside the API process |
| Secrets | Use Vercel environment variables, never committed `.env` files |



