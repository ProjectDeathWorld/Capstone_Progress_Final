# Window Utilization implementation report

## Causes and changes

1. **Active Time was always zero:** the frontend rendered `w.activeTime ?? '0 min'`, but its windowPerformance mapping and the department-comparison API never provided activeTime. The API now supplies a SQL total, mapped directly to the utilization table.
2. **Idle Time was always zero:** the same missing-field fallback fabricated zero. There is no window operating-session history. The actual schema has current service_windows.status/is_available and created_at/updated_at, but no historical open/close intervals. service_logs has user_id, action, created_at; inspected data contains zero window open/close log entries. Login/logout records do not reliably establish window availability, assignment changes, or crash/logout boundaries. The sessions table contains web-session payload and last_activity, not window operating sessions. Idle is now null in the API and N/A in the table.
3. **Utilization showed a dash:** no utilization field or available-time denominator existed. It now intentionally returns null/N/A with an API unavailable_reason. No session-history schema change was made. Future accurate idle/utilization would require persisted window_id, opened_at, closed_at intervals and reliable handling of session endings; that is outside this change.
4. **436.89 minutes is reproducible from real historical records:** it was not caused by NOW(), waiting-time subtraction, or duplicate joins in this panel. Cashier Window 3 contains the following completed service durations:

| Ticket ID | Called | Completed | Seconds |
|---|---|---|---:|
| 28 | 2026-08-27 09:00:24 | 2026-08-27 09:01:11 | 47 |
| 30 | 2026-08-27 09:01:16 | 2026-08-27 09:25:08 | 1432 |
| 31 | 2026-08-27 09:25:15 | 2026-08-27 09:25:41 | 26 |
| 33 | 2026-08-27 09:26:04 | 2026-08-28 14:08:32 | 103348 |

Total = 104853 seconds = 1747.55 minutes. Average = 436.8875 minutes, displayed as 436.89. Ticket 33 remained recorded as in service across a day boundary. Its service_transactions.start_time/end_time agree with its ticket timestamps. There is no evidence of an earlier actual completion time, so the implementation does not cap or silently rewrite it. A range including August 28 will still include that duration. A range ending August 27 now excludes it because utilization uses completion date rather than creation date. Correcting an inaccurate historical completion requires a verified replacement timestamp.

Registrar's apparent zero counts also came from frontend matching Registrar 1..5 against configured Window 9..13. Utilization now receives explicit database window numbers, with legacy 1..5 normalized to 9..13 only within Registrar. Cashier null-window records are not guessed to be Window 1.

## Exact calculations

5. **Service timestamps:** queue_tickets.called_at and queue_tickets.completed_at. Call/complete handlers persist these alongside service_transactions.start_time/end_time. Inspected completed records agree between both sources. The precomputed service_transactions.duration_seconds has negative historical values (the existing writer calculates a signed difference in reverse); utilization deliberately derives duration from timestamps and does not trust that field. No historical records or staff actions were modified.
6. **Active Time:** SUM((completed_at - called_at) in seconds / 60) for valid completed tickets in the selected completion-date cohort and actual service/window. SQL uses TIMESTAMPDIFF on MySQL and julianday on SQLite. Full service duration is attributed to the period containing completion, including services started before that period; it is not an inferred operating-time measure.
7. **Idle Time:** if reliable operating intervals existed, operating minutes minus active minutes would be required. They do not exist, so no idle subtraction is performed; the result is null/N/A, including empty windows.
8. **Average Service Time:** unrounded total valid service minutes / valid_service_tickets, rounded to two decimals. Zero valid records yields 0 min. Timestamps must be non-null, creation <= call <= completion. Invalid durations are excluded and reported as aggregate debug counts without names or student information. Completed records with a called timestamp count as handled even if their duration is invalid; completed records never called do not count as handled. Waiting, serving, cancelled/skipped, and no-show records are excluded. Missing completion cannot be attributed to a completion-date period and is excluded.
9. **Utilization Rate:** the required formula is active / operating * 100, with operating = active + idle. Because operating minutes cannot be established, the API returns null, not a fabricated zero. The frontend formats N/A and guards any numeric percentage against nonfinite values and clamps it to 0..100.
10. **Period:** completed_at inside Today, rolling seven days including today, rolling thirty days including today, six months through today, or inclusive custom start/end dates. Bounds use the existing application reporting timezone (UTC). Students Served now shares this range resolver; its former calendar-week/month logic conflicted with the 7 Days/30 Days filter labels. Other analytics aggregates retain their existing calculations.

## Timezone inspection

The application is configured for UTC. The actual MySQL session uses SYSTEM; NOW() was 2026-09-06 12:17:55 while UTC_TIMESTAMP() was 04:17:55 (+08:00). The existing application writes formatted timestamps through this connection, and utilization subtracts persisted call/completion values within the same database session; it performs no browser-local conversion, NOW() substitution, or one-sided eight-hour adjustment. Reporting uses the same application date boundaries as the shared Students Served calculation. This change does not globally reconfigure the database session or reinterpret historical timestamps, which could shift existing data. The historical timestamps alone do not establish whether every legacy writer used the same convention. The exact 436.89 result is explained by the recorded cross-day service, rather than an inferred timezone correction.

## Actual database verification (read-only)

For August 26?28, 2026:

| Department/window | Handled | Active min | Average min |
|---|---:|---:|---:|
| Cashier 1 | 1 | 6.57 | 6.57 |
| Cashier 2 | 3 | 41.45 | 13.82 |
| Cashier 3 | 4 | 1747.55 | 436.89 |
| Registrar 9 | 2 | 0.78 | 0.39 |
| Registrar 10 | 0 | 0 | 0 |
| Registrar 11 | 0 | 0 | 0 |
| Registrar 12 | 0 | 0 | 0 |
| Registrar 13 | 2 | 0.30 | 0.15 |

Manual timestamp checks: Cashier ticket 23, 07:22:53 -> 07:29:27 on August 27 = 394 seconds / 60 = 6.5667 minutes. Registrar ticket 27, 09:06:01 -> 09:06:40 = 39 seconds / 60 = 0.65 minutes. Combined with ticket 17's 8 seconds, Window 9 totals 47 seconds / 60 = 0.7833 minutes, averaging 0.3917 minutes.

Students Served totals nine Cashier tickets; displayed Windows 1?3 total eight. The ninth is ticket 29, explicitly assigned to historical Cashier Window 5, outside this table's requested windows. It has not been reassigned to force a match. Registrar totals four in both views. Unassigned/out-of-scope windows and invalid/missing call timestamps can explain further historical discrepancies rather than being silently counted against an arbitrary window.

## Files and integration

11. Backend/API:
- queuing-system-backend/app/Services/WindowUtilization.php (new SQL aggregation and shared date resolver)
- queuing-system-backend/app/Http/Controllers/Api/KpiController.php (adds window_utilization to existing department-comparison rows)
- queuing-system-backend/app/Http/Controllers/Api/CustomersServedController.php (shared completion-date range)
- queuing-system-backend/tests/Feature/WindowUtilizationTest.php (new regression coverage)
12. Frontend: queuing-system-frontend/src/pages/Analytics.jsx. Only Window Utilization reads the new nested values; Window Performance Comparison retains its old mapping and metrics.
13. All measured values come from database ticket/window fields. No ticket prefixes or current staff assignment are used to infer historical service ownership. One grouped ticket query avoids duplicate joins. Existing /api/analytics/department-comparison requests and the same silent 10-second Analytics refresh carry utilization; no new endpoint request or timer.
14. No Analytics redesign: unchanged columns, layout, spacing, colors, and styling. Unavailable values now say N/A. Existing values remain visible while background requests run.

## Validation

Frontend production build passed. Full backend suite: 30 tests, 229 assertions passed. New tests cover 5+8+7 minute services, invalid/negative/missing timestamps, noncompleted statuses, zero windows, cross-day completion, window/department separation including ITM, duplicate transaction rows, rolling/custom/semester filters, legacy Registrar numbering, and Students Served reconciliation. Live MySQL read-only aggregation and manual timestamp checks passed. No live browser visual test was performed.
