# ITM queue investigation and fix

## Live database trace (before code changes)

Both reported tickets are in the configured `laravel.queue_tickets` table:

| Field | Regular ticket | Priority ticket |
| --- | --- | --- |
| ticket_id | 19 | 20 |
| ticket_number | ITM-N001 | ITM-P001 |
| priority_type | R | P |
| service_type | ITM | ITM |
| transaction_type | ITM Service | ITM Service |
| status | waiting | waiting |
| window | null | null |
| created_at, stored database value | 2026-09-18 08:59:01 | 2026-09-18 08:59:18 |
| called_at / completed_at | null / null | null / null |
| service_transactions ownership | no transaction / no staff owner | no transaction / no staff owner |

The live account is `users.user_id=3`, username `itm`, role `staff`, position `itm`, status `active`.
Its assignment is `service_windows.id=1`, department `ITM`, service_type `ITM`, window_number `1`, staff_id `3`, service_scope `department`, status `open`.
This is separate from Cashier Window 1 (service_windows.id=7). Therefore the existing ITM Window 1 label reflects the database correctly and was not changed.

## End-to-end findings

The dedicated kiosk invokes `generateItmTicket` and submits `service_type: ITM`, `transaction_type: ITM Service`, and priority `R` or `P` through `generateTicket` to POST `/api/queue/generate`. QueueController persists these fields using the existing ITM-N / ITM-P numbering. Both live rows confirm correct insertion.

The authenticated waiting endpoint identifies ITM using the database user's position and selects only waiting tickets with `service_type=ITM`. It does not filter ITM waiting tickets by Cashier window or require a preassigned ticket window.

A temporary diagnostic token for the actual ITM account was used against the running frontend proxy, then deleted. All three HTTP requests succeeded:

- GET `/api/staff/queue/waiting?mode=itm`: HTTP 200, two tickets, ITM-P001 followed by ITM-N001.
- GET `/api/staff/current-ticket`: HTTP 200, no active ticket/transaction.
- GET `/api/staff/current-window`: HTTP 200, ITM Window 1, open, department scope.

The same live checks after the changes still return both tickets waiting. No live ticket was claimed, completed, changed, moved, or deleted.

## Confirmed defects and changes

StaffPanel did not subscribe to the existing `queue-data-changed` notifications sent after ticket creation. It refreshed only on focus and the existing five-second polling interval. A regression test reproduced a staff count remaining at zero after the kiosk change notification despite the API fixture returning an ITM ticket. Both Full and Mini now respond to same-window events and cross-window storage events using the same existing refresh function. Polling remains a single five-second loop; no lifecycle, ownership, logout, drag or window-size changes were made.

The shared ticket formatter also converted ITM-N001 into ITM-R001. Normal-to-Regular legacy conversion is now limited to Cashier/Registrar prefixes, preserving ITM-Nxxx and ITM-Pxxx.

Evidence limitation: the running backend did not reproduce a zero-ticket response. Missing notifications explain the lack of an immediate update, but do not prove why a particular screen might remain at zero beyond a successful poll or reload. No browser was available to inspect that screen's runtime state. No speculative database repair or backend rerouting was performed.

## Files and APIs

Production backend files changed: none; the live routing and assignment were already correct.
Production frontend files changed:

- `queuing-system-frontend/src/pages/StaffPanel.jsx`: subscribe/unsubscribe to existing queue change notifications.
- `queuing-system-frontend/src/utils/queueNumber.js`: preserve ITM normal-ticket labels.

Tests added/extended:

- `queuing-system-backend/tests/Feature/ItmStaffRoleTest.php`
- `queuing-system-frontend/tests/itm-queue-refresh.mjs`

API contracts changed: none. Existing generate, staff waiting/current-ticket/current-window, call, complete and cancel endpoints remain in use.
Routing uses `queue_tickets.service_type`, `status`, `priority_type`, `created_at` and `ticket_id`; claim assignment uses `window` and `service_transactions.staff_id/ticket_id/end_time`. ITM identity uses `users.role/position/user_id` and its database service-window assignment. No new columns or numbering system were introduced.

## Verification

- 18 targeted Laravel tests passed, 310 assertions.
- Exact isolated backend sequence passed: zero ITM tickets; generate ITM-N001 -> one waiting; generate ITM-N002 -> two waiting; call first -> one waiting; complete; call second; skip; current ticket clears.
- Priority ordering passed. ITM priority and normal tickets are excluded from Cashier and Registrar waiting/claim endpoints. ITM excludes Cashier and Registrar tickets in normal operation. Cross-department completion and skip are denied.
- Full and Mini component tests passed: 0 -> 1 -> 2 immediately on kiosk notifications, both ticket labels, Call Next, Complete, next ticket, one polling loop and cleanup.
- Existing Mini popup/handoff/restore/action-suppression tests passed.
- Existing cross-window authentication tests passed.
- Frontend build passed, with the existing bundle-size warning.
- Existing transactional call-next staff/ticket locks and retry strategy are unchanged. The prior real MySQL concurrency test remains applicable; it was not rerun for these frontend-only production changes.

Cashier remains one shared department queue. Registrar Windows 9-13 remain strictly isolated. ITM's existing scope and any controlled backup handling were not modified. No UI was redesigned and no tickets/counts were hardcoded. The actual browser display was not visually verified; live authenticated API responses and component rendering were verified separately.
