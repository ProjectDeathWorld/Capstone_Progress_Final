# Admin synchronization implementation

- Dashboard and Monitoring fetch on entry and poll every 10,000 ms. Monitoring respects its existing Auto Refresh checkbox.
- Analytics fetches on entry/filter change and polls every 10,000 ms. Completed custom historical ranges fetch on entry/filter change, visibility return, explicit Refresh, or local mutation notification rather than on an interval.
- Reports, Staff Management, and Settings have no continuous page-data polling. Reports retains entry/filter fetching; Staff retains entry and successful add/edit/delete/password/security-code update refetches. Settings reloads on entry and applies the server response after publishing/resetting. Its live Display preview is the intentional exception (2 seconds while Settings is open).

## API endpoints (all prefixed /api)

Monitoring: `/queue/monitoring` only.

Dashboard: `/queue/monitoring`, `/analytics/dashboard`, `/analytics/peak-hours`, `/queue-history`, `/staff`, `/analytics/department-comparison`, `/analytics/customers-served`, `/activity-logs`. Independent requests run in parallel. Waiting counts now come from Monitoring, removing two full waiting-ticket downloads.

Analytics: `/analytics/dashboard`, `/analytics/department-comparison`, `/analytics/transactions`, `/analytics/peak-hours`, `/analytics/customers-served`, `/analytics/busiest-day`, `/windows/availability`.

## Synchronization safeguards

The reusable useAdminPolling hook owns one interval and one active refresh cycle per mounted page. Busy interval ticks are skipped; action notifications arriving during a request coalesce into one immediate follow-up. Hidden tabs skip refreshes and refresh immediately on return. Cleanup clears the interval, aborts requests, and removes event listeners. Dependencies are page/filter keys rather than state objects.

Aborted responses cannot update Dashboard/Monitoring state. Analytics also checks request IDs and controller cancellation to reject superseded filter responses. Identical large responses retain their previous state references where practical. Existing data stays visible after background failures; silent refreshes do not display full-page loaders or timeout banners. Existing 15-second standard and 60-second analytics timeouts were retained.

Successful fetchJson mutations notify the current document and other same-origin browser tabs through storage events: ticket generation/call/complete/skip, assigned window status, staff changes, and settings publication. Staff action handlers retain their immediate response updates. Different browsers/devices rely on polling. The 10-second target is a request cadence, not a guarantee when the backend/network takes longer or the tab is hidden.

## Database accuracy and query changes

Monitoring now uses service_windows with the actual staff_id -> users.user_id relationship and users.full_name. It returns database-configured windows, current tickets, persisted Closed/Serving/Idle state, per-window waiting counts, and department waiting totals. Closed windows no longer normalize to Idle. The Queue field now shows a count instead of elapsed waiting time.

The endpoint formerly used a hardcoded window list, downloaded all staff fields, and guessed assignments from username digits. It now eager-loads only staff ID/name, selects needed active-ticket columns, and aggregates waiting counts in SQL. No schema migration was added. Availability reads no longer overwrite existing Registrar window assignments through default seeding. No production query latency measurements were available; these are inspected query/data correctness improvements, not benchmarked speed claims.

No layout, CSS, ticket numbering, or queue selection rules were changed.

## Validation

- Frontend production build passed (isolated .sync-build output).
- Three Node polling tests passed: immediate fetch and six ticks over a simulated minute; slow-request exclusion and coalesced invalidation; failure recovery, visibility, and cleanup.
- Existing backend suite passed: 25 tests, 154 assertions.
- After adding the Monitoring regression and assignment preservation change, RegistrarWindowStatusTest passed: 5 tests, 49 assertions, including database assignment, waiting/serving/completed/skipped state, open/closed status, and Kiosk ticket availability.
- PHP syntax check passed.
- Live one-minute browser observation, real separate-session Staff/Admin/Kiosk interaction, and visual flicker checks were not performed. The polling clock test uses simulated ticks.

## Files changed for this task

- queuing-system-frontend/src/hooks/useAdminPolling.js (new)
- queuing-system-frontend/src/hooks/useDisplayBoardData.js
- queuing-system-frontend/src/api.js
- queuing-system-frontend/src/pages/AdminPanel.jsx
- queuing-system-frontend/src/pages/Analytics.jsx
- queuing-system-frontend/scripts/admin-polling.test.mjs (new)
- queuing-system-backend/app/Http/Controllers/Api/QueueController.php
- queuing-system-backend/app/Http/Controllers/Api/WindowController.php
- queuing-system-backend/tests/Feature/RegistrarWindowStatusTest.php
- ADMIN_SYNC_REPORT.md (new)

Pre-existing workspace changes were preserved.
