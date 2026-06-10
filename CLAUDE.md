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
    AppHeader.jsx             # Shared header (logo, trip name, slot for badge/actions)
    AvailabilityCalendar.jsx  # Date picker with group heatmap
    FlightSearch.jsx          # Skyscanner-linked flight search form
    GroupAvailabilityList.jsx # Group availability sorted by popularity
    ShareCard.jsx             # Share link card (expand/collapse, copy state)
    TripLoadingSkeleton.jsx   # Full-page loading skeleton for TripPage
    TripSchedule.jsx          # Agenda view (hours × days) shown when trip is closed
    UserPicker.jsx            # Participant selection buttons
  lib/
    darkMode.jsx         # DarkModeProvider + useDarkMode hook (class-based, localStorage)
    supabaseBackend.js   # fetch() wrappers for all API calls
    telemetry.js         # PostHog analytics
    tripEmoji.js         # Auto-derives emoji from trip name (keywords, cities, country flags)
    tripLink.js          # Trip routing + localStorage helpers
    userIdentity.js      # Anonymous identity in localStorage
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

**Dark mode (src/lib/darkMode.jsx):**
- Class-based: `.dark` on `<html>` element
- Anti-flash script in `index.html` runs synchronously before CSS loads — sets class from `localStorage` before first paint
- Toggle applies `theme-transition` class to `<html>` for 300ms, enabling smooth CSS transitions only during user-initiated switches (not on page load)
- `DarkModeProvider` wraps the app; `useDarkMode()` returns `{ isDark, toggle }`

**Trip emoji (src/lib/tripEmoji.js):**
- Derives an emoji from the trip name automatically: keyword matching (beach, ski, wedding…), city names, country names → flag emoji
- Pure function, no state. Used in ShareCard, TripPage overlay, TripPlanPage summary.

**LocalStorage keys:**
- `travel-group-mvp-user` — anonymous user identity (id, color, name)
- `travel-group-mvp-trip-user-map` — trip → user mappings
- `recent-trips:v1` — recent trip history
- `trip-month-lock:*` — per-trip month lock (sessionStorage)
- `travel-group-session-active` — session hint flag
- `theme` — `'dark'` | `'light'` | absent (follows system)

**Routing:**
- `/` — landing (create trip or enter passcode)
- `/t/<shortId>` — short URL trip access
- `/trip/<tripId>` — full UUID trip path
- `/trip/<tripId>/plan` — post-close planning page

## UI Design System

Font: **Plus Jakarta Sans** (400/500/600/700/800) loaded via Google Fonts, registered as `--font-sans` in the Tailwind `@theme` block.

Design tokens used consistently:
- Orange brand: `orange-500` for primary actions, `border-l-2 border-orange-500 pl-2.5` eyebrow pattern on section headers
- Card shadows (light only): `shadow-md shadow-slate-200/60 dark:shadow-none`
- Inputs/buttons: `rounded-lg`, focus ring `focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20`
- Status colors: orange = live/active, emerald = closed/confirmed, rose = error

## Features

### Close/lock dates (implemented)
Any participant with trip access can close the trip. Once closed, the calendar is read-only.

**UX (floating action bar):**
- A fixed bottom bar appears once a user is selected (only on open trips)
- Left: small icon-only "switch user" debug button + "X of Y ready" count
- Right buttons vary by confirmed state:
  - **Not confirmed:** `[Clear my days]` `[Mark as ready]`
  - **Confirmed:** `[Edit dates]` `[✓ Ready]` `[Close trip]` — Close trip only appears after confirming
  - **Editing (inline confirm):** `Reopen your dates? [Yes, reopen] [Cancel]`
- "Edit dates" un-confirms locally (no API), keeps existing date selection
- Header badge: orange "Live trip" pulse → green "Closed" checkmark

**Close trip flow (unified modal):**
- Single modal DOM node, two phases — `closeFlowPhase: null | 'confirm' | 'success'`
- Confirm phase (lock icon): trip name + ready count + confirm/cancel
- On confirm: content fades out (220ms), API call, then fades back in as success phase (ping animation + date range)
- Backdrop and card container never unmount during the transition — no double-modal flicker
- State: `closeFlowPhase`, `closeFlowAnimReady`, `closeFlowContentVisible`

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
- Polls every 15s to sync with other participants

**DB schema:**
- `trip_activities` table: `id`, `trip_id`, `date`, `hour` (0–23), `title` (≤200 chars), `created_by` (nullable user id), `created_at`
- API validates: date must match `YYYY-MM-DD`, title length ≤ 200 chars, hour 0–23

**Schema migration:** run the trip-schedule section at the bottom of `supabase/schema.sql` in the Supabase SQL editor.

### Trip planning page (implemented)
`/trip/<id>/plan` — accessible after trip is closed. Three tabs: Flights, Hotels, Agenda.

**UX:**
- Summary card at top: trip emoji + name, date range, confirmed count
- Tab bar with slide animation between panels
- **Flights tab:** IATA code inputs (From/To), round-trip/one-way toggle, date + passenger details (collapsible). Opens Skyscanner in new tab with dates pre-filled. Mobile: From + ⇄ on row 1, To full-width on row 2 (CSS grid `grid-cols-[1fr_auto]` → `sm:flex`).
- **Hotels tab:** destination text input, check-in/out dates (pre-filled from trip dates), guest count. Opens Booking.com.
- **Agenda tab:** `TripSchedule` component embedded inline.

## Known Tech Debt

- `formatDateRange` and `groupAvailabilityByDate` are duplicated across `TripPage.jsx`, `TripPlanPage.jsx`, and `GroupAvailabilityList.jsx` — worth extracting to `src/lib/` in a future cleanup.
- The "switch user" button in the floating action bar is temporary debug tooling — will be removed before release.
