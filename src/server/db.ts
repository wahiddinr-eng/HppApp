import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForDb = globalThis as typeof globalThis & { hppPool?: Pool };

export function databaseConfigured() {
  try{
    const base=new URL(process.env.APP_BASE_URL||"");
    return Boolean(process.env.DATABASE_URL&&process.env.AUTH_SECRET&&process.env.AUTH_SECRET.length>=32&&!process.env.AUTH_SECRET.includes("CHANGE_ME")&&["http:","https:"].includes(base.protocol));
  }catch{return false;}
}

export function requireBackendConfig() {
  if (!databaseConfigured()) throw new Error("Backend belum dikonfigurasi: DATABASE_URL, AUTH_SECRET, dan APP_BASE_URL wajib diisi.");
}

export function getPool() {
  if (!globalForDb.hppPool) {
    globalForDb.hppPool = new Pool({
      connectionString: process.env.DATABASE_URL || "postgres://localhost/hpp_build_placeholder",
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    });
  }
  return globalForDb.hppPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
  requireBackendConfig();
  return getPool().query<T>(sql, values);
}

export async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  requireBackendConfig();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
