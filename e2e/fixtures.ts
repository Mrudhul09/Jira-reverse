import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type BrowserContextOptions, type Locator, type Page } from "@playwright/test";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export { expect };
export const PASS = "demo-itsm-2026";
export const AGENT = "omar@example.org";
export const ADMIN = "admin@example.org";
export const EMPLOYEE = "theo@example.org";
export const APPROVER = "ravi@example.org";

// Read-only look at the test database, to check what the screens can't show.
let conn: DatabaseSync | undefined;
export function db(): DatabaseSync {
  conn ??= new DatabaseSync(path.join(process.cwd(), "data", "test", "itsm.db"));
  return conn;
}
export const one = <T>(sql: string, ...p: (string | number | null)[]) => db().prepare(sql).get(...p) as T;

// A labelled control; required fields carry a " *" after the label text.
export const field = (scope: Page | Locator, label: string) =>
  scope.getByLabel(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s*\\*)?$`));

export const stamp = () => Date.now().toString(36).slice(-5);

// Waits until the browser has really left the sign-in page, or for the refusal message.
export async function signIn(page: Page, email: string, password = PASS) {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // One wait for either outcome: a leftover waiter would hold up every later action on this page.
  await page.waitForFunction(() => !location.pathname.startsWith("/login") || !!document.querySelector('main [role="alert"]'), null, { timeout: 20_000 });
}

// WCAG 2.1 A and AA. The dev-only Next.js overlay isn't part of the app.
export async function a11y(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("nextjs-portal").analyze();
  const found = r.violations.map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(found, `accessibility problems on ${page.url()}`).toEqual([]);
}

type As = (email: string | null, opts?: BrowserContextOptions) => Promise<Page>;

// One signed-in page per person. Any console error, page error or 5xx fails the test.
export const test = base.extend<{ as: As }>({
  as: async ({ browser }, use) => {
    const problems: string[] = [];
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await use(async (email, opts) => {
      const ctx = await browser.newContext({ baseURL: "http://localhost:3200", viewport: { width: 1440, height: 900 }, ...opts });
      contexts.push(ctx);
      const page = await ctx.newPage();
      page.on("console", (m) => {
        // 404s and 401s that a test asks for on purpose are asserted by that test.
        if (m.type() === "error" && !/status of (404|401)/.test(m.text())) problems.push(`console: ${m.text()}`);
      });
      page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
      page.on("response", (r) => {
        if (r.status() >= 500) problems.push(`${r.status()} from ${r.url()}`);
      });
      if (email) await signIn(page, email);
      return page;
    });
    for (const c of contexts) await c.close();
    expect(problems, "console errors, page errors or 5xx responses").toEqual([]);
  },
});

// Raises a request from the help center and returns its key.
export async function raise(page: Page, type: RegExp, summary: string) {
  await page.goto("/portal");
  await page.getByRole("link", { name: type }).click();
  await page.getByLabel("Summary").fill(summary);
  await page.getByRole("button", { name: "Send" }).click();
  await page.waitForURL(/\/portal\/requests\/SH-\d+/);
  return page.url().match(/SH-\d+/)![0];
}

export async function newWork(page: Page, category: string, fields: Record<string, string>, selects: Record<string, string> = {}) {
  await page.goto(`/items/new?category=${category}`);
  for (const [label, value] of Object.entries(fields)) await field(page, label).fill(value);
  for (const [label, value] of Object.entries(selects)) await field(page, label).selectOption(value);
  await page.getByRole("button", { name: new RegExp(`^Raise ${category === "service_request" ? "service request" : category}$`) }).click();
  await page.waitForURL(/\/items\/SH-\d+/);
  return page.url().match(/SH-\d+/)![0];
}

export const status = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
