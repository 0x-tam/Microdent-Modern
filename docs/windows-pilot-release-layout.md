# Windows pilot release layout

**Purpose:** Define what ships in a staged pilot package vs what operators create on disk. No clinic DATA, mirror SQLite, or Legacy trees are bundled.

**Baseline:** Microdent-Modern `main` @ `1b67d2b`

**Build:** `pnpm build:web` → bridge build → desktop build → `pnpm stage:pilot-release` → `pnpm pilot:verify-release`

---

## Staged output directory

Node script [`scripts/stage-pilot-release.mjs`](../scripts/stage-pilot-release.mjs) writes:

```
dist/pilot-release/
├── app/              # Electron desktop dist + minimal package.json
├── bridge/           # services/bridge/dist (compiled JS only)
├── web/              # apps/web/dist (static UI)
├── config/           # templates only (no real paths)
├── docs/             # pilot index copies (no PHI)
└── PLACEHOLDERS.md   # operator-created folders (not copied)
```

`dist/pilot-release/` is gitignored (see root `.gitignore`).

---

## Shipped vs operator-selected

| Artifact | Shipped in package? | Operator provides |
| --- | --- | --- |
| Desktop shell (`app/dist/main.js`, setup HTML) | **Yes** | — |
| Bridge server (`bridge/server.js`) | **Yes** | — |
| Web UI (`web/index.html` + assets) | **Yes** | — |
| Config templates (`config/*.example.*`) | **Yes** (placeholders) | Real `%AppData%\Microdent\config.json` |
| **DATA_ROOT** (DBF sandbox) | **Never** | Disposable Write-Sandbox folder |
| **SQLITE_PATH** (mirror) | **Never** | Mirror file on local disk |
| **BACKUP_DIR** | **Never** | Folder before sandbox commits |
| `logs/` | **Never** (documented only) | Optional operator log folder |
| `mirror/` | **Never** | Path in config only |
| `backups/` | **Never** | Path in config only |
| Node 22 runtime | **Not bundled** | System `node.exe` |
| NSIS / MSI / code signing | **Out of scope** | See packaging gap report |

---

## Folder roles (operator machine)

| Folder | Created by | Notes |
| --- | --- | --- |
| Install / extract dir | IT | e.g. `C:\Program Files\MicrodentModern\` or USB copy of `dist/pilot-release` |
| `%AppData%\Microdent\` | Desktop on first save | `config.json` only |
| DATA_ROOT | Operator | Sandbox DBF tree + marker |
| Mirror file | Operator | Path from setup — not inside app install |
| Backups | Operator | Outside app install; see [windows-pilot-data-locations.md](./windows-pilot-data-locations.md) |

---

## Staging script safety

The staging script:

- Copies **only** from `apps/desktop/dist`, `services/bridge/dist`, and `apps/web/dist`
- Writes **templates** under `config/` (`config.example.json`, `paths.example.env`)
- **Fails** if a source path segment matches `Microdent-Legacy`, `Write-Sandbox`, or contains `.sqlite` / `.dbf` outside bridge test fixtures
- Logs **counts only** (no paths, no PHI)

**No new npm packaging dependencies** — Node stdlib `fs` / `path` only.

---

## Verification

| Command | Proves |
| --- | --- |
| `pnpm desktop:release-smoke` | Dev tree dist + supervisor invariants |
| `pnpm stage:pilot-release` | Clean staged tree |
| `pnpm pilot:verify-release` | Layout + no forbidden artifacts in stage dir |

---

## Related docs

- [PILOT-START-HERE.md](./PILOT-START-HERE.md)
- [windows-pilot-data-locations.md](./windows-pilot-data-locations.md)
- [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md)
- [windows-pilot-packaging-gap-report.md](./windows-pilot-packaging-gap-report.md)
- [windows-dev-dry-run.md](./windows-dev-dry-run.md)
