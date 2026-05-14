# Phase 1A — Safety module (Band A2)

## What was built

- **`services/bridge/src/config.ts`**: `parseDataRootFromValue`, `loadDataRootFromEnv`, `loadListenOptions`, and `loadBridgeConfig`. `DATA_ROOT` is read from the environment; empty or whitespace means **not configured**. When set, the value must be an **absolute** path (validated with `path.isAbsolute`); otherwise startup / parsing throws. When the directory exists, `realPath` is `fs.realpathSync.native`; if it does not exist yet, `realPath` falls back to `path.resolve` of the normalized path for stable prefix checks.
- **`services/bridge/src/safety/path-sandbox.ts`**: `resolvePathWithinDataRoot(root, logicalRelativePath)` — rejects NUL bytes, empty logical paths, **absolute** logical paths, `.` / `..` segments, join-time escape (via `path.relative`), and **symlink / junction escape** when the target exists by comparing `realpathSync.native` of the candidate to the sandbox root.
- **`services/bridge/src/safety/read-only-file.ts`**: `openFileReadOnly` opens with `fs.constants.O_RDONLY` only (no writes, no create flags).
- **`services/bridge/src/safety/open-under-data-root.ts`**: `openReadOnlyUnderDataRoot` / `openReadOnlyUnderConfiguredRoot` combine resolution + read-only open. Throws `PathSandboxError` when `DATA_ROOT` is not configured.
- **`services/bridge/src/safety/index.ts`**: barrel exports for the safety module.
- **`services/bridge/src/server.ts`**: loads **`loadBridgeConfig()`** before listen so invalid relative `DATA_ROOT` fails fast at process start.
- **Tests** in `src/safety/safety.test.ts`: valid root, missing / empty `DATA_ROOT`, relative `DATA_ROOT` rejected, traversal and absolute logical paths rejected, symlink escape rejected (skipped soft-fail on `EPERM`/`EACCES` when symlinks are blocked), normal nested file accepted, read-only open verified, unconfigured root open rejected.

## What was intentionally not built

- No HTTP routes beyond existing **`GET /health`**; file contents are not returned by the API.
- No DBF parsing, table registry, or `GET /v1/*` routes.
- No writes, deletes, renames, or mkdir under legacy data paths from the bridge.
- No rate limiting or auth headers (later bands).

## Symlink and platform tradeoffs

- **Existence vs intent**: For paths that **do not exist** on disk yet, the helper cannot call `realpath` on the final file; containment is enforced with normalized `path.join` + `path.relative` checks. Once a path **exists**, `realpathSync.native` is required so a symlink inside the tree cannot point outside `DATA_ROOT`.
- **macOS `/tmp` vs `/private/tmp`**: Using `realpathSync.native` on the configured directory aligns the sandbox prefix with the kernel-resolved path.
- **Windows**: Prefix checks use case-insensitive `startsWith` for drive-letter paths. **Symlinks and junctions** may require elevated rights or Developer Mode; the integration-style symlink test skips when `symlinkSync` returns `EPERM`/`EACCES`.
- **Residual risk**: A race (TOCTOU) between resolve and open is not fully closed without `O_NOFOLLOW` semantics on all platforms; Node’s portable `fs.open` flags do not expose `O_NOFOLLOW` everywhere. Mitigation later can include opening parents with controlled checks or platform-specific flags where available.
- **Non-existent `DATA_ROOT`**: Allowed at parse time so operators can set env before copying data; path resolution still requires a coherent tree before successful opens.

## Next (Band A3+)

Table registry, fixture DBF, and first read routes — building on this sandbox and read-only open helper.
