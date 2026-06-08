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

## Pending Features

### Close/lock dates
Once the group has settled on dates, the trip should be closeable so the calendar becomes read-only and the activity planning phase begins.

**Proposed UX:**
- Each participant has a "Ready" button — marks their availability as final
- Trip header shows confirmation progress (e.g. "3/5 ready")
- Creator can force-close at any time regardless of who has confirmed
- Closing does NOT auto-trigger when all confirm — it's always a deliberate creator action

**DB changes needed:**
- `closed_at timestamptz` on `trips`
- `confirmed_at timestamptz` on `users` (nullable — null = not confirmed)

**New RPCs needed (`_v2`):**
- `confirm_user_ready_v2(session_token_hash, trip_id, user_id)`
- `close_trip_v2(session_token_hash, trip_id)` — creator only

**Why creator-only close:** avoids auto-close edge cases where the last passive user to confirm unknowingly locks the trip. Progress visibility is enough to prompt the creator to act.
