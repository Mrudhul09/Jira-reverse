import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { seedIfEmpty } from "./seed";

// node:sqlite is loaded at runtime so the bundler never tries to resolve it.
type Sqlite = typeof import("node:sqlite");
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as Sqlite;
type Conn = InstanceType<Sqlite["DatabaseSync"]>;
export type Param = string | number | bigint | null;

const g = globalThis as unknown as { __itsmDb?: Conn; __itsmTxDepth?: number };

// Applies every file in migrations/ once, in name order.
export function migrate(conn: Conn): string[] {
  conn.exec("create table if not exists schema_migrations (name text primary key, applied_at integer not null)");
  const done = new Set((conn.prepare("select name from schema_migrations").all() as { name: string }[]).map((r) => r.name));
  const dir = path.join(process.cwd(), "migrations");
  const applied: string[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    conn.exec("begin");
    try {
      conn.exec(fs.readFileSync(path.join(dir, file), "utf8"));
      conn.prepare("insert into schema_migrations (name, applied_at) values (?, ?)").run(file, Date.now());
      conn.exec("commit");
      applied.push(file);
    } catch (err) {
      conn.exec("rollback");
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
  return applied;
}

export function db(): Conn {
  if (!g.__itsmDb) {
    const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "itsm.db");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const conn = new DatabaseSync(file);
    conn.exec("pragma journal_mode = wal; pragma foreign_keys = on; pragma busy_timeout = 5000;");
    migrate(conn);
    g.__itsmDb = conn;
    const empty = (conn.prepare("select count(*) as n from users").get() as { n: number }).n === 0;
    if (empty) {
      // A failed first start (say, a missing admin password) must not leave an unseeded connection cached.
      try {
        seedIfEmpty();
      } catch (err) {
        g.__itsmDb = undefined;
        conn.close();
        console.error(err);
        throw err;
      }
    }
  }
  return g.__itsmDb;
}

// Rows from node:sqlite have a null prototype; copy them so React can serialise them.
export function all<T>(sql: string, ...params: Param[]): T[] {
  return (db().prepare(sql).all(...params) as object[]).map((r) => ({ ...r }) as T);
}

export function get<T>(sql: string, ...params: Param[]): T | undefined {
  const row = db().prepare(sql).get(...params) as object | undefined;
  return row ? ({ ...row } as T) : undefined;
}

export function run(sql: string, ...params: Param[]): number {
  return Number(db().prepare(sql).run(...params).changes);
}

// Nested calls join the outer transaction.
export function tx<T>(fn: () => T): T {
  if (g.__itsmTxDepth) return fn();
  db().exec("begin immediate");
  g.__itsmTxDepth = 1;
  try {
    const out = fn();
    db().exec("commit");
    return out;
  } catch (err) {
    db().exec("rollback");
    throw err;
  } finally {
    g.__itsmTxDepth = 0;
  }
}

export const uid = (): string => randomUUID();
export const now = (): number => Date.now();

export function nextNumber(counter: string): number {
  return get<{ value: number }>(
    "insert into counters (name, value) values (?, 1) on conflict(name) do update set value = value + 1 returning value",
    counter,
  )!.value;
}

export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export const marks = (n: number): string => Array.from({ length: n }, () => "?").join(",");
