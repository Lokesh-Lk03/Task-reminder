# Taskly

Taskly is a responsive personal task manager with a React frontend and a Node.js API backend. Tasks and preferences are stored by the backend in a local JSON file; no external database is required.

## Project Structure

```text
taskly/
├── frontend/              # React, Vite, Tailwind CSS, and Lucide UI
│   ├── src/
│   │   ├── api/            # Frontend API client
│   │   ├── utils/          # Task and date helpers
│   │   ├── App.jsx
│   │   └── index.css
│   ├── public/
│   └── vite.config.js      # Proxies /api requests to the backend during dev
├── backend/               # Node.js REST API, static asset server, and persistence
│   ├── server.mjs
│   └── store.mjs
├── Dockerfile              # Production multi-stage Docker build
├── render.yaml             # Render blueprint specification
├── vercel.json             # Vercel deployment configuration
└── package.json            # Workspace and scripts
```

## Quick Start (Run Locally)

Requires Node.js 18 or newer.

```sh
# 1. Install dependencies
npm install

# 2. Run both frontend and backend concurrently
npm run dev
```

- API runs on: `http://127.0.0.1:3001`
- Frontend runs on: `http://127.0.0.1:5173`

---

## Production Build & Run

To build the frontend and run the production server locally or on a server:

```sh
# 1. Build the frontend
npm run build

# 2. Start the unified production server
npm start
```

The unified server serves both the API endpoints (`/api/*`) and the frontend static assets from `frontend/dist/` on a single port (`PORT=3001` by default).

---

## Deploying to Production (Making It Live)

### Option 1: Render (Recommended - Free & Instant)

1. Push this project to a GitHub repository.
2. Sign in to [render.com](https://render.com) and click **New +** > **Web Service**.
3. Select your repository.
4. Render will auto-detect the configuration, or set:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Click **Deploy Web Service**. Render gives you a free live URL (e.g. `https://taskly-xxxx.onrender.com`).

*(Optional: For permanent data retention on paid plans, add a persistent disk mounted at `/var/data` and set the environment variable `DATA_DIR=/var/data`)*.

---

### Option 2: Railway or Fly.io

- **Railway**: Connect your GitHub repo. Railway auto-detects `npm run build` and `npm start`. Add a persistent volume mounted at `/app/backend/data` for persistent storage.
- **Fly.io**: Run `fly launch` and `fly deploy`.

---

### Option 3: Docker Container

Build and run anywhere with Docker:

```sh
docker build -t taskly .
docker run -p 3001:3001 -v $(pwd)/backend/data:/app/backend/data taskly
```

---

### Option 4: Vercel (Frontend) + Render/Railway (Backend)

1. Deploy `backend` to Render or Railway using `npm start`.
2. Note your backend URL (e.g. `https://taskly-api.onrender.com`).
3. Deploy to Vercel and set the environment variable:
   `VITE_API_BASE_URL=https://taskly-api.onrender.com`
4. The backend already includes full CORS headers and preflight handling.

---

## Backend API

- `GET /api/health` — server health.
- `GET /api/tasks` — list tasks.
- `PUT /api/tasks` — replace the task collection after validation.
- `GET /api/settings` — retrieve preferences.
- `PUT /api/settings` — update preferences after validation.

## Environment Variables

- `PORT` (default `3001`): The port the server listens on.
- `HOST` (default `0.0.0.0`): The network interface to bind to.
- `DATA_DIR` (optional): Path to directory where `taskly.json` is stored (useful for persistent disk mounts).
- `DATA_FILE` (optional): Full file path for task JSON storage.
- `VITE_API_BASE_URL` (optional, frontend): Custom backend URL for split hosting.
