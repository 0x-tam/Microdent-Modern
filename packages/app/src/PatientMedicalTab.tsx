import type { PatientMedicalSummaryResponse } from "@microdent/contracts";
import { Badge } from "@microdent/ui";
import { ClinicEmptyState } from "./clinic-empty-state.js";
import { ClinicLoadingSkeleton } from "./clinic-loading-skeleton.js";
import {
  CLINIC_SERVICE_OFFLINE_TITLE,
  PATIENT_TAB_LOADING_MEDICAL,
  PATIENT_TAB_OFFLINE_MEDICAL,
  PATIENT_TAB_EMPTY_MEDICAL_TITLE,
  PATIENT_TAB_EMPTY_MEDICAL,
  PATIENT_TAB_MEDICAL_LEDE,
  PATIENT_TAB_HIDDEN_MEDICAL,
  PATIENT_TAB_SECTION_QUESTIONNAIRE,
  PATIENT_TAB_SECTION_GENERAL_SCREENING,
  PATIENT_TAB_SECTION_ADDITIONAL_MARKERS,
  PATIENT_TAB_QUESTIONNAIRE_DENTAL_VISIT,
  PATIENT_TAB_QUESTIONNAIRE_LAST_UPDATED,
  MEDICAL_SENSITIVE_STILL_HIDDEN,
  MEDICAL_SENSITIVE_STILL_SHOWN,
  SENSITIVE_MEDICAL_BANNER,
  READONLY_STATE_RETRY,
  medicalFlaggedCountPartialNote,
} from "./read-only-ui-copy.js";
import {
  formatMedicalQuestionnaireDate,
  medicalConditionSectionsForDisplay,
  medicalFlaggedCountNeedsPartialNote,
} from "./patient-medical-summary-display.js";

/* ── Types ─────────────────────────────────────────────────────────────── */

export type MedLoadState =
  | { phase: "idle" }
  | { phase: "offline" }
  | { phase: "loading" }
  | { phase: "no_record" }
  | { phase: "loaded"; summary: PatientMedicalSummaryResponse }
  | { phase: "error"; message: string };

export type PatientMedicalTabProps = {
  medState: MedLoadState;
  onRefresh: () => void;
  isOffline: boolean;
  BodyComponent?: React.ComponentType<{ summary: PatientMedicalSummaryResponse }>;
};

/* ── Shared helpers ────────────────────────────────────────────────────── */

function TabHiddenNote() {
  return (
    <p
      className="app-info-callout app-patient-profile__tab-hidden-note"
      role="note"
    >
      {PATIENT_TAB_HIDDEN_MEDICAL}
    </p>
  );
}

function ReadonlyError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="app-readonly-state app-readonly-state--error app-patient-profile__error" role="alert">
      <p>{message}</p>
      <button type="button" className="ui-focusable" onClick={onRetry}>
        {READONLY_STATE_RETRY}
      </button>
    </div>
  );
}

/* ── Body ──────────────────────────────────────────────────────────────── */

function MedicalSummaryBody({ summary }: { summary: PatientMedicalSummaryResponse }) {
  const sensitive = summary.hasSensitiveMedicalDetails;
  const conditionSections = sensitive
    ? { general: [], additional: [] }
    : medicalConditionSectionsForDisplay(summary.conditions);
  const visibleNamedCount = conditionSections.general.length + conditionSections.additional.length;
  const lastUpdatedLabel = formatMedicalQuestionnaireDate(summary.lastUpdated) ?? "—";
  const lastDentalLabel = formatMedicalQuestionnaireDate(summary.lastDentalVisit) ?? "—";
  const partialFlagNote = medicalFlaggedCountNeedsPartialNote(
    summary.flaggedConditionCount,
    visibleNamedCount,
  );

  return (
    <div className="app-patient-profile__medical-body">
      {sensitive ? (
        <>
          <p className="app-patient-profile__medical-banner app-clinical-sensitive-banner" role="note">
            {SENSITIVE_MEDICAL_BANNER}
          </p>
          <div className="app-patient-profile__medical-sensitive-detail app-clinical-sensitive-detail" role="note">
            <p className="app-patient-profile__medical-sensitive-heading">
              Hidden in this preview
              <Badge
                variant="neutral"
                semanticLabel="Sensitive medical details hidden"
                className="app-clinical-badge app-clinical-badge--hidden-sensitive"
              >
                Sensitive hidden
              </Badge>
            </p>
            <ul className="app-patient-profile__medical-sensitive-list">
              {MEDICAL_SENSITIVE_STILL_HIDDEN.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="app-patient-profile__medical-sensitive-heading">Still shown</p>
            <ul className="app-patient-profile__medical-sensitive-list">
              {MEDICAL_SENSITIVE_STILL_SHOWN.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {/* Questionnaire status card */}
      <section className="app-clinical-group-card app-clinical-group-card--medical">
        <h4 className="app-patient-profile__tab-section-title app-clinical-section-header app-clinical-section-header--medical">
          {PATIENT_TAB_SECTION_QUESTIONNAIRE}
        </h4>
        <dl className="app-patient-profile__dl app-patient-profile__medical-questionnaire">
          <div className="app-patient-profile__row app-patient-profile__medical-questionnaire-primary">
            <dt>{PATIENT_TAB_QUESTIONNAIRE_LAST_UPDATED}</dt>
            <dd>
              <strong>{lastUpdatedLabel}</strong>
            </dd>
          </div>
          <div className="app-patient-profile__row">
            <dt>{PATIENT_TAB_QUESTIONNAIRE_DENTAL_VISIT}</dt>
            <dd>{lastDentalLabel}</dd>
          </div>
          <div className="app-patient-profile__row">
            <dt>Flagged screening items</dt>
            <dd>
              {summary.flaggedConditionCount}
              {partialFlagNote ? (
                <span className="app-patient-profile__medical-flag-note">
                  {" "}
                  — {medicalFlaggedCountPartialNote(summary.flaggedConditionCount)}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>

      {/* General screening status card */}
      {!sensitive && conditionSections.general.length > 0 ? (
        <section className="app-clinical-group-card app-clinical-group-card--medical">
          <h4 className="app-patient-profile__tab-section-title app-clinical-section-header app-clinical-section-header--medical">
            {PATIENT_TAB_SECTION_GENERAL_SCREENING}
          </h4>
          <ul className="app-patient-profile__medical-flags" aria-label={PATIENT_TAB_SECTION_GENERAL_SCREENING}>
            {conditionSections.general.map((item) => (
              <li key={item.key}>{item.label}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Additional markers status card */}
      {!sensitive && conditionSections.additional.length > 0 ? (
        <section className="app-clinical-group-card app-clinical-group-card--medical">
          <h4 className="app-patient-profile__tab-section-title app-clinical-section-header app-clinical-section-header--medical">
            {PATIENT_TAB_SECTION_ADDITIONAL_MARKERS}
          </h4>
          <ul className="app-patient-profile__medical-flags" aria-label={PATIENT_TAB_SECTION_ADDITIONAL_MARKERS}>
            {conditionSections.additional.map((item) => (
              <li key={item.key}>{item.label}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {!sensitive && visibleNamedCount === 0 && summary.flaggedConditionCount === 0 ? (
        <p className="app-patient-profile__medical-muted">No screening flags marked yes.</p>
      ) : null}

      {sensitive && summary.flaggedConditionCount > 0 ? (
        <p className="app-patient-profile__medical-muted" role="note">
          {medicalFlaggedCountPartialNote(summary.flaggedConditionCount)}
        </p>
      ) : null}

      <p className="app-patient-profile__medical-privacy">{summary.privacyNote}</p>
    </div>
  );
}

/* ── Tab root ──────────────────────────────────────────────────────────── */

export function PatientMedicalTab({
  medState,
  onRefresh,
  isOffline,
  BodyComponent,
}: PatientMedicalTabProps) {
  const effectiveOffline = isOffline || medState.phase === "offline";

  return (
    <section
      id="patient-panel-medical"
      role="tabpanel"
      aria-labelledby="patient-tab-medical"
      className="app-patient-profile__medical app-clinical-tab app-clinical-tab--medical"
    >
      <p className="app-patient-profile__medical-lede">{PATIENT_TAB_MEDICAL_LEDE}</p>
      <TabHiddenNote />

      {effectiveOffline ? (
        <ClinicEmptyState
          variant="offline"
          className="app-patient-profile__empty"
          title={CLINIC_SERVICE_OFFLINE_TITLE}
          body={PATIENT_TAB_OFFLINE_MEDICAL}
        />
      ) : medState.phase === "loading" ? (
        <ClinicLoadingSkeleton lines={4} label={PATIENT_TAB_LOADING_MEDICAL} />
      ) : medState.phase === "error" ? (
        <ReadonlyError message={medState.message} onRetry={onRefresh} />
      ) : medState.phase === "no_record" ? (
        <ClinicEmptyState
          className="app-patient-profile__empty"
          title={PATIENT_TAB_EMPTY_MEDICAL_TITLE}
          body={PATIENT_TAB_EMPTY_MEDICAL}
        />
      ) : medState.phase === "loaded" ? (
        BodyComponent ? (
          <BodyComponent summary={medState.summary} />
        ) : (
          <MedicalSummaryBody summary={medState.summary} />
        )
      ) : null}
    </section>
  );
}
