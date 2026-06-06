# Windows pilot release layout

**Purpose:** Define what ships in a staged pilot package vs what operators create on disk. No clinic DATA, mirror SQLite, or Legacy trees are bundled.

**Build:** `pnpm build:web` → bridge build → desktop build → `pnpm stage:pilot-release` → `pnpm pilot:verify-release` → `pnpm pilot:verify-manifest`

---

## Staged output directory

Node script [`scripts/stage-pilot-release.mjs`](../scripts/stage-pilot-release.mjs) writes:

```
dist/pilot-release/
└── MicrodentModern/
    ├── PILOT-START-HERE.md     # First-click pointer → docs/PILOT-HANDOFF-PACK.md
    ├── HANDOFF-README.txt      # IT install + validation steps (PHI-safe)
    ├── HANDOFF-README.md       # Markdown handoff (same content, operator-friendly)
    ├── RELEASE-MANIFEST.json   # Content SHA-256 manifest (no paths/secrets in JSON)
    ├── app/                    # Electron desktop dist + minimal package.json
    │   └── dist/
    ├── bridge/                 # services/bridge/dist (compiled JS only)
    ├── web/                    # apps/web/dist (static UI) + pilot-build.json metadata
    ├── config-templates/       # placeholders only (no real clinic paths)
    ├── docs/                   # pilot index copies (no PHI)
    ├── scripts/                # operator pointers (README + mirror-import-pointer)
    ├── qa-runs/                # README.txt placeholder — dev/CI reports only
    ├── logs/                   # README.txt placeholder — no runtime logs
    ├── mirror/                 # README.txt placeholder — no sqlite shipped
    └── backups/                # README.txt placeholder — no backup data
```

`dist/pilot-release/` is gitignored (see root `.gitignore`).

---

## Shipped vs operator-selected

| Artifact | Shipped in package? | Operator provides |
| --- | --- | --- |
| Desktop shell (`app/dist/main.js`, setup HTML) | **Yes** | — |
| Bridge server (`bridge/server.js`) | **Yes** | — |
| Web UI (`web/index.html` + assets) | **Yes** | — |
| Config templates (`config-templates/*.example.*`) | **Yes** (Windows placeholders) | Real `%AppData%\Microdent\config.json` |
| **DATA_ROOT** (DBF sandbox) | **Never** | Disposable Write-Sandbox folder |
| **SQLITE_PATH** (mirror) | **Never** | Mirror file on local disk |
| **BACKUP_DIR** | **Never** | Folder before sandbox commits |
| `logs/` | **Never** (placeholder only) | Optional operator log folder |
| `mirror/` | **Never** (placeholder only) | Path in config only |
| `backups/` | **Never** (placeholder only) | Path in config only |
| Node 22 runtime | **Optional bundled** | `MICRODENT_NODE_RUNTIME_DIR` is validated by `pnpm pilot:node-runtime-check` and staged into `node/` with `RUNTIME-MANIFEST.json`; fallback is system `node.exe` / `MICRODENT_NODE_BINARY` |
| NSIS / MSI / code signing | **Out of scope** | See packaging gap report |

---

## Folder roles (operator machine)

| Folder | Created by | Notes |
| --- | --- | --- |
| Install / extract dir | IT | e.g. `C:\Program Files\MicrodentModern\` — contents of `MicrodentModern/` |
| `%AppData%\Microdent\` | Desktop on first save | `config.json` only |
| DATA_ROOT | Operator | Sandbox DBF tree + marker — **outside** install dir |
| Mirror file | Operator | Path from setup — not inside app install |
| Backups | Operator | Outside app install; see [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) |
| Logs | Operator | Outside app install if captured; see data-locations doc |

---

## Staging script safety

Shared rules live in [`scripts/pilot-release-artifact-rules.mjs`](../scripts/pilot-release-artifact-rules.mjs). The staging script:

- Copies **only** from `apps/desktop/dist`, `services/bridge/dist`, and `apps/web/dist`
- Writes **templates** under `config-templates/` (`config.example.json`, `paths.example.env`) with generic Windows placeholders
- Rejects templates containing developer home paths, repo checkout paths, or `Microdent-Legacy`
- **Filters** during copy: `.env`, `.log`, `.sqlite`, `.fpt`, `.cdx`, `.exe`, `.bat`, `.cmd`, real `.dbf` (except test `fake_tiny.dbf` in bridge source build)
- **Fails** if a source path segment matches Legacy / Write-Sandbox / Legacy-Copy
- **Post-scan** staged tree via shared artifact rules
- Emits **`RELEASE-MANIFEST.json`** with per-file SHA-256 (`packageVersion`, `releaseChannel`, `unsupportedFeatures[]`; timestamp is metadata only — not hashed)
- Writes **`web/pilot-build.json`** (safe build metadata subset for Settings — no paths)
- Emits root **`PILOT-START-HERE.md`** and **`qa-runs/README.txt`** placeholder
- Logs **counts only** (no paths, no PHI)

**No new npm packaging dependencies** — Node stdlib `fs` / `path` / `crypto` only (root `vitest` is dev-only for artifact tests).

### Forbidden in staged tree (verify mirrors stage)

| Category | Examples |
| --- | --- |
| Clinic data | `SCHEDULE.DBF`, live `.dbf` / `.fpt` / `.cdx` trees |
| Mirror / backups | `.sqlite`, `.sqlite3`, populated `backups/` |
| Secrets / runtime | `.env`, `.log` |
| Installers / scripts | `.exe`, `.bat`, `.cmd` |
| Legacy segments | `Microdent-Legacy`, `Write-Sandbox`, `Microdent-Write-Sandbox`, `Legacy-Copy` |
| Real local paths in templates | `/Users/…`, `/home/…`, `Microdent-Modern` checkout paths |

Supervisor invariant: staged `bridge-supervisor.js` must `spawn(node, [bridgeEntry])` only — no `.bat`/`.cmd`/foxpro/legacy argv.

---

## Verification

| Command | Proves |
| --- | --- |
| `pnpm test:pilot-artifacts` | Synthetic good/bad trees + manifest round-trip (vitest) |
| `pnpm desktop:release-smoke` | Dev tree dist + supervisor invariants |
| `PILOT_STAGED_RELEASE=1 pnpm desktop:release-smoke` | Staged `MicrodentModern/` supervisor argv |
| `pnpm stage:pilot-release` (alias `pnpm pilot:stage-release`) | Clean staged tree + manifest |
| `pnpm pilot:verify-release` | Layout + `scanStagedArtifacts` (compiled path leaks, logs/) + manifest hashes |
| `pnpm pilot:verify-manifest` | Manifest hash check only |

---

## Logging / support hygiene

- Desktop logs masked path hints only (`maskOperatorPath`); bridge child output is not forwarded to the console
- Do not attach patient names, DBF files, full config paths, or `.env` contents in support tickets
- See [phase-8-log-redaction-review.md](./phase-8-log-redaction-review.md)

---

## Related docs

- [PILOT-START-HERE.md](./PILOT-START-HERE.md)
- [windows-pilot-data-locations.md](./windows-pilot-data-locations.md)
- [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md)
- [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md)
- [windows-dev-dry-run.md](./windows-dev-dry-run.md)
