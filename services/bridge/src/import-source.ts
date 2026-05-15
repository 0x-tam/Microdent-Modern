/**
 * Read-only DBF reference readers for sqlite-mirror importers (and tests).
 * No HTTP server surface — safe mapping only.
 */
export { parseDataRootFromValue, type DataRootConfig, type DataRootSet } from "./config.js";
export { readReferenceDoctorsFromDbf } from "./dbf/reference-doctors.js";
export { readReferenceProcedures } from "./dbf/reference-procedures.js";
