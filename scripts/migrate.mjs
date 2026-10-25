// Applies every migrations/*.sql file once, in name order. The app also does this on start.
//   npm run migrate
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(import.meta.dirname, "..");
const file = process.env.DATABASE_PATH || path.join(root, "data", "itsm.db");
fs.mkdirSync(path.dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec("pragma foreign_keys = on; create table if not exists schema_migrations (name text primary key, applied_at integer not null)");
const done = new Set(db.prepare("select name from schema_migrations").all().map((r) => r.name));
const dir = path.join(root, "migrations");
let applied = 0;
for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(name)) continue;
  db.exec("begin");
  try {
    db.exec(fs.readFileSync(path.join(dir, name), "utf8"));
    db.prepare("insert into schema_migrations (name, applied_at) values (?, ?)").run(name, Date.now());
    db.exec("commit");
    console.log(`applied ${name}`);
    applied++;
  } catch (err) {
    db.exec("rollback");
    console.error(`failed ${name}: ${err.message}`);
    process.exit(1);
  }
}
console.log(applied ? `${applied} migration(s) applied to ${file}` : `up to date: ${file}`);
