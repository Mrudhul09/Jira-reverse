// replica-build check: every screen at 1440px and 390px, console errors, sideways scroll on phones,
// and a screenshot per screen into replica/clone-screens/ for replica-diff.
//   node scripts/screens.cjs [baseUrl]
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.argv[2] || "http://localhost:3100";
const PASS = process.env.DEMO_PASSWORD || "demo-itsm-2026";
const OUT = path.join(__dirname, "..", "replica", "clone-screens");

const SCREENS = [
  ["S01", null, "/login"],
  ["S02", "employee", "/portal"],
  ["S03", "employee", "@first-request-type"],
  ["S04", "employee", "/portal/requests"],
  ["S05", "employee", "/portal/requests/SH-1"],
  ["S06", "employee", "@first-article"],
  ["S07", "agent", "/queues"],
  ["S08", "agent", "/items/SH-2"],
  ["S09", "agent", "/items/new?category=change"],
  ["S10", "agent", "/incidents"],
  ["S11", "agent", "/items/SH-5?show=all"],
  ["S12", "agent", "/pir/SH-7"],
  ["S13", "agent", "/problems"],
  ["S14", "agent", "/changes"],
  ["S15", "agent", "/changes/calendar"],
  ["S16", "agent", "/approvals"],
  ["S17", "agent", "/kb"],
  ["S18", "agent", "/services"],
  ["S19", "agent", "/assets"],
  ["S20", "agent", "/alerts"],
  ["S21", "agent", "/oncall"],
  ["S22", "agent", "/automation"],
  ["S23", "agent", "/reports"],
  ["S24", "agent", "/settings"],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const sessions = {};
  for (const [who, email] of [["employee", "theo@example.org"], ["agent", "admin@example.org"]]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(PASS);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/(portal|queues)/);
    sessions[who] = await ctx.storageState();
    await ctx.close();
  }
  let failures = 0;
  for (const [id, who, target] of SCREENS) {
    for (const [width, height, suffix] of [[1440, 900, ""], [390, 844, "-mobile"]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, storageState: who ? sessions[who] : undefined });
      const page = await ctx.newPage();
      const errors = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      let url = target;
      if (target === "@first-request-type" || target === "@first-article") {
        await page.goto(`${BASE}/portal`);
        const sel = target === "@first-request-type" ? 'a[href^="/portal/new/"]' : 'a[href^="/portal/kb/"]';
        url = await page.locator(sel).first().getAttribute("href");
      }
      const res = await page.goto(BASE + url);
      await page.waitForLoadState("networkidle");
      const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await page.screenshot({ path: path.join(OUT, `${id}${suffix}.png`), fullPage: true });
      const problems = [];
      if (!res || res.status() >= 400) problems.push(`HTTP ${res ? res.status() : "none"}`);
      if (errors.length) problems.push(`console: ${errors.join(" | ").slice(0, 300)}`);
      if (sideways > 2) problems.push(`scrolls sideways by ${sideways}px`);
      if (problems.length) failures++;
      console.log(`${problems.length ? "FAIL" : "ok  "} ${id}${suffix.padEnd(8)} ${url}${problems.length ? `  ${problems.join("; ")}` : ""}`);
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`\n${SCREENS.length * 2 - failures} of ${SCREENS.length * 2} screen checks passed`);
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
