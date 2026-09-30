# PolarOps Node/React Conversion Audit

Date: 2026-09-29
Branch: `node-react-refactor`
Audited source commit: `2662ae1`
Scope: local clone only. No production resources were accessed or modified.

## Executive summary

The current PolarOps implementation is a Cloudflare-native modular monolith. FastAPI/Python Workers, Cloudflare D1, one Durable Object WebSocket room per expedition, a vanilla-JavaScript PWA, Leaflet maps, public polar reference data, and optional external environmental feeds are combined into a same-origin application.

The conversion can preserve the existing relational model with a local SQLite database because D1 uses SQLite semantics and the migrations are standard SQLite-compatible SQL. MongoDB would introduce unnecessary data-model drift. The local Node target therefore uses Node 26's built-in `node:sqlite`.

The application already implements the operational domains requested for preservation: role-based authentication, expedition/organization tenancy, personnel, cargo, inventory, vehicles, assets, incidents, telemetry, mission tasks, routes, geofences, unified alerts, science, communications, readiness, incident command, shift handovers, SITREP, audit, global search, Antarctic facilities/reference stations, Arctic research stations, environment context, realtime events, PWA shell caching, and queued mutations.

## 1. Current backend structure

- `src/app.py` creates the FastAPI app and registers selected modular routers.
- `src/worker.py` remains the main Worker entrypoint and still owns most domain endpoints.
- `src/api/routes/` contains modular health, facilities, environment, Arctic-station, and operations routes.
- `src/core/` contains configuration, role permissions, authentication/token logic, and time helpers.
- `src/database/d1.py` wraps D1 queries.
- `src/repositories/` and `src/services/` are partial route -> service -> repository extractions.
- `src/integrations/` contains COMNAP, Open-Meteo, and wider polar-environment integrations.
- `src/realtime/` contains the Durable Object room and broadcasting abstraction.

## 2. Current frontend structure

The frontend is a static PWA under `public/`.

- `public/static/app.js` owns session state, API calls, offline queue/cache, websocket lifecycle, SPA-style section switching, most page rendering, forms, telemetry helpers, and Leaflet mission/network maps.
- `public/static/ops-features.js` owns operations board, routes/zones, alerts, science, communications, readiness, global search, audit, incident-command enhancements, SITREP, and shift handover.
- `public/static/app.css` and `public/static/reference-ui.css` implement the blue/navy/white PolarOps visual system.
- `public/service-worker.js` caches the application shell while bypassing API/WebSocket traffic and third-party map tiles.
- Leaflet 1.9.4 is vendored in `public/vendor/leaflet/`.

## 3. Current APIs

Authentication/session:
- POST `/api/auth/login`
- GET `/api/me`
- POST `/api/me/password`
- GET `/api/realtime/ticket`
- GET/POST `/api/users`
- GET `/api/organizations`

Core mission data:
- GET `/api/bootstrap`
- GET/POST/PATCH `/api/expeditions`
- GET/POST/PATCH `/api/locations`
- POST `/api/telemetry/position`
- POST `/api/telemetry/batch`
- GET `/api/telemetry/latest`
- GET `/api/telemetry/history`
- GET `/api/dashboard`

Logistics and people:
- GET/POST/PATCH/DELETE personnel plus POST check-in
- GET/POST/PATCH cargo plus move/history
- GET/POST/PATCH inventory plus adjustment
- GET/POST/PATCH vehicles
- GET/POST/PATCH assets

Emergency/operations:
- GET/POST incidents, incident detail, dispatch, resolve, timeline events
- GET `/api/ops/summary`
- GET/POST/PATCH mission tasks
- GET/POST planned routes
- POST geofences
- GET/POST/PATCH unified alerts
- GET/POST science records
- GET/POST/PATCH communications check-ins
- GET/POST/PATCH readiness
- GET/POST/PATCH incident command/actions
- GET/POST shift handovers
- GET SITREP
- GET audit
- GET global search

Reference/environment:
- GET data sources
- GET/POST public facilities/sync/import
- GET public Antarctic facilities
- GET public historical research-station reference
- GET facility weather
- GET Arctic research stations
- GET environment overview

Other:
- GET activity
- GET backup
- optional authorized worker-feed status/sync
- WebSocket `/ws/expeditions/<id>`

## 4. Current database models/tables

Initial operational schema:
- organizations
- users
- expeditions
- locations
- personnel
- cargo
- cargo_events
- inventory_items
- inventory_events
- vehicles
- assets
- incidents
- incident_events
- activity
- telemetry_positions
- public_facilities
- facility_weather
- data_sources

Later migrations add:
- external_cache
- research_station_reference
- arctic_research_stations
- mission_tasks
- planned_routes
- geofences
- ops_alerts
- science_records
- comms_checkins
- readiness_items
- incident_actions
- shift_handovers
- audit_events

The schema is relational, expedition-scoped for private operational data, and compatible with local SQLite.

## 5. Authentication implementation

- Passwords use PBKDF2-HMAC-SHA256 with 100,000 iterations.
- Session tokens are HMAC-SHA256 signed JSON payloads with user ID, organization ID, email, role, and expiry.
- Demo accounts are seeded for commander, logistics, and field roles.
- The browser currently stores the bearer token in localStorage.
- Realtime uses a short-lived expedition-specific ticket before WebSocket upgrade, then authenticates the normal session token inside the room.

## 6. Authorization implementation

- Organization ID comes from the authenticated user rather than browser input.
- Expedition access verifies `expeditions.organization_id == user.organization_id`.
- Role permission sets exist for commander/logistics/field.
- Current code includes same-expedition validation for related resource IDs in important mutations.
- Backend authorization must be preserved in Express middleware/services; React visibility controls are not sufficient.

## 7. Realtime/WebSocket implementation

- One Durable Object room exists per expedition.
- HTTP issues a short-lived realtime ticket after expedition authorization.
- The Worker validates ticket purpose, user, organization, and expedition before forwarding the upgrade.
- The socket authenticates with the signed session token.
- Mutations persist first, then broadcast; D1 remains authoritative.
- The Node conversion should use `ws` with the same rule: SQLite is source of truth and websocket events are invalidation/update signals.

## 8. Offline functionality

- Service worker caches the shell and static assets.
- API/WebSocket traffic bypasses the service worker.
- GET responses have browser cache fallback.
- Mutations are queued and replayed.
- Queue state includes retry/error handling.
- Existing queue storage is localStorage-based; conversion may use IndexedDB without changing user-visible behavior.

## 9. Map implementation

- Leaflet powers mission and station maps.
- Mission maps show locations/facilities, vehicles, personnel/telemetry, routes, and zones.
- Arctic and Antarctic views are separate.
- Fullscreen map behavior exists.
- The removed "9. Map data" control must remain removed.
- React conversion should use `react-leaflet` and preserve readable route/zone forms.

## 10. External data integrations

Existing integration boundaries include:
- COMNAP facilities CSV/reference data.
- Open-Meteo current weather.
- NOAA/NSIDC sea-ice products.
- NOAA SWPC space-weather data.
- USGS polar earthquake data.
- Optional authorized operations/worker feed.

External data is reference/context data and must keep source/freshness metadata. Demo records must remain clearly marked demo/synthetic.

## 11. Existing features confirmed

Confirmed from endpoints, migrations, and frontend wiring:
- role-based login
- dashboard summaries/risks/activity
- personnel roster, teams, status, check-in, telemetry
- cargo records/movement/history
- inventory thresholds/adjustments
- vehicles/fuel/location
- assets/assignment
- incidents/timeline/dispatch/resolve
- mission tasks/daily operations
- route planning metrics/assignment/save
- geofences
- unified alerts
- science records
- communication check-ins/overdue handling
- expedition readiness checklist
- incident command actions
- shift handovers
- SITREP
- audit/activity
- global search
- Antarctic facilities and historical station reference
- Arctic station reference with verification status/source
- environmental context/resources
- offline shell/queue
- realtime mission events

## 12. What must be preserved

- Organization/expedition tenant boundaries.
- Commander/logistics/field roles and backend enforcement.
- Existing relational entities and history tables.
- Antarctic/South and Arctic/North separation.
- Public/reference-data source and verification metadata.
- Explicit demo/synthetic labeling.
- Leaflet-based interactive maps and fullscreen support.
- PWA/offline behavior and mutation replay.
- Realtime as secondary delivery, not source of truth.
- Current PolarOps visual identity.
- Fast, no-refresh section navigation.
- Route/geofence form readability.

## 13. What changes in the Node/React conversion

Backend:
- Python/FastAPI/Workers -> Node.js/Express.
- Cloudflare D1 binding -> local SQLite via Node `node:sqlite`.
- Durable Objects -> local `ws` hub keyed by expedition.
- Cloudflare environment bindings -> `.env` values.
- route logic split into Express routes/services/models/middleware.

Frontend:
- imperative DOM rendering -> React components/pages/context.
- ad hoc section state -> `react-router-dom`.
- raw fetch spread across modules -> centralized `services/api.js`.
- Leaflet imperative maps -> `react-leaflet`.
- existing CSS identity retained/adapted.

Development:
- no Cloudflare or production dependency.
- backend on localhost:5000.
- frontend Vite on localhost:5173.
- local DB seeded from copied SQLite-compatible migrations/reference data.
