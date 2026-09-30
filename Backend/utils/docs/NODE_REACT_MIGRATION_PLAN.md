# PolarOps Node/React Migration Plan

Date: 2026-09-29
Branch: `node-react-refactor`
Deployment: prohibited; local development only.

## Architecture decision

Use local SQLite through Node 26's built-in `node:sqlite`.

Reasons:
- Cloudflare D1 is SQLite-based.
- Existing migrations and relational constraints can be retained directly.
- Cargo/incident/inventory history and tenant relationships remain relational.
- No MongoDB translation layer or schema rewrite is necessary.
- No native SQLite npm dependency is required.

Realtime will use `ws`, keyed by expedition ID, with signed short-lived tickets. SQLite remains authoritative.

## Phase 0 — Audit

Deliver:
- `NODE_REACT_ARCHITECTURE_AUDIT.md`
- this migration plan

Gate:
- no functional source edits before audit completion.

## Phase 1 — Project shell

Create:
- `Backend/` Express application shell, SQLite config, copied local migrations/data, environment examples.
- `Frontend/` Vite + React shell, routing, base layout, shared CSS.
- root ignore/readme updates only where required for local workflow.

Validate:
- dependency install
- backend syntax/start
- frontend lint/build/start

## Phase 2 — Authentication

Backend:
- PBKDF2-SHA256 password verification/hash
- HMAC bearer tokens
- current-user middleware
- role/permission middleware
- users and password change
- realtime ticket issue

Frontend:
- AuthContext
- login
- protected app routes
- role-aware controls

Validate commander/logistics/field demo accounts.

## Phase 3 — Expeditions, locations, personnel

Implement:
- expedition list/create/update
- north/south expedition selection
- location CRUD
- personnel roster/create/update/check-in
- telemetry latest/history/position
- same-expedition related-ID validation

Validate tenant isolation and personnel check-in.

## Phase 4 — Logistics

Implement:
- cargo CRUD/movement/events
- inventory CRUD/adjustments/low stock
- vehicles CRUD/fuel/location
- assets CRUD/assignment
- dashboard summary service

Validate history records and stock warnings.

## Phase 5 — Emergency

Implement:
- incidents
- incident timeline
- vehicle dispatch
- resolution
- incident command actions
- unified synthesized/manual alerts

Validate persistence before realtime broadcast.

## Phase 6 — Maps, routes, geofences

Frontend:
- reusable PolarMap
- facility/location/personnel/vehicle markers
- route polylines
- geofence circles
- fullscreen
- separate Arctic/Antarctic defaults

Backend:
- route calculations and saving
- geofence create/list
- route vehicle/team-leader relationships

Validate route distance, ETA, fuel estimation, and readable route/zone forms.

## Phase 7 — Operations features

Implement:
- mission tasks / Daily Operations Board
- science
- communication check-ins
- readiness
- SITREP
- shift handover
- activity/audit
- global search

Validate representative create/update/search flows.

## Phase 8 — Polar networks/environment

Implement:
- local COMNAP CSV import into public facilities
- Antarctic current facilities/reference endpoint
- historical research-station reference
- Arctic research stations with verification/source metadata
- environment overview with optional external fetches and clear source/error metadata

Never convert reference/demo data into claimed live operational data.

## Phase 9 — Offline and realtime

Implement:
- service worker application shell
- client read cache
- mutation queue/replay
- local WebSocket expedition hub
- reconnect/invalidation behavior

Validate HTTP source of truth after websocket events and queued mutation replay.

## Phase 10 — Testing/parity/polish

Backend:
- Node test runner for auth, authorization, DB init, CRUD, operations, north/south separation, realtime tickets.

Frontend:
- ESLint
- Vite production build
- local dev server smoke
- headless browser smoke if Chrome/Chromium is available

Documentation:
- `PHASE_VALIDATION.md`
- `LOCAL_REFACTOR_RESULT.md`
- exact run commands and local demo credentials.

## Phase gate

For every implementation phase:
1. record changed files
2. run syntax/lint/build/tests
3. start backend locally and smoke-test
4. start frontend locally and smoke-test
5. browser-test where a headless browser is available
6. fix failures before advancing
7. record result

No phase may run a deploy, remote migration, push, merge, or production-resource command.
