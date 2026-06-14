# Windows package verification (no pnpm / no repo)

**Purpose:** IT checks the staged `MicrodentModern/` folder **on a Windows clinic or handoff PC** before operators start — without Node tooling from the build repo.

**Audience:** IT, release coordinator, pilot sponsor.

**Build-machine note:** Hash integrity and automated guards also run via `pnpm pilot:verify-release` and `pnpm pilot:verify-manifest` on the build machine. This doc is the **manual Windows spot-check** when pnpm is unavailable.

**Evidence:** File PHI-safe package verification evidence with [windows-package-verify-evidence.md](./windows-package-verify-evidence.md) before starting the field execution packet.

**Related:** [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) §0 · [windows-pilot-release-layout.md](./windows-pilot-release-layout.md) · [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md)

---

## Prerequisites

| Item | Detail |
| --- | --- |
| Package location | Extracted folder, e.g. `C:\Microdent\MicrodentModern\` |
| Tools | File Explorer, Notepad or VS Code, optional PowerShell (read-only checks) |
| Not required | Git, pnpm, repo clone |

---

## Verification checklist

Complete in order. Record results on [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) §0 or your IT ticket.

### 1. Root layout present

Confirm these exist at the package root:

| Path | Required |
| --- | --- |
| `PILOT-START-HERE.md` | Yes |
| `HANDOFF-README.txt` | Yes |
| `RELEASE-MANIFEST.json` | Yes |
| `app/` | Yes — desktop shell |
| `bridge/` | Yes — compiled bridge |
| `web/` | Yes — static UI + `pilot-build.json` |
| `config-templates/` | Yes — placeholders only |
| `docs/` | Yes — pilot handoff copies |

### 2. Open `RELEASE-MANIFEST.json`

Open in a text editor (read-only). Record these fields for support tickets:

| Field | What to record | Expected |
| --- | --- | --- |
| `packageVersion` | e.g. `pilot-2026-05-24` | Date-stamped pilot id |
| `releaseChannel` | Copy value | `pilot` |
| `appVersion` | Desktop semver | From build |
| `gitCommit` | Full or short hash | Build commit |
| `unsupportedFeatures` | Entire array | Non-empty list |

**Expected `unsupportedFeatures` entries** (scope lock — UI must not promise these):

- payments
- ledger writes
- chart writes
- signed installer / auto-update
- installer

**Do not** expect manifest to contain clinic paths, `.env` values, or patient data. If you see `/Users/`, `Microdent-Legacy`, or home-directory paths inside the JSON, **stop** — package failed build hygiene; request a re-stage from engineering.

**Build machine:** `pnpm pilot:verify-manifest` re-computes SHA-256 for every listed file and fails on tampering. IT on Windows typically **records** version fields; hash re-check is optional without Node scripts.

### 3. Confirm no forbidden clinic artifacts

Manual spot-check — search the package tree for files that must **not** ship:

| Forbidden | Examples | Action if found |
| --- | --- | --- |
| Clinic DBF | `SCHEDULE.DBF`, `PATIENT.DBF`, `.fpt`, `.cdx` | **Fail** — do not deploy |
| Mirror / DB | `.sqlite`, `.sqlite3` | **Fail** |
| Secrets / runtime | `.env`, `.log` | **Fail** |
| Installers / batch | `.bat`, unexpected `.cmd`, unexpected `.exe` in package | **Fail** (`DOUBLE-CLICK-AUTO-TEST.cmd` and `DOUBLE-CLICK-WINDOWS-TEST.cmd` are the allowed portable smoke runners; `node\node.exe` is allowed only when bundled runtime is validated and listed in `node\RUNTIME-MANIFEST.json`) |
| Legacy path segments | Folder names `Microdent-Legacy`, `Write-Sandbox`, `Legacy-Copy` | **Fail** |

Allowed exception at build time only: test fixture `fake_tiny.dbf` inside bridge **source** — must **not** appear in staged handoff tree.

Optional PowerShell read-only scan (copy-paste — **does not modify files**):

```powershell
# Run from package root, e.g. C:\Microdent\MicrodentModern
$root = Get-Location
$forbiddenExt = @('.dbf','.sqlite','.sqlite3','.env','.log','.fpt','.cdx','.exe','.bat','.cmd')
$allowedRel = @(
  'DOUBLE-CLICK-AUTO-TEST.cmd',
  'DOUBLE-CLICK-WINDOWS-TEST.cmd',
  'node\node.exe'
)
$hits = Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object {
    $rel = [System.IO.Path]::GetRelativePath($root, $_.FullName)
    $forbiddenExt -contains $_.Extension.ToLower() -and
    $_.Name -ne 'fake_tiny.dbf' -and
    $allowedRel -notcontains $rel
  } |
  Select-Object -ExpandProperty FullName
if ($hits) {
  Write-Host "FAIL — forbidden files found:" -ForegroundColor Red
  $hits | ForEach-Object { Write-Host $_ }
  exit 1
} else {
  Write-Host "OK — no forbidden extensions under $root"
}
```

Also spot-check **File Explorer search** in the package root for `*.sqlite` and `*.dbf` if PowerShell execution is restricted.

### 4. `config-templates/` — placeholders only

Open:

- `config-templates/config.example.json`
- `config-templates/paths.example.env`

| Check | Pass |
| --- | --- |
| Paths use generic Windows examples (e.g. `C:\ClinicData\Microdent\DATA`) | ☐ |
| No developer home paths (`/Users/…`, `/home/…`) | ☐ |
| No `Microdent-Legacy` or repo checkout paths | ☐ |
| No real clinic identifiers | ☐ |

Real operator config is created at **`%AppData%\Microdent\config.json`** on first run — not by editing shipped templates in-place.

### 5. Placeholder folders — README only

These folders must **not** contain clinic data at handoff:

| Folder | Expected contents |
| --- | --- |
| `logs/` | `README.txt` (or equivalent placeholder) only |
| `mirror/` | README placeholder only — no `.sqlite` |
| `backups/` | README placeholder only — no backup archives |
| `qa-runs/` | README + `TEMPLATE-*` files only — completed dev/CI/clinic reports not shipped |
| `node/` | README placeholder, or validated Node runtime plus `RUNTIME-MANIFEST.json` |

Operators create real mirror, backup, and log locations **outside** the install tree per [windows-pilot-data-locations.md](./windows-pilot-data-locations.md).

### 6. `web/pilot-build.json` matches manifest subset

Open `web/pilot-build.json` and compare to manifest:

| Field in `pilot-build.json` | Must match `RELEASE-MANIFEST.json` |
| --- | --- |
| `appVersion` | Same |
| `packageVersion` | Same |
| `gitCommit` | Same (manifest may be full hash; pilot-build may truncate to 7 chars) |
| `releaseChannel` | Same |
| `buildTimestampUtc` | Same |

**Must not appear** in `pilot-build.json`: `dataRoot`, `sqlitePath`, `backupDir`, or any clinic path.

After launch, **Settings → Pilot build** card should show the same version subset for operator confirmation.

### 7. Unsupported features not promised in UI

Cross-check manifest `unsupportedFeatures` against product scope:

| Feature | Expected in pilot UI |
| --- | --- |
| Payments / ledger | Not available — guardrail messaging if probed |
| Chart / medical summary writes | Not available |
| Local copy refresh | Available in Settings — first-run setup prepares it automatically; CLI is support fallback only |
| Installer / auto-update | Not included — portable extract only |

Full guardrails: [out-of-scope-guardrails.md](./out-of-scope-guardrails.md)

---

## Pass / fail decision

| Result | Criteria |
| --- | --- |
| **PASS** | Layout complete; manifest fields recorded; no forbidden files; templates placeholders; pilot-build aligns; placeholders empty |
| **FAIL** | Any clinic DBF/sqlite/env/log in tree; legacy path segments; manifest contains forbidden tokens; missing `app/`, `bridge/`, or `web/` |
| **CONDITIONAL** | PowerShell scan blocked by policy — complete manual File Explorer search and document in IT ticket |

On **PASS**, operators may proceed to [PILOT-START-HERE.md](./PILOT-START-HERE.md) and [windows-pilot-field-execution-script.md](./windows-pilot-field-execution-script.md).

On **FAIL**, do not copy to clinic PCs — contact build owner to re-run `pnpm stage:pilot-release` and `pnpm pilot:verify-release` on the build machine.

---

## Record sheet (copy to IT ticket)

```text
Package path: C:\Microdent\MicrodentModern\
Verified by:
Date:

packageVersion:
releaseChannel:
appVersion:
gitCommit:

Layout check (0.4): PASS / FAIL
Forbidden files (0.5): PASS / FAIL
config-templates placeholders (0.6): PASS / FAIL
pilot-build.json match: PASS / FAIL
Placeholder folders empty: PASS / FAIL

Decision: PASS / FAIL
Notes:
```

---

## Related docs

| Doc | Use when |
| --- | --- |
| [windows-pilot-troubleshooting-pack.md](./windows-pilot-troubleshooting-pack.md) | Operator failures after deploy |
| [pilot-acceptance-checklist.md](./pilot-acceptance-checklist.md) | Full IT sign-off including runtime checks |
| [windows-pilot-release-layout.md](./windows-pilot-release-layout.md) | Staged tree reference |
| [PILOT-HANDOFF-PACK.md](./PILOT-HANDOFF-PACK.md) | Post-verify operator journey |
