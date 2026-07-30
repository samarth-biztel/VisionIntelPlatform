# 🛠️ Tech Stack

## Overview

| Area | Technology | Why |
|---|---|---|
| Frontend | React 18 | Component-based dashboard UI |
| Frontend build | Vite | Fast local development and static builds |
| Styling | Tailwind CSS | Utility classes with consistent design tokens |
| Icons | Lucide React | Clean, accessible UI icons |
| Motion | Framer Motion + View Transitions API | Dashboard entrance motion and theme reveal animation |
| Backend | Node.js + Express | Simple HTTP API and local runtime host |
| Validation | Zod | Runtime contract validation in JavaScript |
| Contracts | JavaScript + Python bindings | Shared schemas for module authors |
| Deployment | Vercel | Static frontend and serverless backend support |

## Frontend Stack

```text
React ? Vite ? Tailwind ? Vercel static output
```

Key frontend files:

| File | Purpose |
|---|---|
| `frontend/src/App.jsx` | Main dashboard and view switching |
| `frontend/src/components/Sidebar.jsx` | Sidebar navigation and collapse control |
| `frontend/src/components/TopNav.jsx` | Header, search trigger, theme toggle |
| `frontend/src/styles/index.css` | Theme tokens, transitions, Tailwind layers |
| `frontend/src/lib/api.js` | API client and offline fallback |

## Backend Stack

```text
Express API ? Registry ? Bus ? Seed Runtime ? Contracts
```

Key backend files:

| File | Purpose |
|---|---|
| `backend/src/app.js` | Express app and API routes |
| `backend/src/server.js` | Local Node server entry |
| `backend/api/index.js` | Vercel serverless entry |
| `backend/src/registry.js` | Service and module registry |
| `backend/src/in-memory-bus.js` | Topic pub/sub bus |
| `backend/src/lifecycle-orchestrator.js` | Startup/shutdown sequencing |
| `backend/src/seed-runtime.js` | Mock source ? echo module ? log sink loop |

## Package Strategy

The repository is intentionally no longer a root npm workspace. Each deployable app owns its package file:

| Folder | Package Role |
|---|---|
| `backend/package.json` | Backend app and contracts workspace |
| `frontend/package.json` | Frontend app |

This keeps Vercel deployment simpler: choose either `backend` or `frontend` as the project root.



