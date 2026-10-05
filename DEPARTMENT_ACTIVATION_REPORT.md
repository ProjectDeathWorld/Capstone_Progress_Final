# Department activation

Admin Settings now has four independent round selection controls: Cashier, Registrar, ITM and Admission. They use checkbox semantics so multiple departments can be enabled together. Select the departments and use the existing Publish action to apply the settings.

ITM's exclusive kiosk/display mode has been removed. ITM and Admission use the existing department, ticket, transaction, staff, service window, activity log and reporting structure. Cashier and Registrar retain their existing kiosk routing and ticket formats. New tickets use ITMN-/ITMP- and ADMN-/ADMP- followed by at least four digits; existing ticket numbers are not rewritten.

## Setup

1. Enable the desired departments in Settings and publish.
2. Add or edit a staff account in Staff Management, choose its department, and select its assigned window.
3. The staff member logs in through the existing Staff Mini View flow and opens their window. Full View is also supported.

Admission Window 1 was added closed and unassigned. Admission remains disabled by default. The local database migration has been applied; Cashier and Registrar remain enabled. The migration preserves legacy ITM activation when upgrading an installation that had ITM Mode enabled.

## Behavior

- Kiosk: enabled departments appear together. ITM/Admission require an open window with active assigned staff. Regular and security-authorized Priority tickets use the shared transaction-selection/generation flow.
- Staff: existing authentication, Full/Mini views, waiting queue, Call Next, serving/restoration, Complete and Skip are reused. ITM/Admission have assigned-window availability controls and recent activity.
- Disabling: backend authorization blocks new tickets, login and existing staff sessions' operational requests. Public live queues hide disabled departments. Tickets, transactions, activity logs and historical analytics remain stored and readable in reports. Re-enabling restores access.
- Updates: existing polling and queue-change events synchronize kiosk, staff, display and monitoring. Settings are checked every five seconds; backend authorization applies on each request.
- Display: department plus window number identifies a serving window, allowing Cashier Window 1, ITM Window 1 and Admission Window 1 to coexist.
- Database: reuses display settings for activation and all existing queue tables. Only the user position column was widened and Admission's default service window added. User, ticket, transaction and activity counts were checked before and after the migration and were unchanged.

## Verification

- Laravel feature suite: 66 tests passed, 873 assertions, including department activation, admission login/assignment, regular/priority issuance, isolation, availability, completion, history, analytics and preservation on disable/re-enable.
- `node tests/department-flow.mjs`: live kiosk activation changes, shared Regular/Priority flows, unchanged Registrar window routing and simultaneous department displays.
- `node tests/department-staff.mjs`: ITM/Admission Full and Mini window status, calling/completing, recent activity and disable/re-enable behavior.
- `node tests/auth-window-isolation.mjs`: existing authentication/session isolation and Full/Mini identity restoration.
- Production Vite build.

The older `tests/staff-launcher.mjs` fixture fails before its assertions because it mocks `localStorage` for authentication while the existing app uses `sessionStorage`; it also expects the earlier same-tab login behavior. It was left unchanged. The current session-isolation test and new Full/Mini department tests cover the implemented flow.
