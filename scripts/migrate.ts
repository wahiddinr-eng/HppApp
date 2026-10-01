import { readFile } from "node:fs/promises";
import { getMigrations } from "better-auth/db/migration";
import { auth } from "../src/server/auth";
import { getPool, requireBackendConfig } from "../src/server/db";

requireBackendConfig();
const { runMigrations } = await getMigrations(auth.options);
await runMigrations();
await getPool().query(await readFile(new URL("../db/domain.sql", import.meta.url), "utf8"));
console.log("Migrasi autentikasi dan domain HPP selesai.");
await getPool().end();
