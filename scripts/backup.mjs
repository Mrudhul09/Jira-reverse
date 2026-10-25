// Consistent copy of the live database, safe while the app runs (VACUUM INTO).
// Keeps the newest 14 copies. Schedule it daily with Windows Task Scheduler:
//   node "C:\path\to\app\scripts\backup.mjs"
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(import.meta.dirname, "..");
const source = process.env.DATABASE_PATH || path.join(root, "data", "itsm.db");
const dir = process.env.BACKUP_DIR || path.join(root, "backups");
const keep = Number(process.env.BACKUP_KEEP || 14);
if (!fs.existsSync(source)) {
  console.error(`No database at ${source}`);
  process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(dir, `itsm-${stamp}.db`);
new DatabaseSync(source).exec(`vacuum into '${target.replace(/'/g, "''")}'`);
const copies = fs.readdirSync(dir).filter((f) => /^itsm-.*\.db$/.test(f)).sort();
for (const old of copies.slice(0, Math.max(0, copies.length - keep))) fs.rmSync(path.join(dir, old));
console.log(`backup written: ${target} (${Math.round(fs.statSync(target).size / 1024)} KB), keeping ${Math.min(keep, copies.length)}`);
