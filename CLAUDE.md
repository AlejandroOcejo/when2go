# when2go

Group trip date coordination app. Zero-auth: access via passcodes and session tokens.

## Architecture

**Frontend:** React 19 + Vite 8 + Tailwind CSS 4 (CDN, not bundled)  
**Backend:** Node.js serverless API handlers (Vercel Functions), Express for local dev  
**Database:** Supabase (PostgreSQL) — all access via service role + RPC calls, no client-side Supabase SDK  
**Deployment:** Vercel (SPA frontend + serverless `/api/*`)

## Local Dev

Two processes required:

```bash
npm run dev        # Vite frontend — http://localhost:5173
npm run dev:api    # Express API  — http://localhost:3000
```

Vite proxies `/api/*` → `localhost:3000` (configured in `vite.config.js`).

## Environment Variables

**Backend (`api/`):**
- `SUPABASE_URL` (also accepts `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` (also accepts `SERVICE_ROLE_KEY` or `VITE_SUPABASE_SERVICE_ROLE_KEY`)

**Frontend (`VITE_*`):**
- `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` — analytics (optional)
- `VITE_AVAILABILITY_SYNC_INTERVAL_MS` — debounce interval (default 10000)
- `VITE_AVAILABILITY_MIN_IDLE_MS` — min idle before sync (default 1800)
- `VITE_AVAILABILITY_POLL_INTERVAL_MS` — poll refresh interval (default 6000)

For Vercel production, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the Vercel dashboard (not in `.env`).

## Project Structure

```
api/
  _lib/
    supabaseAdmin.js     # Supabase admin client
    session.js           # Session/cookie utilities
  local-dev-server.js    # Express dev server
  session.js             # POST /api/session handler
  trip.js                # POST /api/trip handler

src/
  components/
    AccessGate.jsx            # Passcode screen (self-contained state)
    AppFooter.jsx             # Shared footer (max-w prop)
    AvailabilityCalendar.jsx  # Date picker with group heatmap
    GroupAvailabilityList.jsx # Group availability sorted by popularity
    ShareCard.jsx             # Share link card (expand/collapse, copy state)
    TripLoadingSkeleton.jsx   # Full-page loading skeleton for TripPage
    FlightSearch.jsx          # Skyscanner-linked flight search form (mock)
    TripSchedule.jsx          # Agenda view (hours × days) shown when trip is closed
    UserPicker.jsx            # Participant selection buttons
  lib/
    supabaseBackend.js   # fetch() wrappers for all API calls
    userIdentity.js      # Anonymous identity in localStorage
    tripLink.js          # Trip routing + localStorage helpers
    telemetry.js         # PostHog analytics
  i18n/
    locales/en/common.json
  pages/
    LandingPage.jsx      # Landing page (self-contained form state)
    TripPage.jsx         # Trip coordinator — data fetching + orchestration
    TripPlanPage.jsx     # Post-close planning page: flights, hotels, agenda tabs
  App.jsx                # Thin router: bootstrap → access gate → trip | landing
  main.jsx
```

## Supabase Architecture

All operations go through server-side API handlers only — the frontend never calls Supabase directly. Authentication is service-role only (no Supabase Auth). Sessions are custom: hashed tokens stored in DB, sent as HttpOnly cookies.

All RPC functions use `_v2` suffix:
- `create_link_session_v2` / `start_session_with_access_code_v2` / `assert_valid_session_v2` / `revoke_session_v2`
- `consume_trip_access_token_v2` / `issue_trip_access_token_v2`
- `create_trip_with_participants_secure_v2`
- `get_trip_secure_v2` / `get_trip_users_secure_v2`
- `get_trip_availability_secure_v2` / `get_user_availability_secure_v2`
- `replace_availability_buffered_secure_v2`
- `confirm_user_ready_v2` / `close_trip_v2`
- `get_trip_activities_v2` / `add_trip_activity_v2` / `remove_trip_activity_v2`

## Key Behaviors

**Availability Sync (TripPage.jsx):**
- Polls group availability every ~6s
- Buffers local date changes in `pendingDatesRef`
- Debounces write: syncs after 1.8s idle OR every 10s interval
- Handles 429 rate limits gracefully

**Calendar (AvailabilityCalendar.jsx):**
- `CalendarDayButton` and `NavigationButton` are module-level components (not defined inside the render function) — this is intentional. DayPicker remounts buttons when it receives new component references, which drops in-flight click events. They read dynamic data via React context (`CalendarCtx`).

**LocalStorage keys:**
- `travel-group-mvp-user` — anonymous user identity (id, color, name)
- `travel-group-mvp-trip-user-map` — trip → user mappings
- `recent-trips:v1` — recent trip history
- `trip-month-lock:*` — per-trip month lock (sessionStorage)
- `travel-group-session-active` — session hint flag

**Routing:**
- `/` — landing (create trip or enter passcode)
- `/t/<shortId>` — short URL trip access
- `/trip/<tripId>` — full UUID trip path

## Features

### Close/lock dates (implemented)
Any participant with trip access can close the trip. Once closed, the calendar is read-only.

**UX:**
- Status bar below ShareCard shows "X of Y ready" + "Close trip" button
- "Mark as ready" button on the "You are X" bar; turns into "✓ Ready" after confirming
- Header badge switches from orange "Live trip" to green "Closed" when trip is closed
- Calendar shows `lockedTitle`/`lockedSubtitle` and disables selection when `readOnly=true`
- UserPicker shows ✓ next to confirmed participants

**DB schema:**
- `trips.closed_at timestamptz` — null = open, set = closed (idempotent via `coalesce`)
- `users.confirmed_at timestamptz` — null = not ready, set = ready

**Schema migration:** run the close-dates section at the bottom of `supabase/schema.sql` against the Supabase SQL editor. Note: the migration uses `drop function if exists` + `create function` (not `create or replace`) for the two RPCs whose return signatures changed.

### Trip schedule (implemented)
Shown below the locked calendar when a trip is closed. Participants can plan activities per day/hour.

**UX:**
- Agenda view: one card per day (dates from group availability), hour rows 07:00–22:00
- Hover a row to reveal `+ Add` button; click to open inline input
- Press Enter to save, Escape to cancel; blur also commits if non-empty
- Activities render as chips with `×` to remove
- Optimistic updates: activity appears immediately, reverts if API fails
- Polls every 15 s to sync with other participants

**DB schema:**
- `trip_activities` table: `id`, `trip_id`, `date`, `hour` (0–23), `title` (≤200 chars), `created_by` (nullable user id), `created_at`

**Schema migration:** run the trip-schedule section at the bottom of `supabase/schema.sql` in the Supabase SQL editor.
