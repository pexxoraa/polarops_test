# PolarOps

PolarOps is an expedition command platform with a React/Vite frontend and a JavaScript Express API. The same backend code supports local Node.js development and Cloudflare Workers production.

## Architecture

### Local development

- Backend: Node.js + Express
- Database: SQLite through Node's built-in `node:sqlite`
- Realtime: `ws`
- Frontend: React + Vite
- Maps: Leaflet + React Leaflet
- Offline: service-worker shell cache + IndexedDB read cache/mutation queue

### Cloudflare production

- Frontend: React/Vite static build on Cloudflare Pages
- Backend: Express 5 on Cloudflare Workers
- Database: Cloudflare D1
- Realtime: Cloudflare Durable Objects + WebSocket Hibernation
- One `ExpeditionRoom` Durable Object instance per expedition
- Worker secrets: Wrangler secrets, not committed environment files

Current deployment:

- Frontend: https://polarops.pages.dev
- API/Realtime Worker: https://polarops-api.pexxoraa.workers.dev
- D1 database: `polarops-db`

## Project structure

```text
polarops-react/
├── Backend/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   │   ├── cloudflare/
│   │   ├── config/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── tests/
│   ├── index.js
│   ├── worker.js
│   ├── wrangler.jsonc
│   └── package.json
├── Frontend/
│   ├── public/
│   ├── src/
│   ├── .env.production
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .github/
├── .gitignore
└── README.md
```

## Run locally with Node + SQLite

Backend:

```bash
cd Backend
npm install
cp .env.example .env
npm run dev
```

Backend: http://127.0.0.1:5000

Frontend:

```bash
cd Frontend
npm install
npm run dev
```

Frontend: http://127.0.0.1:5173

Vite proxies `/api` and `/ws` to the local Node backend.

## Run locally with Cloudflare D1 + Durable Objects

Create `Backend/.dev.vars` with a local `AUTH_SECRET`, then:

```bash
cd Backend
npm run d1:migrate:local
npm run dev:worker
```

The Worker starts on http://127.0.0.1:8787 by default.

Test the Worker stack:

```bash
npm run test:worker
```

To run the frontend against the local Worker:

```bash
cd Frontend
VITE_API_BASE=http://127.0.0.1:8787/api \
VITE_REALTIME_BASE=http://127.0.0.1:8787 \
npm run dev
```

## Cloudflare deployment

Backend configuration is in `Backend/wrangler.jsonc`. D1 migrations live in `Backend/utils/db/migrations/`.

Apply D1 migrations:

```bash
cd Backend
npm run d1:migrate:remote
```

Deploy the Worker. Store `AUTH_SECRET` as a Worker secret; do not put it in `wrangler.jsonc`.

```bash
npx wrangler deploy --secrets-file .dev.vars
```

Build the frontend. Production defaults point to the deployed Worker, while `VITE_API_BASE` and `VITE_REALTIME_BASE` can override them for another Cloudflare environment:

```bash
cd Frontend
npm run build
```

Deploy Pages:

```bash
cd ../Backend
npx wrangler pages deploy ../Frontend/dist \
  --project-name polarops \
  --branch main
```

## Demo accounts

The current deployment is a synthetic demo environment and includes seeded demo users:

- Commander: `commander@polarops.local`
- Logistics: `logistics@polarops.local`
- Field: `field@polarops.local`

Local seed passwords are defined by the demo migrations. Before using PolarOps for non-demo operational data, remove or rotate seeded demo credentials and configure appropriate access controls.

## Validation

Backend:

```bash
cd Backend
npm test
npm run lint
npm run test:worker
```

Frontend:

```bash
cd Frontend
npm run lint
npm run build
npm run test:browser
```

The browser smoke test covers authentication, roles, core APIs, realtime, SPA modules, routes/zones, Polar Network switching, and browser runtime errors.

See `Backend/utils/docs/PHASE_VALIDATION.md` for the earlier local-refactor validation record.

## Data boundaries

Arctic / North and Antarctic / South remain separate operational/reference contexts. Public station and facility records retain source/verification metadata. Synthetic demo records are not represented as live operational data.
# Polar_ops
# ploar_ops-test
# polarops_test
