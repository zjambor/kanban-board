---
name: verify
description: E2E verification recipe for the Kanban Board static web app (headless Edge + playwright-core)
---

# Verify: Kanban Board

Pure static app (no build, no server). Surface = the browser page itself, opened via `file://`.

## Launch & drive

- No browser download needed: `npm i playwright-core` in a scratch dir, then
  `chromium.launch({ channel: "msedge", headless: true })` uses the system Edge.
- npm on this machine needs `NODE_OPTIONS=--use-system-ca` (TLS-intercepting proxy;
  plain `curl` to https also fails — use PowerShell `Invoke-RestMethod` for API smoke tests).
- Open `file:///E:/CLAUDE/CODE/Projects/Kanban%20Board/index.html` (URL-encode the space).
  The Supabase CDN script + REST calls work fine from `file://`.
- **Login gate first**: the app shows `#login-modal` on load and loads no data until login.
  Fill `#l-user` / `#l-pass` with `app_user` / `app_password` from `.env`, click `#btn-login`.
  Login is real **Supabase Auth** (`signInWithPassword`; the username maps to `APP_EMAIL`
  from config.js) — wrong password is a 400 from the server, so the error assert must wait
  for the network roundtrip. The session lives in localStorage (supabase-js), survives
  reloads, and `#btn-logout` calls `signOut()` + reload. The login modal must NOT close on
  Escape or overlay click.
- **RLS probe**: a raw fetch to `/rest/v1/tickets` with only the `apikey` header (no
  Authorization) must return **401** — anon has been revoked from the table entirely.
- Wait for `.card` (data loaded) before interacting. `#connection-status` gets class
  `online`/`offline`.

## Flows worth driving

- Create via column footer button (`[data-action="add"][data-status="TODO"]`) → modal → save → toast + card.
- Edit via card hover → `[data-action="edit"]` (actions are opacity-0 until hover; hover first).
- Drag & drop: native HTML5 DnD. Synthetic events work if you wait ~60ms after `dragstart`
  (app adds `.dragging` via setTimeout) before dispatching `dragover`/`drop` with a shared
  `DataTransfer`. Verify persistence by reloading the page.
- Rollback probe: `page.route` abort PATCH `**/rest/v1/tickets**` → drag → expect `.toast.error`
  and the card back in its original column.
- Delete: hover → `[data-action="delete"]` → `#btn-confirm-delete` → card detached; reload to
  confirm DB delete.

## Gotchas

- `styles.css` uses `transition: all .15s` on priority pills (and cards): **wait ≥200ms after a
  click before asserting computed colors**, or you race the transition and read stale values.
  This looks exactly like a CSS invalidation bug; it is not one.
- `document.styleSheets[0].cssRules` throws SecurityError on `file://` (cross-origin sheet) —
  don't use it for assertions.
- Test tickets pollute the shared Supabase table — always delete what you create and compare
  card counts before/after.
