# Synthetic DBF sandbox (tests only)

This directory holds **non-PHI, fake** data for automated tests and local development.

- **`FAKE_TINY.dbf`** — tiny table with generic columns (`ALIAS`, `SCORE`). Generated with the [`dbffile`](https://www.npmjs.com/package/dbffile) library (see repo docs). It is **not** a Microdent production table.

To use the bridge table APIs, set **`DATA_ROOT`** to the **absolute** path of this directory (not the legacy `DATA` tree).
