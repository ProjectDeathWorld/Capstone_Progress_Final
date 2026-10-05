# One-time queue test-data reset

Completed on 2026-09-17 against the configured local `laravel` database.

## Result

- Deleted 31 queue tickets (all statuses and priorities), 24 service transactions, and 48 queue-operation log entries.
- Preserved all 13 users and their exact credential fields, 9 configured service windows and assignments, 8 display windows, 1 display-settings record, 104 authentication tokens, sessions, migrations, and 194 authentication logs.
- Reset only `queue_tickets` and `service_transactions` auto-increment values to 1. The existing generation code starts each service/priority series at 001, e.g. C-R001, C-P001, R-R001, R-P001, ITM-N001 and ITM-P001.
- No frontend files changed. Fixed only the backend peak-hour label to return `No data available` when there are no tickets.

## Backup and receipt

Full SQL backup: `storage/app/private/qms-reset/before-reset-20260917-073814-0ad22ab7.sql`.

Audit receipt: `storage/app/private/qms-reset/completed.json`. It contains deleted counts, the backup SHA-256 checksum, preserved-table fingerprints, and final empty counts. These private files are excluded from Git by the existing private-storage ignore rule. The dump includes authentication data; keep it private.

An earlier backup ending in `1215f419.sql` was created before the initial schema guard rejected a cross-database listing; that attempt deleted nothing. The final command explicitly scopes inspection to the configured database.

## Command behavior

From the backend directory:

```powershell
php artisan qms:reset-test-data --dry-run
```

For a deployment that has not already been reset, stop operational writers/workers and run:

```powershell
php artisan down
php artisan qms:reset-test-data --dump-binary=C:/xaampp/mysql/bin/mysqldump.exe
# After reviewing successful verification:
php artisan up
```

The command asks for confirmation. `--force` supplies explicit noninteractive confirmation. It requires maintenance mode, backs up the entire database before deletion, checks backup completion, and refuses unexpected tables or nontransactional storage engines. All operational deletions run in one transaction, with children deleted before their ticket parents and foreign-key checks left enabled. Preserved data is fingerprinted before/after deletion. MySQL auto-increment changes occur after the delete transaction because ALTER TABLE implicitly commits.

The completion receipt blocks another reset, including with `--force`. Do not remove it to reset actual deployment records. Nothing invokes the command from startup, migrations, API endpoints, or page loading. On failure, maintenance remains enabled for investigation.

To inspect/restore a backup safely, restore it into a separately created recovery database first using the MySQL client `source` command. Do not import it over newly collected operational data without a recovery plan.

## Schema and dependencies

Cleared: `service_transactions`, then `queue_tickets`. Selectively deleted from `service_logs`: actions starting with `Called ticket: `, `Completed ticket: `, or `Skipped / no show: `. Authentication/configuration logs remain.

Foreign keys: transactions reference tickets and users; service logs reference users; service windows reference users; display settings reference users; display windows reference service windows. No foreign-key checks were disabled and no master records were deleted. No triggers exist in the inspected deployment.

There is no dedicated KPI/report table, persisted queue cache, or service-window current-ticket field in this database. Dashboard, Analytics, Reports and queue history derive from tickets/transactions. The root `queue_history.json` has no application references and was left untouched as an unrelated artifact. Sessions hold authentication state and were preserved.

## Verification

- 37 backend tests passed, 366 assertions, using isolated SQLite test databases.
- New reset tests exercise exact preservation, selective log removal, confirmation cancellation, dry run, unknown-schema rejection, clean dashboard/report responses, login, Regular/Priority numbering, valid/invalid security authorization, call-next priority order, completion, skip/no-show, new activity logs, and new analytics records.
- Existing tests cover ITM isolation, staff/window assignments, display configuration, reports, analytics and current-ticket behavior.
- Mini View drag test passed: bounds, resize, controls, cancellation and cleanup.
- Live database/controller checks returned empty waiting/serving queues and queue history, zero dashboard counts/times, empty report totals, working analytics/monitoring/settings/staff/log endpoints, and no current tickets for any staff member.
- Primary ticket/transaction IDs restart at 1; preserved data fingerprints matched immediately after reset. Existing window-availability reads refresh registrar `updated_at`; all permanent window fields still match the backup. No behavior was changed to prevent those normal timestamp updates.
- Application is online at http://localhost:3000 and database health reports Connected.

Browser discovery returned no connected browser, so visual kiosk/admin/staff/display checks remain unverified. Physical thermal printing was not tested. Workflow tests were kept out of the live database to leave it empty.

This is a data cleanup, not a production security/deployment audit. Existing unused `/api/kpi` storage routes reference a `kpi_monitoring` table absent from this deployment; active Dashboard/Analytics/Reports use the verified ticket-derived routes instead. No schema was added for those legacy routes.
