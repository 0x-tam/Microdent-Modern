# Phase 3 — Desktop packaging plan

**Status:** Planning only — no packaging implementation, no new dependencies, and no installer code in this band.

**Scope:** Define how **Microdent-Modern** becomes a **reliable Windows desktop experience** on newer machines **without manual terminals**, while preserving today’s architecture: **React UI → loopback HTTP → Node bridge → read-only DBF copy / SQLite mirror**.

**Folder policy (unchanged):**

| Path | Rule |
| --- | --- |
| `Microdent-Legacy` | Never read or modify |
| `Microdent-Legacy-Copy` | Read-only import source for operators (`DATA/` tree) |
| `Microdent-Modern` | All implementation, docs, installers, and packaged artifacts |

---

## 1. Current runtime (what packaging must wrap)

Today the product is a **three-piece local stack** started by developers from the repo:

| Piece | Role | Default |
| --- | --- | --- |
| **`@microdent/bridge`** | Express HTTP API; only component that reads DBF / SQLite | `127.0.0.1:17890` (`BRIDGE_HOST`, `BRIDGE_PORT`) |
| **`apps/web`** | Vite host for `@microdent/app` `AppShell` | Dev `127.0.0.1:5173`; built static assets in `apps/web/dist/` |
| **`@microdent/sqlite-mirror`** | Offline import CLI (`mirror:import-safe`) | Requires **Node ≥ 22.5** (`node:sqlite`) |

The UI **never** opens DBF or SQLite files. It calls the bridge via `@microdent/bridge-client` (`VITE_BRIDGE_BASE_URL`, default `http://127.0.0.1:17890`).

**Health and diagnostics (already implemented):**

- `GET /health` → `{ ok, version }` — top-bar **Checking… / Connected / Offline** via `probeBridgeHealth`.
- `GET /v1/mirror/status` — safe mirror summary (`sqliteConfigured`, `sqliteUsable`, table counts metadata only).
- Dev-only CORS on the bridge allows browser `Origin` on loopback ports **3000–5999** for Vite preview; **packaged mode must not rely on this** (see §8).

Packaging’s job is to **start, configure, supervise, and update** the bridge + UI as one product, with a **first-run wizard** for paths — not to change Phase 1–2 read-only safety rules.

---

## 2. Packaging options compared

### 2.1 Electron

| Aspect | Assessment |
| --- | --- |
| **How it works** | Main process spawns **child Node** running `bridge/dist/server.js`, loads `apps/web/dist` in a `BrowserWindow` (`loadFile` or `loadURL` to loopback). |
| **Bridge lifecycle** | Natural: main owns PID, env, restart on crash, quit-on-window-close policy. |
| **Node runtime** | Ships **embedded Node** (or uses Electron’s Node for main only and a **forked** bridge — prefer **separate child** so bridge matches server Node version, especially **≥ 22.5** for imports). |
| **Windows installer** | Mature: **electron-builder** (NSIS), code signing, auto-update feeds (Squirrel / custom). |
| **Footprint** | Large (~150–200 MB); acceptable for clinic workstations. |
| **Security** | `contextIsolation`, no Node in renderer; bridge stays loopback-only. |
| **Fit for Microdent** | **Highest** — bridge is already Node/Express; minimal architectural change. |

### 2.2 Tauri

| Aspect | Assessment |
| --- | --- |
| **How it works** | Rust shell + system **WebView2** (Windows); UI is static files or dev server URL. Bridge runs as **`externalBin` sidecar** (`node.exe` + scripts) or future native port. |
| **Bridge lifecycle** | Sidecar API supervises process; must bundle **portable Node + bridge dist** (same as Electron child, different wrapper). |
| **Node runtime** | **Still required** for bridge and mirror import unless bridge is rewritten (out of scope). |
| **Windows installer** | **WiX / NSIS** via Tauri bundler; WebView2 bootstrapper; code signing supported. |
| **Footprint** | Small shell (~10–20 MB) + **Node sidecar** (tens of MB) — total often still **50–80 MB**. |
| **Security** | Strong capability model; good for least-privilege. |
| **Fit for Microdent** | **Strong strategic fit** (`docs/master-build-plan.md` already lists `apps/desktop` Tauri-first) but **higher integration cost** than Electron for Phase 3 MVP (Rust toolchain, sidecar signing, WebView2 on older Win10). |

### 2.3 Local web + Windows Service installer

| Aspect | Assessment |
| --- | --- |
| **How it works** | Installer registers **one or two Windows Services**: (A) bridge API, (B) optional static file server — or **extend bridge** to serve `apps/web/dist` on the same port in `NODE_ENV=production`. Desktop shortcut opens **Edge/Chrome app mode** to `http://127.0.0.1:17890`. |
| **Bridge lifecycle** | **Service Control Manager** start/stop; recovery policies; runs **without user login** if configured (usually **not** desired for clinic desktop — prefer **auto-start at user logon**). |
| **Node runtime** | Installed under `Program Files\Microdent\` or `%LocalAppData%\Microdent\runtime\`. |
| **Windows installer** | **WiX / Inno Setup / NSIS** + **NSSM** or native service wrapper; familiar to IT departments. |
| **Footprint** | Smallest if using **system browser**; no Chromium bundle. |
| **Security** | Good if bind stays **127.0.0.1**; risk if someone exposes port via firewall rule. |
| **Fit for Microdent** | **Best for multi-seat / IT-managed** clinics; weaker **“single app icon”** UX unless PWA/app-mode shortcut is polished. |

### 2.4 Pure browser + local server (manual / script)

| Aspect | Assessment |
| --- | --- |
| **How it works** | Operator runs `pnpm dev:bridge` + `pnpm preview:web` (or `vite preview`) — current dev workflow. |
| **Bridge lifecycle** | User-managed terminals; **fragile** on reboot. |
| **Fit for Microdent** | **Development and power users only** — **not** a shipping strategy. |

### 2.5 Comparison summary

| Criterion | Electron | Tauri | Service + browser | Pure browser |
| --- | --- | --- | --- | --- |
| No terminal for staff | Yes | Yes | Mostly (service install once) | No |
| Supervises bridge | Excellent | Good (sidecar) | Excellent (SCM) | Poor |
| Ships Node for bridge/import | Yes | Yes (sidecar) | Yes | Assumes preinstalled |
| Single “app” window | Yes | Yes | App-mode browser | No |
| Installer maturity on Windows | Excellent | Good | Good (custom) | N/A |
| Bundle size | Large | Medium | Small | N/A |
| Aligns with existing Node bridge | Excellent | Good (sidecar) | Excellent | Excellent |
| MVP effort | **Lowest** | Medium | Medium–high | N/A |

---

## 3. Recommended path (Windows first)

### Recommendation: **Electron shell for Windows Phase 3 MVP**

**Why Windows + Electron first**

1. **Bridge is Node/Express** — Electron’s main process can spawn the same `server.js` artifact operators already run, with **identical env vars** (`DATA_ROOT`, `SQLITE_PATH`, `BRIDGE_*`).
2. **Mirror import** needs **Node ≥ 22.5** — Electron packaging already solves “ship a known Node”; import can run as a **main-process menu action** or bundled CLI invocation without Rust.
3. **Fastest path to “no terminals”** — one `.exe`, one installer, one auto-update channel; clinic staff never see `pnpm` or PowerShell.
4. **Integrated health UX** — main process can probe `GET /health` before showing the window and surface **Offline** with actionable config errors (missing `DATA_ROOT`, bad paths).
5. **CORS simplification** — packaged UI should load from **`file://` or `app://`** with bridge CORS extended **or** (preferred) **serve static UI from the bridge** on loopback so origin is always `http://127.0.0.1:17890` (single origin, no Vite port dependency).

**Strategic follow-on (not MVP):** **Tauri 2 + Node sidecar** once MVP behaviors are proven (supervision, config, import, updates). Reuse the same **bridge child bundle** Electron uses; swap only the window chrome. This matches `docs/master-build-plan.md` without blocking a reliable Windows ship date.

**When to choose Service + browser instead:** clinic IT insists on **centralized service management**, **RDS/terminal server**, or **no bundled Chromium** — deploy bridge (+ static) as a **per-user or per-machine service** and distribute an **Edge app shortcut**.

---

## 4. Target packaged architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  Electron main (or Tauri Rust)                               │
│  - Read %AppData%\Microdent\config.json                      │
│  - Spawn / supervise bridge child                            │
│  - Optional: run mirror import on demand                     │
│  - Tray: Open / Health / Import mirror / Quit                │
└───────────────┬─────────────────────────────────────────────┘
                │ spawn, env injection
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Node: services/bridge/dist/server.js                        │
│  127.0.0.1:17890  GET /health  GET /v1/*                     │
│  (future) GET /* static → apps/web/dist for packaged UI      │
└───────────────┬─────────────────────────────────────────────┘
                │ read-only
                ▼
┌──────────────────────┐     ┌──────────────────────────────┐
│ DATA_ROOT (copy)     │     │ SQLITE_PATH (mirror file)     │
│ Legacy-Copy/DATA     │     │ %LocalAppData%\Microdent\...   │
└──────────────────────┘     └──────────────────────────────┘
```

**Renderer:** built `AppShell` with `bridgeBaseUrl` fixed to packaged loopback URL (compile-time or injected `config.json`).

---

## 5. Bridge start / stop

### 5.1 Start sequence (packaged)

1. Main reads **config** (paths, port, auto-start flags).
2. Validates **`DATA_ROOT`** exists and is absolute; warns if missing (health will work; `/v1/*` returns `DATA_ROOT_NOT_CONFIGURED`).
3. Spawns bridge child:
   - **Executable:** bundled `node.exe` (or `microdent-bridge.exe` wrapper)
   - **Entry:** `services/bridge/dist/server.js`
   - **Env:** `NODE_ENV=production`, `BRIDGE_HOST=127.0.0.1`, `BRIDGE_PORT`, `DATA_ROOT`, `SQLITE_PATH` (optional)
4. Main polls `GET /health` with backoff (e.g. 2–15 s) before showing UI.
5. Opens window → `http://127.0.0.1:{port}/` (if bridge serves static) or bundled `index.html` with injected base URL.

### 5.2 Stop sequence

| Event | Behavior |
| --- | --- |
| User **Quit** from tray/menu | SIGTERM bridge child → wait ≤5 s → SIGKILL if needed → exit app |
| Window close (policy) | **Default: minimize to tray** on clinic desktops (avoid accidental stop); optional setting **“Quit on close”** |
| Windows logoff / shutdown | OS kills child; main should handle `before-quit` and stop bridge cleanly |
| Bridge crash | Main shows **Offline** banner data; auto-restart **once** with backoff; log to `%AppData%\Microdent\logs\` |

### 5.3 Development parity

Existing scripts remain for engineers:

- `scripts/dev-bridge.sh` — requires `DATA_ROOT`
- `scripts/dev-web.sh` — Vite on `5173`
- `pnpm mirror:import-safe` — import from copied DATA

Packaged app must **not** depend on repo-relative paths or `pnpm` on PATH.

---

## 6. Configuration: `DATA_ROOT` and `SQLITE_PATH`

### 6.1 Rules (from implemented code)

| Variable | Required | Rules |
| --- | --- | --- |
| **`DATA_ROOT`** | For all `/v1/*` DBF routes | **Absolute** path; whitespace = unset → **503** `DATA_ROOT_NOT_CONFIGURED`. Must point at **read-only copy** of legacy `DATA/` (e.g. `Microdent-Legacy-Copy/DATA`), never `Microdent-Legacy`. |
| **`SQLITE_PATH`** | Optional | **Absolute** path to mirror `.sqlite`. Unset → bridge uses **DBF-only** read paths. Set but invalid → per-route **DBF fallback** where implemented. |
| **`BRIDGE_HOST`** | Optional | Default **`127.0.0.1`** — **do not bind `0.0.0.0`** in shipped builds. |
| **`BRIDGE_PORT`** | Optional | Default **`17890`**; installer should detect collision and pick next port or show error. |
| **`VITE_BRIDGE_BASE_URL`** | Build-time (web) | In packaged builds, inject same URL as runtime config (no `.env.local` for staff). |

Path sandbox (`services/bridge/src/safety/`) enforces reads stay under `DATA_ROOT` realpath; symlinks/junctions that escape the tree are rejected on Windows when permissions allow.

### 6.2 Recommended packaged locations (Windows)

| Artifact | Recommended path | Notes |
| --- | --- | --- |
| **Config file** | `%AppData%\Microdent\config.json` | Machine-specific; backup-friendly |
| **`DATA_ROOT`** | `D:\MicrodentData\DATA` or `\\fileserver\clinic\Microdent-Copy\DATA` | **Local SSD strongly preferred** over WAN share for daily use |
| **`SQLITE_PATH`** | `%LocalAppData%\Microdent\mirror\MICRODENT_MIRROR.sqlite` | Writable; not beside read-only copy |
| **Logs** | `%AppData%\Microdent\logs\` | Bridge stdout/stderr, import summaries |
| **Backups** | `%AppData%\Microdent\backups\` or operator-chosen folder | See §9 |

**First-run wizard (MVP):**

1. Explain: Modern reads a **copy**, not live FoxPro while legacy is writing.
2. Folder picker → set `DATA_ROOT` (validate `PATIENT.DBF` / catalog presence optionally via `GET /v1/meta/legacy-catalog`).
3. Optional: enable mirror → set `SQLITE_PATH` default under `%LocalAppData%`.
4. Test **Connected** via `/health` and show mirror line from `/v1/mirror/status` in a **Settings → Data** screen (production-safe copy, not only dev diagnostics).

---

## 7. SQLite mirror location and lifecycle

### 7.1 Where the mirror lives

- **Not in git** — mirror files contain derived clinic data; `.gitignore` already treats them as local artifacts.
- **Canonical packaged location:** `%LocalAppData%\Microdent\mirror\MICRODENT_MIRROR.sqlite` (+ `-wal` / `-shm` during import).
- **Do not store only on a network drive** — SQLite locking and latency are fragile on SMB (see §12).

### 7.2 Import source vs mirror

| Layer | Location | Role |
| --- | --- | --- |
| Import source | `DATA_ROOT` → `Microdent-Legacy-Copy/DATA/*.DBF` (+ `.CDX`, `.FPT`) | **Read-only** FoxPro files; refreshed by **operator copy job**, not by Modern |
| Mirror | `SQLITE_PATH` | **Derived read model**; safe subset per `docs/phase-2-mirror-import-command.md` |
| Bridge | Reads DBF and/or SQLite per route | `GET /v1/mirror/status` reports usability |

### 7.3 How imports are triggered (packaged)

**Today (implemented):** operator CLI from repo:

```bash
export DATA_ROOT="…/Microdent-Legacy-Copy/DATA"
export SQLITE_PATH="…/MICRODENT_MIRROR.sqlite"
pnpm mirror:import-safe
```

**Packaged (planned):**

| Trigger | MVP | Later |
| --- | --- | --- |
| **Settings → Refresh mirror** button | Yes — main runs bundled `import-safe` with progress UI | Scheduled task |
| **CLI for IT** | `microdent-import.exe` or `node … mirror-import-safe.js` | Same |
| **HTTP `POST /v1/admin/import`** | **No** — avoids accidental remote trigger | Guarded localhost + token if ever added |
| **On every app start** | **No** — full import can take minutes | Optional “import if older than N days” |

Import order and blocked fields: `docs/phase-2-mirror-import-command.md`. Requires **Node ≥ 22.5** for `node:sqlite`.

**After legacy data refresh:** operator copies new `DATA` tree → runs import again (replaces mirror table contents per importer design).

---

## 8. Health status in the packaged app

| Signal | Source | Staff-facing UI |
| --- | --- | --- |
| Bridge up | `GET /health` | Existing top-bar **Connected / Offline / Checking…** |
| Data configured | `/v1/*` or settings probe | **Settings** badge: “Data copy configured” / “Not configured” |
| Mirror ready | `GET /v1/mirror/status` | **Settings → Mirror:** Active / DBF fallback / Not configured (use production-safe strings; extend beyond dev-only `mirrorConnectionDiagnostics`) |
| Version | `health.version` | About dialog for support |

**Main process** should also log health probe failures to `%AppData%\Microdent\logs\` without PHI.

**Packaged CORS policy:** Serve UI from the **same loopback origin as the API** (bridge static middleware) **or** register a dedicated `app://` origin in bridge — do **not** depend on Vite port **5173** and dev CORS allowlist.

---

## 9. Backups

Packaging does **not** replace legacy backup discipline (`docs/legacy-system-map.md` §7–8).

### 9.1 What to back up

| Item | Priority | Method |
| --- | --- | --- |
| **Legacy `DATA` copy** (`DATA_ROOT`) | **Critical** | Bit-for-bit copy including `.CDX`, `.FPT`, `.DBC` triplets; checksum manifest; store **off machine** |
| **SQLite mirror** | Medium | File copy while bridge **stopped** or after import completes; optional automatic pre-import copy |
| **`config.json`** | High | Small; include in clinic backup policy |
| **Logs** | Low | Rotate; no PHI in logs by design |

### 9.2 Packaged backup behavior (MVP)

- **No automatic legacy backup** from Modern (avoid touching FoxPro trees).
- **Optional:** before mirror import, copy previous `SQLITE_PATH` to `%AppData%\Microdent\backups\mirror-YYYYMMDD-HHMMSS.sqlite`.
- Installer docs / first-run: link to **immutable archive** procedure before first import.

---

## 10. Auto-start vs manual start

| Mode | Use case | Implementation sketch |
| --- | --- | --- |
| **Auto-start at user logon (recommended default)** | Reception / clinical workstations | Registry `Run` key or Startup folder shortcut → Electron app; main starts bridge |
| **Manual start** | Shared PCs, training | Desktop shortcut only; no `Run` key |
| **Windows Service (auto-start at boot)** | Headless / RDS | Service + browser app mode; bridge binds **127.0.0.1** only |
| **Do not auto-start import** | Performance | Import remains explicit user/IT action |

**Policy:** Auto-start the **app + bridge**, not **full mirror import**.

---

## 11. Update strategy

### 11.1 Channels

| Channel | Audience | Contents |
| --- | --- | --- |
| **Stable** | Production clinics | Signed installer; release notes |
| **Beta** | Pilot site | Optional second feed |

### 11.2 What updates contain

- Electron shell + bundled **web `dist/`** + **bridge `dist/`** + pinned **Node runtime** revision.
- **Not** clinic `DATA` or mirror — data stays outside the installer.

### 11.3 Mechanics (Windows MVP)

- **electron-builder** + **NSIS** one-click installer; **code signing** certificate (avoid SmartScreen warnings).
- **Auto-update:** `electron-updater` checking HTTPS release manifest; download in background; prompt restart (bridge must stop cleanly before swap).
- **Schema migrations:** ship new `sqlite-mirror` migrations in app bundle; run on next **import** or dedicated **migrate-only** step — document backward compatibility per `docs/phase-2-sqlite-schema.md`.
- **Config migration:** version field in `config.json`; preserve `DATA_ROOT` / `SQLITE_PATH` across upgrades.

### 11.4 Rollback

- Keep **previous installer** offline for IT.
- Mirror backup (§9) before first import on new version.

---

## 12. Offline-only local security model

| Principle | Packaged enforcement |
| --- | --- |
| **No cloud dependency** | App works fully offline; updates optional and batched |
| **Loopback-only API** | `BRIDGE_HOST=127.0.0.1`; firewall does not need inbound rules |
| **No inbound remote admin** | No `POST` import over HTTP in MVP |
| **Read-only legacy** | Bridge opens DBF with `O_RDONLY`; no write APIs in Phase 1–2 |
| **Renderer isolation** | No Node integration in UI; no `remote` module |
| **Secrets** | No API keys in Phase 1–2; optional future localhost token stored in OS credential vault |
| **PHI on disk** | Lives in operator-chosen `DATA_ROOT` copy and mirror — encrypt disk (BitLocker) at clinic policy level |
| **Telemetry** | Opt-in only; default off; never send row payloads |

**Threat model (explicit non-goals for MVP):** multi-user auth, RBAC, audit writes, HIPAA BAA for a vendor cloud — local desktop trust boundary only.

---

## 13. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **Antivirus / SmartScreen** | Blocks unsigned `node.exe` or new Electron app; slow first launch | Authenticode signing; EV cert if budget allows; submit false-positive reports; install to `Program Files` with standard paths |
| **Windows permissions** | Cannot read `DATA_ROOT` on protected share; UAC blocks Program Files write | Install app to user-writable locations; run wizard as user; document **read access** to copy share; avoid requiring admin for daily use |
| **Old FoxPro files** | Parser failures, memo/CDX mismatch, corrupted DBF | Import-time quarantine (`import_errors`); UI DBF fallback; never point at live legacy; validate copy completeness (DBF+CDX+FPT) per `docs/legacy-system-map.md` |
| **Network drives (`\\server\…`)** | Slow scans, timeouts, **file locking** if legacy still open | **Require local SSD copy** for `DATA_ROOT` in runbook; detect SMB path in wizard and warn |
| **File locking** | Bridge read fails while FoxPro or backup tool has exclusive lock | Read-only open still fails if legacy has lock — schedule copy during maintenance window; use **Volume Shadow Copy** for backups, not live folder |
| **SQLite on network paths** | Corruption, `database is locked` | **Forbid** `SQLITE_PATH` on UNC in validator; keep mirror on `%LocalAppData%` |
| **Symlinks / junctions** | Escape `DATA_ROOT` sandbox | Existing `realpath` checks; warn if junction detected |
| **Port conflict** | Second instance or other app on `17890` | Configurable `BRIDGE_PORT`; single-instance mutex in main |
| **Node version drift** | Import fails on older runtime | Ship **Node 22.5+** alongside app; version gate in About |
| **Large mirror import** | UI frozen if run on main thread | Run import in **worker child** with progress window |
| **CORS / origin mismatch** | Packaged UI Offline while `/health` works in browser | Single-origin static+API on bridge (§8) |

---

## 14. Recommended MVP packaging milestone

**Milestone name:** **Windows Desktop MVP (Electron)**

**Definition of done:**

1. **`apps/desktop`** (new) Electron main + tray; **no new npm deps in Phase 3 plan band** — implementation band may add `electron` only when explicitly approved.
2. **Bundled artifacts:** `apps/web` production build + `services/bridge` build + pinned Node **22.5+** runtime.
3. **Config:** `%AppData%\Microdent\config.json` with `DATA_ROOT`, optional `SQLITE_PATH`, `BRIDGE_PORT`.
4. **Lifecycle:** Start bridge on app launch; stop on quit; single-instance lock.
5. **Config default:** `writeMode: "disabled"` in `%AppData%\Microdent\config.json` (see `apps/desktop/src/config.ts`).
6. **UI:** Window loads app against loopback; top-bar health works; **Settings** page shows mirror status via `/v1/mirror/status`.
6. **Import:** Menu action runs safe mirror import executable with progress + log file (no terminal).
7. **Installer:** Signed NSIS `.exe`; optional “launch at logon” checkbox.
8. **Docs:** Clinic runbook (copy DATA → set paths → import → daily use); **no** changes to `Microdent-Legacy`.
9. **Smoke test checklist:** cold boot → Connected; patient search; schedule day view; mirror active after import; quit leaves no orphan `node` on port 17890.

**Explicitly out of MVP:**

- macOS / Linux installers
- Tauri shell (follow-on)
- Auto-update server (can be manual installer download for first pilot)
- Writes to legacy DBF
- HTTP-triggered import

**Estimated sequencing after MVP:**

| Step | Deliverable |
| --- | --- |
| 3.1 | Bridge serves static UI; remove Vite port dependency |
| 3.2 | Auto-update + code signing pipeline |
| 3.3 | Tauri shell reusing bridge bundle |
| 3.4 | Optional Windows Service profile for RDS |

---

## 15. Implementation notes (future bands — not in this doc’s scope)

- Add **`apps/desktop`** per `docs/master-build-plan.md` when implementation starts.
- Extend bridge with **`express.static`** for `apps/web/dist` in production packaged mode.
- Promote mirror diagnostics from **dev-only** flags to **Settings** using existing `getMirrorStatus()`.
- Keep **`pnpm mirror:import-safe`** as the canonical import entry; packaged app wraps the same binary.

---

## 16. Related docs

- `docs/master-build-plan.md` — Phase A11 desktop packaging; Tauri vs Electron
- `docs/phase-1a-safety-module.md` — `DATA_ROOT` sandbox
- `docs/phase-1a-bridge-health-ui.md` — health probe behavior
- `docs/phase-2-mirror-import-command.md` — import command
- `docs/phase-2-mirror-status.md` — mirror health API
- `docs/phase-2-sqlite-mirror-plan.md` — mirror architecture
- `docs/legacy-system-map.md` — backup and high-risk files
- `README.md` — dev bridge/web commands

---

## 17. Definition of done (this document)

- [x] `docs/phase-3-desktop-packaging-plan.md` exists
- [x] No application code or package dependency changes
- [x] No legacy paths modified
