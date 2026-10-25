// replica-backend checks against a dev server with demo data:
// sign-in lockout, password reset by email, second-user access, security headers.
//   node scripts/backend-check.cjs [baseUrl]
const { chromium } = require("@playwright/test");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const BASE = process.argv[2] || "http://localhost:3100";
const PASS = "demo-itsm-2026";
const db = new DatabaseSync(process.env.DATABASE_PATH || path.join(__dirname, "..", "data", "itsm.db"));
let failed = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${!cond && extra ? `  (${extra})` : ""}`);
};

(async () => {
  const browser = await chromium.launch();
  const fresh = async () => (await browser.newContext()).newPage();
  const signIn = async (page, email, password) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForLoadState("networkidle");
  };

  // Lockout after 10 failures for one email.
  const p = await fresh();
  for (let i = 0; i < 10; i++) await signIn(p, "ines@example.org", "wrong-password-123");
  await signIn(p, "ines@example.org", PASS);
  ok("11th try is blocked even with the right password", (await p.content()).includes("Too many tries"));

  // Password reset by email (held in the outbox because no mail key is set).
  const r = await fresh();
  await r.goto(`${BASE}/login/forgot`);
  await r.getByLabel("Work email").fill("maya@example.org");
  await r.getByRole("button", { name: "Send the link" }).click();
  await r.waitForLoadState("networkidle");
  ok("reset answer doesn't reveal whether the account exists", (await r.content()).includes("If that email belongs to an account"));
  const mail = db.prepare("select body, status from outbox where to_email = 'maya@example.org' and subject like 'Reset%' order by created_at desc").get();
  ok("reset email queued (held until email is set up)", mail && mail.status === "held");
  const link = mail.body.match(/http\S+\/login\/reset\?token=\S+/)[0].replace(/^https?:\/\/[^/]+/, BASE);
  ok("database keeps only a hash of the reset token", !db.prepare("select 1 from password_resets where token_hash = ?").get(link.split("token=")[1]));
  await r.goto(link);
  await r.getByLabel("New password").fill("a-brand-new-password-1");
  await r.getByLabel("Type it again").fill("a-brand-new-password-1");
  await r.getByRole("button", { name: "Save new password" }).click();
  await r.waitForURL(/\/login\?ok=/);
  await signIn(r, "maya@example.org", "a-brand-new-password-1");
  ok("new password works", r.url().includes("/portal"));
  const r2 = await fresh();
  await signIn(r2, "maya@example.org", PASS);
  ok("old password no longer works", r2.url().includes("/login"));
  await r2.goto(link);
  ok("the reset link works only once", (await r2.content()).includes("expired or was already used"));

  // Second user gets nothing back.
  const theo = await fresh();
  await signIn(theo, "theo@example.org", PASS);
  await theo.goto(`${BASE}/items/SH-2`);
  ok("employee is sent away from the agent view", theo.url().endsWith("/portal"));
  const other = await theo.goto(`${BASE}/portal/requests/SH-2`);
  ok("employee can't open someone else's request", other.status() === 404);
  const search = await (await theo.request.get(`${BASE}/api/kb/search?q=runbook`)).json();
  ok("IT-only articles stay out of employee search", !search.results.some((a) => a.title.startsWith("Runbook")));
  // Tamper: point Theo's own "cancel" form at Maya's request.
  const mayaItem = db.prepare("select id, status from items where key = 'SH-2'").get();
  await theo.goto(`${BASE}/portal/requests/SH-1`);
  await theo.evaluate((id) => {
    const form = [...document.querySelectorAll("form")].find((f) => f.querySelector('input[name="to"][value="Canceled"]'));
    form.querySelector('input[name="itemId"]').value = id;
  }, mayaItem.id);
  await theo.getByRole("button", { name: "I don't need this any more" }).click();
  await theo.waitForLoadState("networkidle");
  ok("tampered form can't change someone else's request", db.prepare("select status from items where id = ?").get(mayaItem.id).status === mayaItem.status);

  // Headers.
  const res = await theo.request.get(`${BASE}/portal`);
  ok("security headers are sent", res.headers()["x-frame-options"] === "DENY" && res.headers()["x-content-type-options"] === "nosniff");
  ok("no x-powered-by header", !res.headers()["x-powered-by"]);

  // Alert API needs the token.
  const bad = await theo.request.post(`${BASE}/api/alerts`, { data: { message: "x" }, headers: { "x-alert-token": "wrong" } });
  ok("alert API refuses a wrong token", bad.status() === 401);

  await browser.close();
  console.log(failed ? `\n${failed} failed` : "\nall backend checks passed");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
