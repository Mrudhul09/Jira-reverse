// Starts the background worker (SLA notices, escalation, email, cleanup) once per server process.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.JOBS !== "off") {
    const { startWorker } = await import("./lib/jobs");
    startWorker();
  }
}
