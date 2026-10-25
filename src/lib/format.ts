export function ago(ms: number | null | undefined, at = Date.now()): string {
  if (!ms) return "";
  const diff = at - ms;
  const m = Math.round(Math.abs(diff) / 60_000);
  if (m < 1) return "just now";
  let t: string;
  if (m < 60) t = `${m} min`;
  else if (m < 1440) t = `${Math.round(m / 60)} h`;
  else if (m < 1440 * 30) t = `${Math.round(m / 1440)} d`;
  else return date(ms);
  return diff < 0 ? `in ${t}` : `${t} ago`;
}

export function date(ms: number | null | undefined): string {
  return ms ? new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export function dateTime(ms: number | null | undefined): string {
  return ms
    ? new Date(ms).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
}

// For <input type="datetime-local">, in the server's time zone.
export function localInput(ms: number | null | undefined): string {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
