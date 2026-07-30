# 🎛️ Frontend

The frontend is the React operator dashboard for the Vision Intel Platform.

## 📁 Contents

| Path | Purpose |
|---|---|
| `src/App.jsx` | Main dashboard and view switching |
| `src/components/` | Sidebar, top nav, cards, badges, command palette |
| `src/styles/index.css` | Tailwind layers, theme tokens, transitions |
| `src/lib/api.js` | API client with offline fallback |
| `src/data/fallback-summary.js` | Local fallback dashboard state |

## 🚀 Commands

```bash
npm install
npm run dev
npm run build
```

## 🌐 Local URL

```text
http://localhost:5173
```

## 🔌 Backend URL

For separate Vercel deployments, set:

```text
VITE_API_BASE_URL=https://your-backend-domain.vercel.app
```

More details: [Frontend docs](../docs/07-frontend.md)



