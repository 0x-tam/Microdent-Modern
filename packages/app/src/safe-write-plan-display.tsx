import type { SafeWritePlan, SafeWritePlanWarning } from "@microdent/contracts";
import {
  SANDBOX_WRITE_BLOCKED_SANDBOX,
  SANDBOX_WRITE_BLOCKED_WRITE_MODE,
  SANDBOX_WRITE_PILOT_PANEL_BANNER,
  WRITE_POST_COMMIT_MIRROR_NUDGE,
  writeResultCommittedHeadline,
  writeResultUncommittedHeadline,
} from "./read-only-ui-copy.js";
import type { SandboxWriteBlockReason } from "./sandbox-write-pilot.js";

export type WritePlanResultSummary = {
  workflow: string;
  mode: string;
  committed: boolean;
  table: string;
  recordId: string;
  field: string;
  warnings: readonly string[];
};

export function summarizeWritePlan(plan: SafeWritePlan): WritePlanResultSummary {
  const firstChange = plan.fieldsChanged[0];
  return {
    workflow: plan.workflow,
    mode: plan.mode,
    committed: plan.committed,
    table: firstChange?.table ?? plan.tablesAffected[0] ?? "—",
    recordId: firstChange?.recordId ?? plan.recordIds[0] ?? "—",
    field: firstChange?.field ?? "—",
    warnings: plan.warnings.map(formatWarningLabel),
  };
}

function formatWarningLabel(w: SafeWritePlanWarning): string {
  return `${w.code} (${w.severity})`;
}

/** Tokens that must never appear in write result panels (PHI / raw row leakage). */
export const FORBIDDEN_WRITE_RESULT_TOKENS = [
  "PAT_NAME",
  "TELEPHONE",
  "COMMENT",
  "NOTE",
  "DESCRIPT",
  "DESC",
  "AMOUNT",
  "SAMOUNT",
  "rawRow",
  '"before"',
  '"after"',
] as const;

export function containsForbiddenWriteResultToken(text: string): boolean {
  return FORBIDDEN_WRITE_RESULT_TOKENS.some((token) => text.includes(token));
}

export type SandboxWriteBannerProps = {
  className?: string;
};

export function SandboxWriteBanner({ className }: SandboxWriteBannerProps) {
  return (
    <p className={className ?? "app-sandbox-write__banner"} role="status">
      {SANDBOX_WRITE_PILOT_PANEL_BANNER}
    </p>
  );
}

export type SafeWritePlanResultProps = {
  summary: WritePlanResultSummary;
  className?: string;
  testId?: string;
};

export function SafeWritePlanResult({ summary, className, testId }: SafeWritePlanResultProps) {
  return (
    <dl
      className={className ?? "app-sandbox-write__plan"}
      aria-label="Safe write plan summary"
      data-testid={testId}
    >
      <PlanRow label="Workflow" value={summary.workflow} />
      <PlanRow label="Mode" value={summary.mode} />
      <PlanRow label="Committed" value={String(summary.committed)} />
      <PlanRow label="Table" value={summary.table} />
      <PlanRow label="Record id" value={summary.recordId} />
      <PlanRow label="Field changed" value={summary.field} />
      <PlanRow
        label="Warnings"
        value={summary.warnings.length > 0 ? summary.warnings.join(", ") : "—"}
      />
    </dl>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-sandbox-write__plan-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export type SandboxWriteBlockedNoticeProps = {
  reason: SandboxWriteBlockReason;
  className?: string;
  testId?: string;
};

function sandboxWriteBlockedMessage(reason: SandboxWriteBlockReason): string {
  if (reason === "write-mode-off") {
    return SANDBOX_WRITE_BLOCKED_WRITE_MODE;
  }
  return SANDBOX_WRITE_BLOCKED_SANDBOX;
}

export function SandboxWriteBlockedNotice({ reason, className, testId }: SandboxWriteBlockedNoticeProps) {
  return (
    <div
      className={className ?? "app-sandbox-write app-sandbox-write--blocked"}
      role="status"
      data-testid={testId}
    >
      <p className="app-sandbox-write__blocked">{sandboxWriteBlockedMessage(reason)}</p>
    </div>
  );
}

export type WriteOperationResultProps = {
  committed: boolean;
  successLabel: string;
  feedbackLines: readonly string[];
  mode?: string;
  className?: string;
  headlineClassName?: string;
  testId?: string;
};

export function WriteOperationResult({
  committed,
  successLabel,
  feedbackLines,
  mode,
  className,
  headlineClassName,
  testId,
}: WriteOperationResultProps) {
  const headline = committed
    ? writeResultCommittedHeadline(successLabel, mode)
    : writeResultUncommittedHeadline(mode);

  return (
    <div
      className={className ?? "app-sandbox-write__result"}
      data-testid={testId}
      data-committed={String(committed)}
      role="status"
    >
      <p className={headlineClassName ?? "app-sandbox-write__result-summary"}>{headline}</p>
      {feedbackLines.map((line) => (
        <p key={line} className="app-sandbox-write__result-line">
          {line}
        </p>
      ))}
      {committed ? (
        <p className="app-sandbox-write__result-nudge">{WRITE_POST_COMMIT_MIRROR_NUDGE}</p>
      ) : null}
    </div>
  );
}
