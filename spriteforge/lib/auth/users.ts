import type { ResultSetHeader, RowDataPacket } from "mysql2";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db/pool";

/**
 * User persistence for the self-hosted auth backend (MySQL `users` table).
 * Server-only. Passwords are stored as bcrypt hashes — the plaintext never
 * touches the database.
 */
export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  trial_started_at: number | null;
}

interface UserRecord extends RowDataPacket, UserRow {}

const BCRYPT_ROUNDS = 10;

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const [rows] = await getPool().query<UserRecord[]>(
    "SELECT id, email, password_hash, trial_started_at FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  return rows[0] ?? null;
}

/**
 * Create a user with a bcrypt-hashed password. The `email` UNIQUE constraint is
 * the source of truth for duplicates — callers should catch `ER_DUP_ENTRY` to
 * handle the register race rather than relying solely on a prior existence check.
 */
export async function createUser(email: string, password: string): Promise<UserRow> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const [res] = await getPool().execute<ResultSetHeader>(
    "INSERT INTO users (email, password_hash) VALUES (?, ?)",
    [email, passwordHash],
  );
  return { id: res.insertId, email, password_hash: passwordHash, trial_started_at: null };
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
