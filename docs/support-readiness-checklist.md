# Support readiness checklist

**Purpose:** Evidence checklist for the `supportReadiness` section of [commercial-readiness-evidence.md](./commercial-readiness-evidence.md).

Commercial readiness should not mark support ready until every row below is complete with PHI-safe evidence.

## Knowledge base readiness

| Row | Requirement | Evidence |
| --- | --- | --- |
| KB-01 | [support-knowledge-base.md](./support-knowledge-base.md) included in staged package | `pnpm stage:pilot-release` + `pnpm pilot:verify-release` |
| KB-02 | Common launch, setup, local-copy, sandbox, restore, AV, support-export symptoms covered | Support lead review |
| KB-03 | Safe evidence and never-request lists reviewed by IT | Signed support readiness record |
| KB-04 | Unsupported features answer matches `RELEASE-MANIFEST.json` | Manifest verification |

## Issue workflow readiness

| Row | Requirement | Evidence |
| --- | --- | --- |
| IW-01 | [pilot-issue-template.md](./pilot-issue-template.md) included in staged package | Release verification |
| IW-02 | [pilot-feedback-triage-workflow.md](./pilot-feedback-triage-workflow.md) included in staged package | Release verification |
| IW-03 | Severity/status vocabulary adopted by pilot support team | Triage dry run or support lead sign-off |
| IW-04 | PHI stop rules understood | Support readiness record |

## Rollback runbook readiness

| Row | Requirement | Evidence |
| --- | --- | --- |
| RR-01 | [pilot-backup-restore-audit.md](./pilot-backup-restore-audit.md) reviewed | Support readiness record |
| RR-02 | Sandbox backup verify and restore commands tested on Windows field machine | Field evidence or issue rollup |
| RR-03 | Failed update/install rollback documented once installer/update exists | Commercial readiness evidence |
| RR-04 | Operators know local copy refresh is separate from DBF restore | Field script notes |

## Support readiness record

Create `qa-runs/YYYY-MM-DD-support-readiness.md` from [TEMPLATE-support-readiness.md](../qa-runs/TEMPLATE-support-readiness.md), then file machine-readable evidence from [support-readiness-evidence.md](./support-readiness-evidence.md):

```bash
pnpm pilot:support-readiness -- qa-runs/YYYY-MM-DD-support-readiness-evidence.json
```

Do not set these commercial evidence fields to `true` until that record is complete:

```json
"supportReadiness": {
  "knowledgeBaseReady": true,
  "issueWorkflowReady": true,
  "rollbackRunbookReady": true,
  "supportEvidencePath": "qa-runs/YYYY-MM-DD-support-readiness-evidence.json"
}
```

For the current portable pilot RC, support readiness may be prepared locally, but final commercial readiness remains blocked until external field, signing, installer, update, and pilot evidence are complete.
