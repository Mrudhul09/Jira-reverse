import { AGENT, EMPLOYEE, a11y, expect, one, raise, signIn, stamp, test } from "./fixtures";

test.describe("F01 employee raises a request", () => {
  test("F01-H1 raise from the help center, agent sees it", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    await a11y(theo);
    const summary = `Projector in room 4 shows nothing ${stamp()}`;
    await theo.getByRole("link", { name: /Ask IT a question/ }).click();
    await a11y(theo);
    const key = await raise(theo, /Ask IT a question/, summary);
    await expect(theo.getByRole("heading", { name: summary })).toBeVisible();
    await expect(theo.getByText("Sent. You'll see every update here.")).toBeVisible();
    await a11y(theo);
    const omar = await as(AGENT);
    await omar.goto("/queues");
    await expect(omar.getByRole("link", { name: key, exact: true })).toBeVisible();
    await a11y(omar);
  });

  test("F01-H2 an article is suggested while typing", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    await theo.getByRole("link", { name: /Ask IT a question/ }).click();
    await theo.getByLabel("Summary").pressSequentially("vpn connect", { delay: 20 });
    const hint = theo.getByRole("link", { name: /Working from home: connect to the VPN/ });
    await expect(hint).toBeVisible();
    const before = one<{ views: number }>("select views from articles where title like 'Working from home%'").views;
    await theo.goto(await hint.getAttribute("href") as string);
    await expect(theo.getByRole("heading", { name: /connect to the VPN/ })).toBeVisible();
    await a11y(theo);
    expect(one<{ views: number }>("select views from articles where title like 'Working from home%'").views).toBe(before + 1);
  });

  test("F01-E1 empty required fields are refused by the server too", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    await theo.goto("/portal");
    await theo.getByRole("link", { name: /Unlock or reset an account/ }).click();
    await theo.waitForURL(/\/portal\/new\//);
    const count = one<{ n: number }>("select count(*) as n from items").n;
    await theo.evaluate(() => document.querySelectorAll("[required]").forEach((el) => el.removeAttribute("required")));
    await theo.getByRole("button", { name: "Send" }).click();
    await expect(theo.getByRole("main").getByRole("alert")).toContainText("Please fill in: Summary, Which account?");
    expect(one<{ n: number }>("select count(*) as n from items").n).toBe(count);
    await a11y(theo);
  });

  test("F01-E2 very long summary is cut to 200 characters", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    await theo.goto("/portal");
    await theo.getByRole("link", { name: /Ask IT a question/ }).click();
    await theo.waitForURL(/\/portal\/new\//);
    await theo.evaluate(() => document.getElementById("summary")!.removeAttribute("maxlength"));
    await theo.getByLabel("Summary").fill("x".repeat(1000));
    await theo.getByRole("button", { name: "Send" }).click();
    await theo.waitForURL(/SH-\d+/);
    const key = theo.url().match(/SH-\d+/)![0];
    expect(one<{ n: number }>("select length(summary) as n from items where key = ?", key).n).toBe(200);
    const sideways = await theo.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(2);
  });

  test("F01-E3 emoji and accents survive the round trip", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const summary = `Café Wi-Fi ☕ ne marche pas — ñ ${stamp()}`;
    const key = await raise(theo, /Ask IT a question/, summary);
    await expect(theo.getByRole("heading", { name: summary })).toBeVisible();
    const omar = await as(AGENT);
    await omar.goto(`/items/${key}`);
    await expect(omar.getByRole("heading", { name: summary })).toBeVisible();
  });

  test("F01-E4 double click on Send creates one request", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    await theo.goto("/portal");
    await theo.getByRole("link", { name: /Ask IT a question/ }).click();
    const summary = `Double click test ${stamp()}`;
    await theo.getByLabel("Summary").fill(summary);
    await theo.getByRole("button", { name: "Send" }).dblclick();
    await theo.waitForURL(/SH-\d+/);
    await theo.waitForLoadState("networkidle");
    expect(one<{ n: number }>("select count(*) as n from items where summary = ?", summary).n).toBe(1);
  });

  test("F01-E5 keyboard only", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    await theo.goto("/portal");
    const card = theo.getByRole("link", { name: /Ask IT a question/ });
    await card.focus();
    await expect(card).toBeFocused();
    await theo.keyboard.press("Enter");
    await theo.waitForURL(/\/portal\/new\//);
    await theo.getByLabel("Summary").focus();
    const summary = `Keyboard only ${stamp()}`;
    await theo.keyboard.type(summary);
    // Tab forward until Send has focus, then press Enter.
    for (let i = 0; i < 12; i++) {
      await theo.keyboard.press("Tab");
      if (await theo.getByRole("button", { name: "Send" }).evaluate((b) => b === document.activeElement)) break;
    }
    await expect(theo.getByRole("button", { name: "Send" })).toBeFocused();
    await theo.keyboard.press("Enter");
    await theo.waitForURL(/SH-\d+/);
    await expect(theo.getByRole("heading", { name: summary })).toBeVisible();
  });

  test("F01-E6 phone width", async ({ as }) => {
    const theo = await as(EMPLOYEE, { viewport: { width: 390, height: 844 } });
    const key = await raise(theo, /Ask IT a question/, `From my phone ${stamp()}`);
    expect(key).toMatch(/SH-\d+/);
    const sideways = await theo.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(2);
    await a11y(theo);
  });

  test("F01-E7 restricted request types are hidden and blocked", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    await theo.goto("/portal");
    await expect(theo.getByRole("link", { name: /Set up a new starter/ })).toHaveCount(0);
    const id = one<{ id: string }>("select id from request_types where name = 'Set up a new starter'").id;
    const res = await theo.goto(`/portal/new/${id}`);
    expect(res!.status()).toBe(404);
  });

  test("F01-N1 wrong password is refused", async ({ as }) => {
    const page = await as(null);
    await signIn(page, EMPLOYEE, "not-the-password");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("don't match");
    await a11y(page);
    expect(page.url()).toContain("/login");
  });

  test("F01-N2 someone else's request stays invisible", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const mayas = one<{ key: string }>("select i.key from items i join users u on u.id = i.reporter_id where u.email = 'maya@example.org' limit 1").key;
    expect((await theo.goto(`/portal/requests/${mayas}`))!.status()).toBe(404);
    await theo.goto("/portal/requests?view=closed");
    await expect(theo.getByRole("link", { name: mayas, exact: true })).toHaveCount(0);
  });
});
