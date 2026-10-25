import { AGENT, a11y, expect, newWork, one, stamp, status, test } from "./fixtures";

test.describe("F04 incidents, including major", () => {
  test("F04-H1 impact Extensive + urgency Critical is P1 and major", async ({ as }) => {
    const omar = await as(AGENT);
    await omar.goto("/items/new?category=incident");
    await a11y(omar);
    const key = await newWork(omar, "incident", { Summary: `Email down for everyone ${stamp()}`, "What stopped working?": "Email" }, { Impact: "1", Urgency: "1" });
    await expect(omar.getByText("P1 Highest", { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(omar.getByRole("heading", { level: 1 }).getByText("Major", { exact: true })).toBeVisible();
    await expect(omar.getByText(/Made major automatically/)).toBeVisible();
    await a11y(omar);
    expect(one<{ m: number }>("select is_major as m from items where key = ?", key).m).toBe(1);
  });

  test("F04-H2 responders and a note at a past time", async ({ as }) => {
    const omar = await as(AGENT);
    const key = await newWork(omar, "incident", { Summary: `Badge readers offline ${stamp()}`, "What stopped working?": "Doors" });
    await omar.getByLabel("Person").selectOption({ label: "Kofi Mensah" });
    await omar.locator("form", { has: omar.getByLabel("Person") }).getByRole("button", { name: "Add" }).click();
    await expect(omar.getByText("Kofi Mensah · responder")).toBeVisible();
    await omar.getByRole("tab", { name: "Internal note" }).click();
    await omar.getByLabel("Internal note").fill("Security desk called it in");
    const past = new Date(Date.now() - 2 * 60_000);
    const p = (n: number) => String(n).padStart(2, "0");
    await omar.getByLabel("Happened at").fill(`${past.getFullYear()}-${p(past.getMonth() + 1)}-${p(past.getDate())}T${p(past.getHours())}:${p(past.getMinutes())}`);
    await omar.getByRole("button", { name: "Add note" }).click();
    await expect(omar.getByText("Security desk called it in")).toBeVisible();
    const c = one<{ occurred_at: number; created_at: number }>("select c.occurred_at, c.created_at from comments c join items i on i.id = c.item_id where i.key = ?", key);
    expect(c.occurred_at).toBeLessThan(c.created_at);
  });

  test("F04-E1 a note can't be dated in the future", async ({ as }) => {
    const omar = await as(AGENT);
    const key = await newWork(omar, "incident", { Summary: `Future note ${stamp()}`, "What stopped working?": "Clock" });
    await omar.getByRole("tab", { name: "Internal note" }).click();
    await omar.getByLabel("Internal note").fill("From tomorrow");
    await omar.getByLabel("Happened at").fill("2099-01-01T10:00");
    await omar.getByRole("button", { name: "Add note" }).click();
    await expect(omar.getByText("From tomorrow")).toBeVisible();
    const c = one<{ occurred_at: number; created_at: number }>("select c.occurred_at, c.created_at from comments c join items i on i.id = c.item_id where i.key = ?", key);
    expect(c.occurred_at).toBe(c.created_at);
  });

  test("F04-E2 changing urgency recalculates priority", async ({ as }) => {
    const omar = await as(AGENT);
    const key = await newWork(omar, "incident", { Summary: `Slow laptop ${stamp()}`, "What stopped working?": "Laptop" }, { Impact: "1", Urgency: "1" });
    await omar.getByLabel("Urgency").selectOption("4");
    await omar.getByRole("button", { name: "Save", exact: true }).click();
    await expect(omar.getByLabel("Priority")).toHaveValue("4");
    expect(one<{ p: number }>("select priority as p from items where key = ?", key).p).toBe(4);
  });

  test("F04-H3 post-incident review: can't publish half-done, then publish", async ({ as }) => {
    const omar = await as(AGENT);
    const key = await newWork(omar, "incident", { Summary: `Wiki down ${stamp()}`, "What stopped working?": "Wiki" });
    await status(omar, "Resolved").click();
    await omar.getByRole("link", { name: "Write the post-incident review" }).click();
    await a11y(omar);
    await omar.getByLabel("What happened").fill("The wiki was down for 20 minutes.");
    await omar.getByRole("button", { name: "Publish" }).click();
    await expect(omar.getByRole("main").getByRole("alert")).toContainText("Saved as a draft");
    await expect(omar.getByLabel("What happened")).toHaveValue("The wiki was down for 20 minutes.");
    await omar.getByLabel("Why it happened").fill("Certificate expired; no renewal reminder.");
    await omar.getByRole("button", { name: "Publish" }).click();
    await expect(omar.getByRole("main").getByRole("status")).toContainText("Published.");
    expect(one<{ s: string }>("select p.status as s from pirs p join items i on i.id = p.incident_id where i.key = ?", key).s).toBe("published");
  });
});

test.describe("F05 problems", () => {
  test("F05-H1 incident → problem → known error → change, linked both ways", async ({ as }) => {
    const omar = await as(AGENT);
    const inc = await newWork(omar, "incident", { Summary: `Nightly backup fails ${stamp()}`, "What stopped working?": "Backups" });
    await omar.getByRole("link", { name: "Open a problem" }).click();
    await expect(omar.getByLabel("Summary")).toHaveValue(/Nightly backup fails/);
    await omar.getByRole("button", { name: "Raise problem" }).click();
    await omar.waitForURL(/\/items\/SH-\d+(\?|$)/);
    const prb = omar.url().match(/SH-\d+/)![0];
    await expect(omar.getByRole("link", { name: inc, exact: true })).toBeVisible();
    await expect(omar.getByRole("cell", { name: "causes", exact: true })).toBeVisible();
    await status(omar, "Under investigation").click();
    await status(omar, "Known error").click();
    await expect(omar.getByText("Known error", { exact: true }).first()).toBeVisible();
    await omar.getByRole("link", { name: "Raise a change" }).click();
    await omar.getByRole("button", { name: "Raise change" }).click();
    await omar.waitForURL(/\/items\/SH-\d+(\?|$)/);
    await expect(omar.getByRole("cell", { name: "fixes", exact: true })).toBeVisible();
    await omar.goto(`/items/${prb}`);
    await expect(omar.getByRole("cell", { name: "is fixed by", exact: true })).toBeVisible();
    await omar.goto("/problems");
    await a11y(omar);
  });
});
