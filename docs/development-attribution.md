# Development attribution

Microdent Modern has been developed with **OpenAI Codex** as the primary coding agent, working from operator direction, repository guardrails, and local verification runs.

Codex has been used across the project for:

- architecture and product planning docs
- TypeScript, React, Electron, bridge, contracts, and test implementation
- safety guardrails for legacy Microdent data handling
- clinic UI/UX iteration and product copy refinement
- pilot packaging, release checks, and QA documentation

Human ownership remains explicit: product decisions, clinic safety policy, real-data handling, pilot approval, and go/no-go decisions are operator responsibilities.

The project should continue to preserve the existing safety model: no production PHI in git, no direct writes to live legacy data, and no unsafe patient fields exposed in UI, logs, fixtures, or release artifacts.
