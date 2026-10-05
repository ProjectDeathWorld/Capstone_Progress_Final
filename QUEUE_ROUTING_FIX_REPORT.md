# Queue routing fix report

1. Root cause: `src/api.js` read every authenticated request's token from one origin-wide `localStorage` key. `App.jsx` retained each window's original React user. Logging into Registrar after Cashier therefore caused the Cashier-labeled window to request the Registrar's current ticket and current window. That explains a Registrar ticket displayed under a Cashier label. The existing current-ticket endpoint already restricted department and transaction owner; it was receiving the other account's valid token. Regression tests reproduce the shared-token overwrite. The historical screenshot itself was not available for inspection.

2. Cashier shared queue: waiting and call-next queries remain department C only, without a window filter. Ticket creation now explicitly discards a supplied Cashier window and stores null. The serving window is assigned on successful claim. Priority precedes Regular, then creation time and ticket ID provide FIFO ordering. No Cashier kiosk window selector was added.

3. Atomic claiming: retained the existing Laravel transaction, staff-row lock, ticket `lockForUpdate`, active-transaction exclusion and three-attempt deadlock retry. The claim updates status, called_at and serving window and creates the ownership transaction together. The staff lock makes simultaneous calls from one account idempotent; ticket locks prevent different Cashiers claiming the same ticket. Added a deterministic ticket-ID ordering tie-breaker. Completion is now transactional with a ticket lock; cancellation already used a transaction and ticket lock.

4. Individual ownership: `service_transactions.staff_id` references `users.user_id`; the active transaction has null `end_time` and its ticket has serving status. Current-ticket restoration verifies staff ownership and department. Tokens now live in window-specific sessionStorage. Login explicitly passes the correct token to its Mini popup; browser-created Full/Mini windows inherit the opener's session storage, and refresh preserves it. Unrelated Mini logout messages cannot clear another session. StaffPanel remounts on user-ID changes to discard prior local component state.

5. Registrar isolation: waiting queries, claim selection, restoration, completion and cancellation retain the assigned Registrar window from `service_windows.staff_id/window_number`. Added the missing Registrar window constraint to call-next's existing-active-ticket restoration. Windows 9-13 remain separate queues. ITM routing/scope logic was left unchanged and existing ITM tests pass.

6. Backend implementation changed: `queuing-system-backend/app/Http/Controllers/Api/QueueController.php`.
   Endpoints changed: POST `/api/queue/generate`, GET `/api/staff/current-ticket`, POST `/api/queue/call`, PUT `/api/queue/{id}/complete`, PUT `/api/queue/{id}/cancel`.
   Existing GET `/api/staff/queue/waiting` was verified and preserved.
   Frontend authentication changes: `src/api.js`, `src/App.jsx`, `src/pages/Login.jsx`, `src/pages/AdminPanel.jsx`, and the logout message in `src/utils/staffMiniWindow.js`. No styling, layout, dimensions, animations or window handoff logic changed.

7. Existing database fields used: `users.user_id/role/position`; `service_windows.staff_id/department/window_number`; `queue_tickets.ticket_id/service_type/priority_type/window/status/created_at/called_at/completed_at`; `service_transactions.transaction_id/ticket_id/staff_id/start_time/end_time/duration_seconds`. No ownership column or database migration was introduced.

8. Backend enforcement: department, Registrar window, staff ownership, staff role and active state are checked server-side. Request service/window parameters cannot override authenticated staff routing. This is not a frontend-only ticket filter. The frontend change repairs the credentials sent by each window.

9. Full and Mini state: both still render the same StaffPanel and use `/api/staff/queue/waiting`, `/api/staff/current-ticket` and `/api/staff/current-window`. There is no separate global Mini current ticket. Database transactions remain the source of truth. Window lifecycle and handoff behavior are unchanged.

10. Verification results:

| Required scenario | Result |
| --- | --- |
| A: shared Cashier waiting queue; three individual claims | Passed backend tests; three distinct tickets, correct staff/window ownership, priority ordering and individual restoration |
| B: concurrent Cashier claims | Passed real MySQL/MariaDB test using separate PHP processes: nine rounds of three overlapping claims, all distinct; a tenth round with two requests from one staff account created only one transaction |
| C: Registrar Window 9 | Passed; only its assigned Registrar sees/calls it; other Registrars and Cashiers cannot claim it |
| D: Registrar Window 13 | Passed; only its assigned Registrar sees/calls it |
| E: cross-department current-ticket bug | Passed backend isolation tests, malformed legacy ownership tests, and API regression with another login overwriting the old shared storage key |
| F: refresh / Full / Mini | Passed API and React component tests for both departments, popup token transfer, both routes' restoration and unrelated logout isolation; visual browser verification unavailable because no browser was exposed |
| Complete / Skip ownership | Passed cross-staff and cross-department denial tests; existing completion/restoration tests pass |
| ITM regression | All six existing ITM tests passed |

Final targeted Laravel result: **16 tests passed, 262 assertions**.
Frontend: `node tests/auth-window-isolation.mjs` passed; `npm run build` passed (existing large-bundle warning).
Concurrency: `php tests/mysql-queue-concurrency.php` passed. The harness cloned table structures, not data, into a unique disposable database and removed that database afterward. It did not consume or reset live tickets.
Live health check: frontend HTTP 200; database Connected.

Reproduction commands, from the respective project directory:

- Backend: `php artisan test --filter='QueueRoutingTest|StaffCurrentTicketTest|ItmStaffRoleTest|RegistrarWindowStatusTest'`
- Backend: `php tests/mysql-queue-concurrency.php`
- Frontend: `node tests/auth-window-isolation.mjs`
- Frontend: `npm run build`

Refresh existing windows and sign in again after this change. Legacy localStorage tokens are deliberately not imported because an old Cashier window cannot safely determine which account last overwrote that shared token.
