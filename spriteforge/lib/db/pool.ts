import mysql from "mysql2/promise";

/**
 * Shared MySQL connection pool for the self-hosted auth backend.
 *
 * Server-only: this module reads DB credentials from non-`NEXT_PUBLIC_` env
 * vars and must never be imported from a client component or from middleware
 * (the Edge runtime can't load mysql2). Route handlers run on the Node runtime,
 * which is where every caller lives.
 *
 * A single lazily-created pool is reused across requests (Next keeps the module
 * alive between invocations), so we don't open a new TCP connection per call.
 */
let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      maxIdle: 5,
      idleTimeout: 60_000,
      enableKeepAlive: true,
      charset: "utf8mb4",
    });
  }
  return pool;
}
