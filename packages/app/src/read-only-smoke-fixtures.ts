import { expect } from "vitest";

/** Synthetic bridge base URL for smoke tests only. */
export const SMOKE_BRIDGE_BASE = "http://127.0.0.1:17890";

export const SMOKE_PATIENT_ID = "42";

/** Values embedded in mock JSON that must never appear in rendered DOM text. */
export const SMOKE_LEAKED_VALUES = {
  telephone: "555-0199-SYNTHETIC-FULL-PHONE",
  comment: "SYNTHETIC_LEAKED_COMMENT_BODY",
  noteBody: "SYNTHETIC_LEAKED_NOTE_BODY_TEXT",
  descript: "SYNTHETIC_LEAKED_DESCRIPT_FIELD",
  desc: "SYNTHETIC_LEAKED_DESC_FIELD",
  amount: "98765.43",
  samount: "11111.22",
  rawRow: "SYNTHETIC_RAW_ROW_JSON_BLOB",
} as const;

export const smokeProfile = {
  patientId: SMOKE_PATIENT_ID,
  chartNumber: "SYN-SMOKE",
  displayName: "Synthetic Smoke Patient",
  phoneMask: "…4242",
  reverseName: "Patient, Synthetic Smoke",
  active: true,
  doctorId: "7",
  entryDate: "2020-03-01",
  lastVisit: "2024-01-15",
};

export const smokeSearchHit = {
  patientId: SMOKE_PATIENT_ID,
  chartNumber: "SYN-SMOKE",
  displayName: "Synthetic Smoke Patient",
  phoneMask: "…4242",
};

const syntheticDoctors = {
  doctors: [
    { doctorId: "5", displayName: "Synthetic Provider Smoke", active: true },
    { doctorId: "7", displayName: "Synthetic Provider Profile", active: true },
    { doctorId: "3", displayName: "Synthetic Provider Sched", active: true },
  ],
};

const syntheticProcedures = {
  procedures: [
    {
      procedureCode: "000001",
      displayName: "Synthetic smoke procedure label",
      category: null,
      categoryCode: null,
      classId: 1,
      chartRelevant: true,
    },
  ],
};

const activeDays = {
  sunday: true,
  monday: false,
  tuesday: false,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday: false,
};

const smokeRooms = {
  rooms: [{ room: 1, displayName: "Synthetic smoke bay", activeDays, doctorId: 3 }],
};

const nullConditions = {
  hospital: null,
  physician: null,
  medicine: null,
  ill: null,
  reaction: null,
  bleeding: null,
  allergic: null,
  heartTrouble: null,
  congenitalHeart: null,
  heartMurmur: null,
  highBloodPressure: null,
  lowBloodPressure: null,
  anemia: null,
  rheumaticFever: null,
  jaundice: null,
  asthma: null,
  cough: null,
  kidneyTrouble: null,
  med1: null,
  diabetes: null,
  tuberculosis: null,
  hepatitis: null,
  arthritis: null,
  stroke: null,
  epilepsy: null,
  psychiatric: null,
  sinusTrouble: null,
  pregnant: null,
  ulcers: null,
  aids: null,
  med2: null,
};

const MEDICAL_PRIVACY_NOTE =
  "Problem description, allergy free text, and medical notes remain hidden until field mapping is reviewed.";

const TREATMENTS_PRIVACY_NOTE =
  "Procedure memos, per-line descriptions, fee columns, and raw OPERTBL rows are never exposed by this route.";

const CHART_PRIVACY_NOTE =
  "Chart memos, layer code legends, clinical labels, and raw CHARTDBF rows are never exposed by this route.";

const LEDGER_PRIVACY_NOTE =
  "Ledger amounts, memo text, insurance identifiers, plan numbers, and raw TRANS rows are never exposed by this route.";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Extra legacy keys on appointment wire objects (stripped by Zod; must not appear in DOM). */
function withLeakyAppointmentFields<T extends Record<string, unknown>>(dto: T): T & Record<string, unknown> {
  return {
    ...dto,
    PAT_NAME: "LEAKED SCHEDULE PAT_NAME",
    TELEPHONE: SMOKE_LEAKED_VALUES.telephone,
    COMMENT: SMOKE_LEAKED_VALUES.comment,
    "NOTE body": SMOKE_LEAKED_VALUES.noteBody,
    DESCRIPT: SMOKE_LEAKED_VALUES.descript,
    DESC: SMOKE_LEAKED_VALUES.desc,
    AMOUNT: SMOKE_LEAKED_VALUES.amount,
    SAMOUNT: SMOKE_LEAKED_VALUES.samount,
    rawRow: SMOKE_LEAKED_VALUES.rawRow,
  };
}

function smokeAppointment(date: string) {
  return withLeakyAppointmentFields({
    id: "9001",
    date,
    time: "09:30",
    durationSlots: 2,
    periodMinutes: 30,
    room: 3,
    status: 1,
    docId: 5,
    patId: SMOKE_PATIENT_ID,
    patient: {
      patientId: SMOKE_PATIENT_ID,
      displayName: "LEAKED SCHEDULE PAT_NAME",
      chartNumber: "SHOULD-NOT-SHOW",
    },
    procClass: 2,
    vacId: 0,
    recall: 0,
    unreason: 0,
    missed: true,
    hasComment: true,
  });
}

/**
 * Central mock `fetch` for read-only AppShell smoke tests. Responses are synthetic only.
 */
export function createReadOnlySmokeFetch(): (input: RequestInfo | URL) => Promise<Response> {
  return (input) => {
    const u = String(input);

    if (u.includes("/health")) {
      return Promise.resolve(jsonResponse({ ok: true, version: "smoke-test" }));
    }

    if (u.includes("/v1/reference/doctors")) {
      return Promise.resolve(jsonResponse(syntheticDoctors));
    }

    if (u.includes("/v1/reference/procedures")) {
      return Promise.resolve(jsonResponse(syntheticProcedures));
    }

    if (u.includes("/v1/patients/search")) {
      return Promise.resolve(jsonResponse({ results: [smokeSearchHit] }));
    }

    if (u.includes(`/v1/patients/${SMOKE_PATIENT_ID}/profile`)) {
      return Promise.resolve(jsonResponse(smokeProfile));
    }

    if (u.includes(`/v1/patients/${SMOKE_PATIENT_ID}/appointments`)) {
      const m = u.match(/from=([^&]+)/);
      const fromQ = m ? decodeURIComponent(m[1]) : "2026-05-15";
      return Promise.resolve(jsonResponse({ appointments: [smokeAppointment(fromQ)] }));
    }

    if (u.includes(`/v1/patients/${SMOKE_PATIENT_ID}/medical-summary`)) {
      return Promise.resolve(
        jsonResponse({
          patientId: SMOKE_PATIENT_ID,
          hasMedicalRecord: true,
          hasSensitiveMedicalDetails: false,
          lastUpdated: "2024-06-01",
          lastDentalVisit: "2024-01-10",
          flaggedConditionCount: 1,
          conditions: { ...nullConditions, asthma: true },
          privacyNote: MEDICAL_PRIVACY_NOTE,
        }),
      );
    }

    if (u.includes(`/v1/patients/${SMOKE_PATIENT_ID}/treatments`)) {
      return Promise.resolve(
        jsonResponse({
          patientId: SMOKE_PATIENT_ID,
          treatments: [
            {
              treatmentId: "100",
              patientId: SMOKE_PATIENT_ID,
              date: "2024-06-01",
              tooth: 14,
              procedureCode: "SYN01",
              procedureLabel: "Synthetic dictionary label",
              doctorId: "3",
              doctorLabel: "Synthetic Provider Three",
              status: 2,
              hasDescription: true,
            },
          ],
          truncated: false,
          privacyNote: TREATMENTS_PRIVACY_NOTE,
        }),
      );
    }

    if (u.includes(`/v1/patients/${SMOKE_PATIENT_ID}/chart`)) {
      return Promise.resolve(
        jsonResponse({
          patientId: SMOKE_PATIENT_ID,
          entries: [
            {
              chartEntryId: "14-1-1",
              patientId: SMOKE_PATIENT_ID,
              toothNumber: 14,
              chartType: 1,
              treated: true,
              hasNote: true,
            },
          ],
          truncated: false,
          privacyNote: CHART_PRIVACY_NOTE,
        }),
      );
    }

    if (u.includes(`/v1/patients/${SMOKE_PATIENT_ID}/ledger`)) {
      return Promise.resolve(
        jsonResponse({
          patientId: SMOKE_PATIENT_ID,
          entries: [
            {
              ledgerEntryId: "200",
              patientId: SMOKE_PATIENT_ID,
              date: "2024-06-01",
              chargeTypeCode: 2,
              adjustmentTypeCode: 0,
              paymentTypeCode: 100,
              isCardPayment: true,
              hasDescription: true,
            },
          ],
          truncated: false,
          privacyNote: LEDGER_PRIVACY_NOTE,
        }),
      );
    }

    if (u.includes("/v1/schedule/rooms")) {
      return Promise.resolve(jsonResponse(smokeRooms));
    }

    if (u.includes("/v1/meta/tables")) {
      return Promise.resolve(jsonResponse({ tables: [{ id: "fixture_tiny", displayName: "Synthetic fixture", fileName: "fixture.dbf" }] }));
    }

    if (u.includes("/v1/legacy/catalog")) {
      return Promise.resolve(jsonResponse({ tables: [] }));
    }

    if (u.includes("/v1/tables/fixture_tiny/")) {
      return Promise.resolve(
        jsonResponse(
          u.includes("/rows")
            ? { totalRecords: 0, rows: [] }
            : { tableId: "fixture_tiny", fields: [{ name: "id", type: "C" }] },
        ),
      );
    }

    if (u.includes("/v1/mirror/status")) {
      return Promise.resolve(
        jsonResponse({
          sqliteConfigured: true,
          sqliteUsable: false,
          importedTables: [],
          latestImportRuns: [],
        }),
      );
    }

    if (u.includes("/v1/schedule/appointments")) {
      const m = u.match(/from=([^&]+)/);
      const fromQ = m ? decodeURIComponent(m[1]) : "2026-05-15";
      return Promise.resolve(
        jsonResponse({
          appointments: [
            withLeakyAppointmentFields({
              id: "501",
              date: fromQ,
              time: "09:00",
              durationSlots: 2,
              periodMinutes: 30,
              room: 1,
              status: 2,
              docId: 3,
              patId: "9001",
              patient: {
                patientId: "9001",
                displayName: "Synthetic Schedule Smoke Patient",
                chartNumber: "SCH-SMK",
              },
              procClass: 1,
              vacId: 0,
              recall: 0,
              unreason: 0,
              missed: false,
              hasComment: true,
            }),
          ],
        }),
      );
    }

    return Promise.reject(new Error(`unexpected smoke fetch: ${u}`));
  };
}

/** Legacy DBF field labels that must not appear as visible DOM tokens (excludes UI words like "before"). */
const DOM_FORBIDDEN_FIELD_LABELS = [
  "PAT_NAME",
  "TELEPHONE",
  "COMMENT",
  "NOTE",
  "DESCRIPT",
  "DESC",
  "AMOUNT",
  "SAMOUNT",
] as const;

/** Asserts read-only UI never surfaces legacy field labels or leaked mock values. */
export function assertNoForbiddenDomTokens(text: string): void {
  for (const label of DOM_FORBIDDEN_FIELD_LABELS) {
    expect(text).not.toMatch(new RegExp(`\\b${label}\\b`));
  }
  expect(text).not.toMatch(/\bNOTE body\b/i);
  expect(text).not.toMatch(/\braw row\b/i);
  expect(text).not.toContain("rawRow");

  expect(text).not.toContain(SMOKE_LEAKED_VALUES.telephone);
  expect(text).not.toContain(SMOKE_LEAKED_VALUES.comment);
  expect(text).not.toContain(SMOKE_LEAKED_VALUES.noteBody);
  expect(text).not.toContain(SMOKE_LEAKED_VALUES.descript);
  expect(text).not.toContain(SMOKE_LEAKED_VALUES.desc);
  expect(text).not.toContain(SMOKE_LEAKED_VALUES.amount);
  expect(text).not.toContain(SMOKE_LEAKED_VALUES.samount);
  expect(text).not.toContain(SMOKE_LEAKED_VALUES.rawRow);
  expect(text).not.toContain("LEAKED SCHEDULE PAT_NAME");
  expect(text).not.toContain("SHOULD-NOT-SHOW");
}
