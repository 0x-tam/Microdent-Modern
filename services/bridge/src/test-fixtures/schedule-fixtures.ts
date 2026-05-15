import { join } from "node:path";
import { DBFFile } from "dbffile";

export const scheduleFields = [
  { name: "ID", type: "N" as const, size: 12, decimalPlaces: 0 },
  { name: "DATE", type: "D" as const, size: 8 },
  { name: "TIME", type: "C" as const, size: 8 },
  { name: "DURATION", type: "N" as const, size: 3, decimalPlaces: 0 },
  { name: "ROOM", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "COMMENT", type: "C" as const, size: 40 },
  { name: "PAT_NAME", type: "C" as const, size: 41 },
  { name: "TELEPHONE", type: "C" as const, size: 20 },
  { name: "PERIOD", type: "N" as const, size: 3, decimalPlaces: 0 },
  { name: "STATUS", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "DOC_ID", type: "N" as const, size: 5, decimalPlaces: 0 },
  { name: "PAT_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "PROC_CLASS", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "VAC_ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "RECALL", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "UNREASON", type: "N" as const, size: 2, decimalPlaces: 0 },
  { name: "MISSED", type: "L" as const, size: 1 },
];

const patientScheduleFields = [
  { name: "ID", type: "N" as const, size: 10, decimalPlaces: 0 },
  { name: "CASENB", type: "C" as const, size: 15 },
  { name: "NAME", type: "C" as const, size: 51 },
  { name: "REV_NAME", type: "C" as const, size: 51 },
  { name: "FIRST_NAME", type: "C" as const, size: 25 },
  { name: "LAST_NAME", type: "C" as const, size: 25 },
  { name: "HOME_PHONE", type: "C" as const, size: 19 },
  { name: "MOBILE", type: "C" as const, size: 19 },
];

async function writePatientDbfForSchedule(dir: string): Promise<void> {
  const patientPath = join(dir, "PATIENT.DBF");
  const dbf = await DBFFile.create(patientPath, patientScheduleFields, {});
  await dbf.appendRecords([
    {
      ID: 50001,
      CASENB: "SCH-ALPHA",
      NAME: "Synthetic Schedule Patient Alpha",
      REV_NAME: "",
      FIRST_NAME: "",
      LAST_NAME: "",
      HOME_PHONE: "(555) 200-3001",
      MOBILE: "",
    },
    {
      ID: 50002,
      CASENB: "",
      NAME: "",
      REV_NAME: "",
      FIRST_NAME: "Synthetic",
      LAST_NAME: "Schedule Beta",
      HOME_PHONE: "",
      MOBILE: "",
    },
  ]);
}

const scRoomFields = [
  { name: "ROOM", type: "N" as const, size: 3, decimalPlaces: 0 },
  { name: "DAY1", type: "L" as const, size: 1 },
  { name: "DAY2", type: "L" as const, size: 1 },
  { name: "DAY3", type: "L" as const, size: 1 },
  { name: "DAY4", type: "L" as const, size: 1 },
  { name: "DAY5", type: "L" as const, size: 1 },
  { name: "DAY6", type: "L" as const, size: 1 },
  { name: "DAY7", type: "L" as const, size: 1 },
  { name: "DOCT", type: "N" as const, size: 5, decimalPlaces: 0 },
];

function dicFields(): { name: string; type: "C"; size: number }[] {
  const out: { name: string; type: "C"; size: number }[] = [];
  for (let i = 1; i <= 25; i++) {
    out.push({ name: `ROOM${i}`, type: "C", size: 40 });
  }
  return out;
}

/** Synthetic schedule + patient DBFs for bridge schedule route tests. */
export async function writeScheduleFixtures(dir: string, opts?: { withPatientDbf?: boolean }): Promise<void> {
  const dicPath = join(dir, "DICSCHED.DBF");
  const dicRow: Record<string, string> = {};
  for (let i = 1; i <= 25; i++) {
    dicRow[`ROOM${i}`] = "";
  }
  dicRow.ROOM1 = "Synthetic operatory A";
  dicRow.ROOM2 = "Synthetic chair B";
  const dic = await DBFFile.create(dicPath, dicFields(), {});
  await dic.appendRecords([dicRow]);

  const roomPath = join(dir, "SC_ROOM.DBF");
  const rooms = await DBFFile.create(roomPath, scRoomFields, {});
  await rooms.appendRecords([
    {
      ROOM: 1,
      DAY1: true,
      DAY2: false,
      DAY3: false,
      DAY4: false,
      DAY5: false,
      DAY6: false,
      DAY7: false,
      DOCT: 42,
    },
    {
      ROOM: 2,
      DAY1: false,
      DAY2: true,
      DAY3: false,
      DAY4: false,
      DAY5: false,
      DAY6: false,
      DAY7: false,
      DOCT: 0,
    },
  ]);

  const schedPath = join(dir, "SCHEDULE.DBF");
  const sched = await DBFFile.create(schedPath, scheduleFields, {});
  const d1 = new Date(Date.UTC(2026, 4, 20));
  const d2 = new Date(Date.UTC(2026, 4, 21));
  const dOut = new Date(Date.UTC(2026, 4, 22));
  const secretComment = "SYNTHETIC_COMMENT_TOKEN_XX";
  const secretName = "SYNTHETIC_NAME_TOKEN_YY";
  const secretPhone = "SYNTHETIC_PHONE_TOKEN_ZZ";
  await sched.appendRecords([
    {
      ID: 1001,
      DATE: d1,
      TIME: "09:00",
      DURATION: 2,
      ROOM: 1,
      COMMENT: secretComment,
      PAT_NAME: secretName,
      TELEPHONE: secretPhone,
      PERIOD: 30,
      STATUS: 1,
      DOC_ID: 7,
      PAT_ID: 50001,
      PROC_CLASS: 3,
      VAC_ID: 0,
      RECALL: 0,
      UNREASON: 0,
      MISSED: false,
    },
    {
      ID: 1002,
      DATE: d1,
      TIME: "10:00",
      DURATION: 1,
      ROOM: 2,
      COMMENT: "",
      PAT_NAME: secretName,
      TELEPHONE: secretPhone,
      PERIOD: 0,
      STATUS: 2,
      DOC_ID: 0,
      PAT_ID: 50002,
      PROC_CLASS: 0,
      VAC_ID: 1,
      RECALL: 2,
      UNREASON: 3,
      MISSED: true,
    },
    {
      ID: 1003,
      DATE: d2,
      TIME: "11:30",
      DURATION: 1,
      ROOM: 1,
      COMMENT: "",
      PAT_NAME: secretName,
      TELEPHONE: secretPhone,
      PERIOD: 45,
      STATUS: 0,
      DOC_ID: 0,
      PAT_ID: 0,
      PROC_CLASS: 0,
      VAC_ID: 0,
      RECALL: 0,
      UNREASON: 0,
      MISSED: false,
    },
    {
      ID: 1004,
      DATE: dOut,
      TIME: "12:00",
      DURATION: 1,
      ROOM: 1,
      COMMENT: "",
      PAT_NAME: secretName,
      TELEPHONE: secretPhone,
      PERIOD: 30,
      STATUS: 1,
      DOC_ID: 0,
      PAT_ID: 0,
      PROC_CLASS: 0,
      VAC_ID: 0,
      RECALL: 0,
      UNREASON: 0,
      MISSED: false,
    },
    {
      ID: 1005,
      DATE: d1,
      TIME: "14:00",
      DURATION: 1,
      ROOM: 1,
      COMMENT: "",
      PAT_NAME: secretName,
      TELEPHONE: secretPhone,
      PERIOD: 30,
      STATUS: 1,
      DOC_ID: 0,
      PAT_ID: 88888,
      PROC_CLASS: 0,
      VAC_ID: 0,
      RECALL: 0,
      UNREASON: 0,
      MISSED: false,
    },
  ]);
  if (opts?.withPatientDbf !== false) {
    await writePatientDbfForSchedule(dir);
  }
}
