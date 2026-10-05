# Queue improvements implementation report

Implemented the three requested changes without changing ticket numbering, queue mutation endpoints, authentication, kiosk availability, or unrelated screen designs.

## 1. Staff Mini View

Modified:
- `queuing-system-frontend/src/pages/StaffPanel.jsx`
- `queuing-system-frontend/src/App.jsx`

Mini View is now conditional JSX inside the existing `StaffPanel`. Opening it changes only `isMiniOpen` and its on-screen position. It does not navigate, open a popup, mount another dashboard, or fetch queue/window/ticket data. The full and compact layouts read the same React state and invoke the same Call Next, Complete, Skip, and Registrar window-status handlers. Restoring the full layout preserves the current ticket, session, waiting list, and action locks.

Removed popup references, cross-window messages, and the popup-close polling timer. The existing staff queue synchronization remains at its existing **5-second** interval. The clock and service-duration display timers are also unchanged. Mini View adds **no second synchronization loop or network request**. The legacy `/staff/mini` route redirects to `/staff` with history replacement.

The existing floating-panel styling is reused, with saved drag position applied and clamped on opening/resizing. Registrar Open/Close is available in the compact layout using the same handler and status state.

## 2. Immediate Analytics and Reports filters

Modified:
- `queuing-system-frontend/src/hooks/useAdminPolling.js`
- `queuing-system-frontend/src/pages/Analytics.jsx`
- `queuing-system-frontend/src/pages/Reports.jsx`
- `queuing-system-backend/app/Http/Controllers/Api/KpiController.php`

The polling hook runs immediately when the page mounts or its filter key changes. It distinguishes that manual fetch from silent background refreshes. Analytics and Reports retain a 10-second background interval, including historical custom periods. Each key includes department, period, and custom dates. Invalid/incomplete date ranges disable requests and display local validation.

Requests use AbortController and increasing request IDs. Changing filters aborts the old request; response callbacks must still match the current request ID and an un-aborted signal. This also protects against a transport that completes after cancellation. Background refreshes skip an active request, including a PDF export revalidation. Polling always reads the latest callback and selected filters.

Existing content stays visible while a small status message identifies a manual refresh. No full-page filter-loading overlay was introduced. Reports now includes ITM; Analytics includes an ITM selector and uses the normalized reporting dataset for its overview, transaction, peak-hour, daily, and window-performance values.

The existing window-utilization section retains its separate completion-date population and existing utilization formulas. Its definition was not changed. The other report charts explicitly use the ticket-creation cohort described below. KpiController's period parser now delegates to the existing shared rolling date-range parser, eliminating calendar-week/month disagreement with the selected 7/30-day filters.

## 3. Database-backed report and PDF

Modified/added:
- `queuing-system-backend/app/Services/QueueReport.php` (new shared dataset service)
- `queuing-system-backend/app/Http/Controllers/Api/ReportController.php`
- `queuing-system-frontend/src/pages/Reports.jsx`
- `queuing-system-frontend/src/pages/Analytics.jsx`
- `queuing-system-frontend/src/utils/reportPdf.js` (new vector PDF renderer)

`GET /api/reports` delegates to `QueueReport`. It reads the eligible tickets once, eager-loads historical service transactions/staff, and derives the summary and charts from that collection. The Reports UI, Analytics report sections, and PDF consume that returned dataset. The renderer draws values; it does not independently calculate reporting KPIs.

The export button immediately requests fresh data for the active selection, waits for success, and passes that exact response to the renderer. It does not use the previously displayed report. A failed or superseded request cannot export stale values. The PDF downloads directly using the project's existing jsPDF dependency, with vector charts and selectable text instead of screenshots or a popup print page.

### Every PDF chart and its source

| Chart | Returned field | Database population/calculation |
| --- | --- | --- |
| Ticket-volume line chart, issued and completed series | `charts.daily` | Eligible tickets grouped by `queue_tickets.created_at` calendar date; completed is the completed subset of that same cohort. Zero-activity dates have zero counts. |
| Status donut | `charts.statuses` | Eligible tickets grouped by normalized `queue_tickets.status`; includes all observed statuses. |
| Completed by department bar chart (All Departments) | `department_summary` | Eligible completed tickets grouped by ticket service type, mapped to Cashier, Registrar, or ITM. |
| Completed by window bar chart (specific department) | `charts.windows` | Eligible tickets with a recorded `queue_tickets.window`, grouped by department/window. Legacy Registrar windows 1-5 display as 9-13. |
| Waiting/service-time line chart | `charts.daily` | Valid duration averages calculated independently for each ticket-creation date. Missing valid samples remain null, not invented aggregate points. |
| Student/Guest donut | `charts.visitors` | All eligible issued tickets, classified by recorded `student_number`; blank or explicit Guest is Guest. Both counts sum to tickets issued. |
| Hourly queue-volume bar chart | `charts.hourly` | Eligible ticket creation hours, including recorded activity outside 7 AM-7 PM. No fabricated activity. |
| Completed by transaction-type bar chart | `charts.transactions` | Eligible completed tickets grouped by their stored nonblank `transaction_type`. Names are read from records, not hardcoded. |

Transaction-type totals exclude completed tickets with no recorded transaction type. Window totals exclude tickets without a recorded window. These narrower populations are deliberate. Staff rows require recorded transaction/staff attribution; no inferred current assignments or generated staff names are used.

### Filters and formulas

- **Population:** tickets created in the selected range and department. The query is `created_at >= start-day midnight AND created_at < midnight after end-day`. A ticket created in range and completed later remains part of that creation cohort.
- **Timezone:** existing application/database semantics remain **UTC** (`config/app.php`). This implementation does not reinterpret stored timestamps or alter queue timestamp behavior. The PDF identifies the timezone and queried date range.
- **Today:** current application day. **Weekly:** trailing 7 calendar days including today. **Monthly:** trailing 30 days. **Semester:** the existing trailing 6-month definition. **Custom:** the selected inclusive start/end calendar dates. Frontend defaults use the same UTC day semantics. Backend date validation rejects reversed/invalid ranges.
- **Departments:** Cashier = C/CS; Registrar = R/RT; ITM = ITM. All Departments combines eligible records and retains comparisons.
- **Completed:** status done/completed, case-normalized. **Skipped / No Show:** cancelled, skipped, no-show, no_show, or noshow.
- **Students Served:** completed tickets with a recorded non-Guest student number. It is a ticket count, not a distinct-person count. Completed includes both students and guests.
- **Waiting time:** `(called_at - created_at) / 60` in minutes for completed tickets with valid nonnegative timestamps.
- **Service time:** `(completed_at - called_at) / 60` for completed tickets with valid nonnegative timestamps and a valid created-to-called sequence.
- **Turnaround time:** `(completed_at - created_at) / 60` for valid completed records.
- **Average:** sum of valid durations divided by valid sample count. Missing/negative/non-finite samples are excluded, not clamped or capped. The dataset exposes valid/excluded sample counts. No valid samples gives null, displayed as N/A. Historical durations never use the current time.
- **Completion rate:** completed tickets / eligible issued tickets * 100; 0 when there are no eligible tickets.
- **Staff/window performance:** group eligible tickets by actual service-transaction staff ID, ticket department, and historical ticket window. Display `users.full_name`. Served = completed tickets in that group; average service uses the same valid-duration calculation; completion rate = group completed / group eligible attributed tickets * 100. Duplicate aggregation joins cannot multiply tickets because aggregation operates on tickets, not joined rows.

All statistical values come from the database response. Fixed chart colors, labels, dimensions, department/service mappings, and empty-state zeroes are presentation/domain metadata, not hardcoded statistics. No demo data was inserted into the application database and no schema migration was needed.

### PDF layout

White pages, navy headings, restrained gold accents, compact KPI cards, vector charts, short insights, and a staff/window table. Charts stay within a page. Long category sets continue on additional pages; staff rows wrap and table headers repeat. Every page has the application header and Page X of Y footer. Empty reports use one page with an explicit no-data message. The inspected small populated report is three pages; the larger test report is six pages with all 35 staff rows and 12 transaction types retained.

## Verification

Added:
- `queuing-system-backend/tests/Feature/QueueReportTest.php`
- `queuing-system-frontend/tests/prepare-report-fixture.mjs`
- `queuing-system-frontend/tests/report-interactions.mjs`
- `queuing-system-frontend/tests/render-report.mjs`
- `queuing-system-frontend/tests/.gitignore`

Updated frontend `package.json` / `package-lock.json` with a test-only React renderer dependency and `test:reports` script. No new production PDF/chart dependency was added.

Passed:
- Full Laravel suite: **34 tests, 321 assertions**.
- New report tests: **4 tests, 92 assertions**, including all period/department combinations, boundary inclusion/exclusion, invalid ranges, ITM isolation, duration exclusion, student/guest totals, chart/KPI agreement, long transaction labels, and historical staff/window rows.
- React interaction tests execute the actual staff/report/analytics components and polling hook with mocked API transport and lightweight MUI presentation wrappers. They verify shared Mini View actions, no additional requests/timers, immediate Today/Weekly/Monthly/Semester/Custom/ITM changes, invalid-range suppression, out-of-order response rejection, in-flight polling suppression, and fresh-data export.
- Vite production build, written to `.report-build` to preserve existing `dist` artifacts.
- Generated PDFs from isolated SQLite test-database API responses. Rendered and visually inspected empty, small, and multipage/long-label cases using PyMuPDF. Checked charts, text wrapping, repeated headers, page numbering, and footer clearance.

To repeat from `queuing-system-frontend`: `npm run test:reports`. This creates isolated test-database responses and PDF QA outputs in `tmp/pdfs`; it does not add sample data to the live database.

**Live verification limitation:** the browser runtime reported no connected browsers, and the configured MySQL server at localhost:3306 refused the connection. Consequently, real-browser login/drag interaction and live MySQL reconciliation could not be performed. Those checks are not represented as passed. Existing staff action, authentication, Registrar status, ITM, and other backend regression tests passed against the isolated test database.
