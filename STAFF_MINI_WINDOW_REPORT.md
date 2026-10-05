# Staff Mini View: same-document layout

Mini View now toggles `isMiniView` in the existing StaffPanel. Only the normal layout or the compact layout renders at a time. Both use the same authenticated user, ticket, queue, assigned-window state, action handlers, action lock, and existing synchronization effects. Switching modes performs no navigation, reload, window operation, or API fetch.

The popup bridge, bootstrap interception, portal, popup close monitoring, native moveTo dragging, and owner placeholder were removed. Restore and X set the mode back to normal and return focus to the Mini View trigger. The compact panel keeps its existing cards and controls on a navy page background, initially at the top right (430px wide, up to 720px tall). Pointer dragging is constrained to the viewport, excludes controls, and reclamps after resizing, including fullscreen size changes.

Modified: src/pages/StaffPanel.jsx, src/main.jsx, src/App.jsx, src/App.css, src/utils/staffMiniDrag.js, package.json, tests/staff-mini-drag.mjs, tests/report-interactions.mjs (all under queuing-system-frontend), and this report.
Removed: src/utils/staffMiniWindow.js and tests/staff-mini-window.mjs.

Validation: test:staff-mini passed (drag bounds, resizing, cancellation, cleanup; Cashier actions and state retention; Registrar skip and window status; no layout-triggered requests/timers; existing Reports/Analytics interaction checks). Production build passed with its bundle-size warning. No browser was available for live login, native F11, or end-to-end kiosk synchronization checks. The panel now remains in the same document by construction; live fullscreen behavior is not claimed as tested.

No backend/database changes, queue handler changes, authentication changes, or unrelated screen redesigns were made.
