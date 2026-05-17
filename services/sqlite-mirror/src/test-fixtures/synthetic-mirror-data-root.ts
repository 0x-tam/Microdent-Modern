import { join } from "node:path";
import { DBFFile } from "dbffile";

/**
 * Writes minimal synthetic DBFs for a full `runMirrorImportSafe` integration run.
 * For tests only — never use real clinic data.
 */
export async function writeSyntheticMirrorDataRoot(dataRoot: string): Promise<void> {
  await writeDoctors(dataRoot);
  await writeProcedures(dataRoot);
  await writeScheduleRooms(dataRoot);
  await writePatients(dataRoot);
  await writeAppointments(dataRoot);
  await writeMedical(dataRoot);
  await writeTreatments(dataRoot);
}

async function writeDoctors(dir: string): Promise<void> {
  const fields = [
    { name: "DOCTOR_NB", type: "N" as const, size: 10, decimalPlaces: 0 },
    { name: "NAME", type: "C" as const, size: 30 },
    { name: "SCHEDULE", type: "N" as const, size: 1, decimalPlaces: 0 },
    { name: "PHONE", type: "C" as const, size: 19 },
  ];
  const dbf = await DBFFile.create(join(dir, "DOCTORS.DBF"), fields, {});
  await dbf.appendRecords([{ DOCTOR_NB: 3, NAME: "Synthetic Provider Three", SCHEDULE: 1, PHONE: "555-000-0003" }]);
}

async function writeProcedures(dir: string): Promise<void> {
  const fields = [
    { name: "PROCNB", type: "C" as const, size: 6 },
    { name: "PROCEDURE", type: "C" as const, size: 50 },
    { name: "CHART", type: "L" as const, size: 1 },
    { name: "QTYPRIC", type: "L" as const, size: 1 },
    { name: "PRICE1", type: "N" as const, size: 13, decimalPlaces: 4 },
    { name: "PRICE2", type: "N" as const, size: 13, decimalPlaces: 4 },
    { name: "PER_PROF", type: "N" as const, size: 6, decimalPlaces: 2 },
    { name: "CLASS", type: "C" as const, size: 30 },
    { name: "GROUP", type: "C" as const, size: 10 },
    { name: "CATAGORY", type: "C" as const, size: 10 },
    { name: "CLASS_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
    { name: "TRANS_CODE", type: "N" as const, size: 10, decimalPlaces: 0 },
  ];
  const dbf = await DBFFile.create(join(dir, "PROCCHRT.DBF"), fields, {});
  await dbf.appendRecords([
    {
      PROCNB: "SYN01",
      PROCEDURE: "Synthetic exam label",
      CHART: true,
      QTYPRIC: false,
      PRICE1: 0,
      PRICE2: 0,
      PER_PROF: 0,
      CLASS: "Preventive",
      GROUP: "SYN",
      CATAGORY: "PRE",
      CLASS_ID: 1,
      TRANS_CODE: 0,
    },
  ]);
}

async function writeScheduleRooms(dir: string): Promise<void> {
  const scFields = [
    { name: "ROOM", type: "N" as const, size: 2, decimalPlaces: 0 },
    { name: "DAY1", type: "L" as const, size: 1 },
    { name: "DAY2", type: "L" as const, size: 1 },
    { name: "DAY3", type: "L" as const, size: 1 },
    { name: "DAY4", type: "L" as const, size: 1 },
    { name: "DAY5", type: "L" as const, size: 1 },
    { name: "DAY6", type: "L" as const, size: 1 },
    { name: "DAY7", type: "L" as const, size: 1 },
    { name: "DOCT", type: "N" as const, size: 2, decimalPlaces: 0 },
  ];
  const sc = await DBFFile.create(join(dir, "SC_ROOM.DBF"), scFields, {});
  await sc.appendRecords([
    {
      ROOM: 1,
      DAY1: false,
      DAY2: true,
      DAY3: true,
      DAY4: true,
      DAY5: true,
      DAY6: true,
      DAY7: false,
      DOCT: 3,
    },
    { ROOM: 2, DAY1: true, DAY2: true, DAY3: true, DAY4: true, DAY5: true, DAY6: false, DAY7: false, DOCT: 0 },
  ]);

  const dicFields = [{ name: "ROOM1", type: "C" as const, size: 30 }];
  const dic = await DBFFile.create(join(dir, "DICSCHED.DBF"), dicFields, {});
  await dic.appendRecords([{ ROOM1: "Synthetic operatory one" }]);
}

async function writePatients(dir: string): Promise<void> {
  const fields = [
    { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
    { name: "CASENB", type: "C" as const, size: 15 },
    { name: "NAME", type: "C" as const, size: 51 },
    { name: "REV_NAME", type: "C" as const, size: 51 },
    { name: "FIRST_NAME", type: "C" as const, size: 25 },
    { name: "LAST_NAME", type: "C" as const, size: 25 },
    { name: "HOME_PHONE", type: "C" as const, size: 19 },
    { name: "MOBILE", type: "C" as const, size: 19 },
    { name: "ACTIVE", type: "L" as const, size: 1 },
    { name: "DOCTOR_NB", type: "N" as const, size: 10, decimalPlaces: 0 },
    { name: "ENTRY_DATE", type: "D" as const, size: 8 },
    { name: "LASTVISIT", type: "D" as const, size: 8 },
    { name: "STREET", type: "C" as const, size: 50 },
    { name: "EMAIL", type: "C" as const, size: 50 },
    { name: "QUICKNOTE", type: "C" as const, size: 80 },
  ];
  const dbf = await DBFFile.create(join(dir, "PATIENT.DBF"), fields, {});
  await dbf.appendRecords([
    {
      ID: 501,
      CASENB: "IMP-501",
      NAME: "Synthetic Import Alpha",
      REV_NAME: "Alpha, Synthetic I.",
      FIRST_NAME: "",
      LAST_NAME: "",
      HOME_PHONE: "(555) 000-0501",
      MOBILE: "",
      ACTIVE: true,
      DOCTOR_NB: 3,
      ENTRY_DATE: new Date(Date.UTC(2020, 2, 10)),
      LASTVISIT: new Date(Date.UTC(2025, 0, 5)),
      STREET: "Hidden street token",
      EMAIL: "hidden@invalid.test",
      QUICKNOTE: "Hidden note token",
    },
  ]);
}

async function writeAppointments(dir: string): Promise<void> {
  const fields = [
    { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
    { name: "DATE", type: "D" as const, size: 8 },
    { name: "TIME", type: "C" as const, size: 5 },
    { name: "DURATION", type: "N" as const, size: 2, decimalPlaces: 0 },
    { name: "ROOM", type: "N" as const, size: 2, decimalPlaces: 0 },
    { name: "COMMENT", type: "C" as const, size: 80 },
    { name: "PAT_NAME", type: "C" as const, size: 40 },
    { name: "TELEPHONE", type: "C" as const, size: 19 },
    { name: "CASENUM", type: "C" as const, size: 15 },
    { name: "PERIOD", type: "N" as const, size: 3, decimalPlaces: 0 },
    { name: "STATUS", type: "N" as const, size: 1, decimalPlaces: 0 },
    { name: "DOC_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
    { name: "PAT_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
    { name: "PROC_CLASS", type: "N" as const, size: 2, decimalPlaces: 0 },
    { name: "VAC_ID", type: "N" as const, size: 2, decimalPlaces: 0 },
    { name: "RECALL", type: "N" as const, size: 1, decimalPlaces: 0 },
    { name: "UNREASON", type: "N" as const, size: 1, decimalPlaces: 0 },
    { name: "MISSED", type: "L" as const, size: 1 },
  ];
  const dbf = await DBFFile.create(join(dir, "SCHEDULE.DBF"), fields, {});
  const d1 = new Date(Date.UTC(2026, 4, 20));
  await dbf.appendRecords([
    {
      ID: 9001,
      DATE: d1,
      TIME: "09:00",
      DURATION: 2,
      ROOM: 1,
      COMMENT: "Blocked comment token",
      PAT_NAME: "Blocked name token",
      TELEPHONE: "555-000-0000",
      CASENUM: "CASE-TOKEN",
      PERIOD: 30,
      STATUS: 1,
      DOC_ID: 3,
      PAT_ID: 501,
      PROC_CLASS: 0,
      VAC_ID: 0,
      RECALL: 0,
      UNREASON: 0,
      MISSED: false,
    },
  ]);
}

async function writeMedical(dir: string): Promise<void> {
  const fields = [
    { name: "PATIENT_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
    { name: "DATE", type: "D" as const, size: 8 },
    { name: "DIABETS", type: "L" as const, size: 1 },
    { name: "ALLERGIC", type: "L" as const, size: 1 },
    { name: "PROBLEM", type: "C" as const, size: 80 },
    { name: "ALLERGY_TO", type: "C" as const, size: 80 },
  ];
  const dbf = await DBFFile.create(join(dir, "MEDICAL.DBF"), fields, {});
  await dbf.appendRecords([
    {
      PATIENT_ID: 501,
      DATE: new Date(Date.UTC(2024, 0, 1)),
      DIABETS: true,
      ALLERGIC: false,
      PROBLEM: "Blocked problem token",
      ALLERGY_TO: "Blocked allergy token",
    },
  ]);
}

async function writeTreatments(dir: string): Promise<void> {
  const operFields = [
    { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
    { name: "OPNUM", type: "N" as const, size: 10, decimalPlaces: 0 },
    { name: "TOOTHNB", type: "N" as const, size: 2, decimalPlaces: 0 },
    { name: "PROCEDURE", type: "C" as const, size: 50 },
    { name: "DATE", type: "D" as const, size: 8 },
    { name: "STATUS", type: "N" as const, size: 1, decimalPlaces: 0 },
    { name: "PROCNB", type: "C" as const, size: 12 },
    { name: "DOCT", type: "N" as const, size: 2, decimalPlaces: 0 },
    { name: "DESC", type: "C" as const, size: 30 },
    { name: "FEE", type: "N" as const, size: 13, decimalPlaces: 4 },
  ];
  const oper = await DBFFile.create(join(dir, "OPERTBL.DBF"), operFields, {});
  await oper.appendRecords([
    {
      ID: 501,
      OPNUM: 100,
      TOOTHNB: 14,
      PROCEDURE: "Blocked procedure text",
      DATE: new Date(Date.UTC(2024, 5, 1)),
      STATUS: 2,
      PROCNB: "SYN01",
      DOCT: 3,
      DESC: "Blocked desc token",
      FEE: 9999.99,
    },
  ]);
}
