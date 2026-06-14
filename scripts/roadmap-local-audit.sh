#!/usr/bin/env bash
# Local roadmap audit — non-destructive release/evidence checks.
#
# This command proves the staged handoff pack and local evidence gates are wired,
# while confirming external package verification, field, and commercial evidence
# remains blocked until filed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() { echo "[roadmap-local-audit] $*"; }
fail() { echo "[roadmap-local-audit] FAIL: $*" >&2; exit 1; }

expect_blocked() {
  local label="$1"
  local expected="$2"
  shift 2

  local out
  local code
  out="$(mktemp)"
  set +e
  "$@" >"${out}" 2>&1
  code=$?
  set -e

  if [[ "${code}" -eq 0 ]]; then
    cat "${out}" >&2
    rm -f "${out}"
    fail "${label} unexpectedly passed"
  fi
  if ! grep -q "${expected}" "${out}"; then
    cat "${out}" >&2
    rm -f "${out}"
    fail "${label} did not print ${expected}"
  fi
  rm -f "${out}"
  log "${label}: expected blocked"
}

cd "${REPO_ROOT}"

log "git diff --check"
git diff --check

log "pnpm pilot:evidence-repo-guard"
pnpm pilot:evidence-repo-guard

log "pnpm pilot:package-verify-packet"
pnpm pilot:package-verify-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json >/dev/null

log "pnpm pilot:windows-field-packet"
pnpm pilot:windows-field-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json >/dev/null

log "pnpm pilot:installer-packet"
pnpm pilot:installer-packet -- --date 2026-06-06 --target nsis --json >/dev/null

log "pnpm pilot:auto-update-packet"
pnpm pilot:auto-update-packet -- --date 2026-06-06 --channel internal-signed-feed --json >/dev/null

log "pnpm pilot:go-live-packet"
pnpm pilot:go-live-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json >/dev/null

log "pnpm pilot:commercial-launch-packet"
pnpm pilot:commercial-launch-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json >/dev/null

log "pnpm pilot:evidence-collection-packet"
pnpm pilot:evidence-collection-packet -- --date 2026-06-06 --clinic-label CLINIC-PC-01 --json >/dev/null

log "pnpm test:pilot-artifacts"
pnpm test:pilot-artifacts

log "pnpm stage:pilot-release"
pnpm stage:pilot-release

log "pnpm pilot:verify-release"
pnpm pilot:verify-release

log "pnpm pilot:verify-manifest"
pnpm pilot:verify-manifest

log "pnpm pilot:staged-link-audit"
pnpm pilot:staged-link-audit

log "checking staged qa-runs templates"
source_templates="$(mktemp)"
staged_templates="$(mktemp)"
find qa-runs -maxdepth 1 -type f -name 'TEMPLATE-*' | sed 's|.*/||' | sort >"${source_templates}"
find dist/pilot-release/MicrodentModern/qa-runs -maxdepth 1 -type f -name 'TEMPLATE-*' | sed 's|.*/||' | sort >"${staged_templates}"
source_template_count="$(wc -l <"${source_templates}" | tr -d ' ')"
staged_template_count="$(wc -l <"${staged_templates}" | tr -d ' ')"
if ! diff -u "${source_templates}" "${staged_templates}" >/dev/null; then
  missing="$(comm -23 "${source_templates}" "${staged_templates}" | paste -sd ', ' -)"
  extra="$(comm -13 "${source_templates}" "${staged_templates}" | paste -sd ', ' -)"
  rm -f "${source_templates}" "${staged_templates}"
  fail "missing staged qa-runs templates: ${missing:-none}; unexpected staged qa-runs templates: ${extra:-none}"
fi
rm -f "${source_templates}" "${staged_templates}"
if [[ "${source_template_count}" != "23" || "${staged_template_count}" != "23" ]]; then
  fail "expected 23 source qa-runs templates and 23 staged qa-runs templates, found source=${source_template_count} staged=${staged_template_count}"
fi

expect_blocked "package verification template" "PACKAGE VERIFY: BLOCKED" \
  pnpm pilot:package-verify-evidence -- qa-runs/TEMPLATE-windows-package-verify-evidence.json

expect_blocked "attachment manifest template" "ATTACHMENT MANIFEST: BLOCKED" \
  pnpm pilot:attachment-manifest -- qa-runs/TEMPLATE-evidence-attachment-manifest.json

expect_blocked "field evidence template" "FIELD EVIDENCE: BLOCKED" \
  pnpm pilot:field-evidence -- qa-runs/TEMPLATE-windows-field-evidence.json

expect_blocked "windows compatibility template" "WINDOWS COMPATIBILITY: BLOCKED" \
  pnpm pilot:windows-compatibility -- qa-runs/TEMPLATE-windows-compatibility-evidence.json

expect_blocked "offline license template" "OFFLINE LICENSE: BLOCKED" \
  pnpm license:validate -- qa-runs/TEMPLATE-offline-license.json

expect_blocked "signed artifact template" "SIGNED ARTIFACTS: BLOCKED" \
  pnpm pilot:signed-artifacts -- qa-runs/TEMPLATE-signed-artifact-evidence.json

expect_blocked "installer evidence template" "INSTALLER EVIDENCE: BLOCKED" \
  pnpm pilot:installer-evidence -- qa-runs/TEMPLATE-installer-evidence.json

expect_blocked "auto-update evidence template" "AUTO UPDATE EVIDENCE: BLOCKED" \
  pnpm pilot:auto-update-evidence -- qa-runs/TEMPLATE-auto-update-evidence.json

expect_blocked "clinic pilot report template" "CLINIC PILOT REPORT: BLOCKED" \
  pnpm pilot:clinic-report -- qa-runs/TEMPLATE-clinic-pilot-report.json

expect_blocked "support readiness template" "SUPPORT READINESS: BLOCKED" \
  pnpm pilot:support-readiness -- qa-runs/TEMPLATE-support-readiness-evidence.json

expect_blocked "distribution evidence template" "DISTRIBUTION EVIDENCE: BLOCKED" \
  pnpm pilot:distribution-evidence -- qa-runs/TEMPLATE-distribution-evidence.json

expect_blocked "pricing evidence template" "PRICING EVIDENCE: BLOCKED" \
  pnpm pilot:pricing-evidence -- qa-runs/TEMPLATE-pricing-evidence.json

expect_blocked "marketing evidence template" "MARKETING EVIDENCE: BLOCKED" \
  pnpm pilot:marketing-evidence -- qa-runs/TEMPLATE-marketing-evidence.json

expect_blocked "go-live evidence template" "GO-LIVE EVIDENCE: BLOCKED" \
  pnpm pilot:go-live-evidence -- qa-runs/TEMPLATE-go-live-evidence.json

expect_blocked "evidence filing plan" "Status:.*BLOCKED" \
  pnpm pilot:evidence-filing-plan

expect_blocked "commercial evidence status" "COMMERCIAL EVIDENCE STATUS: BLOCKED" \
  pnpm pilot:commercial-evidence-status

expect_blocked "commercial readiness template" "COMMERCIAL READINESS: BLOCKED" \
  pnpm pilot:commercial-readiness -- qa-runs/TEMPLATE-commercial-readiness-evidence.json

expect_blocked "roadmap completion audit" "package_verification=blocked" \
  pnpm roadmap:completion-audit

echo ""
echo "ROADMAP LOCAL AUDIT: READY"
echo "Tier 1 — Mac-side staged handoff checks: READY"
echo "Tier 2 — Windows-test pack/docs/templates: READY"
echo "Tier 3 — Windows execution evidence: BLOCKED until package verification and field evidence with packageVerification.evidencePath are filed"
echo "Commercial readiness: BLOCKED until signing/installer/update/pilot/support/distribution/pricing/marketing/license/go-live evidence is filed"
