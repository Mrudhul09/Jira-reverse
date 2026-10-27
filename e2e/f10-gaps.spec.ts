import type { Page } from "@playwright/test";
import { ADMIN, AGENT, EMPLOYEE, a11y, expect, newWork, one, stamp, status, test } from "./fixtures";

const mail = (page: Page, data: object, token = "e2e-mail") => page.request.post("/api/inbound-email", { data, headers: { "x-inbound-token": token } });

test.describe("F10 requests by email", () => {
  test("F10-H1 an email raises a request, a reply lands on it", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const s = stamp();
    const first = await mail(theo, { from: "Theo Park <THEO@example.org>", subject: `Monitor flickers ${s}`, text: "Since this morning.", messageId: `<m1-${s}@mail>` });
    expect(first.status()).toBe(201);
    const { key } = (await first.json()) as { key: string };
    // The same message delivered twice raises one request.
    expect((await mail(theo, { from: "theo@example.org", subject: `Monitor flickers ${s}`, text: "Since this morning.", messageId: `<m1-${s}@mail>` })).status()).toBe(200);
    expect(one<{ n: number }>("select count(*) as n from items where summary = ?", `Monitor flickers ${s}`).n).toBe(1);

    const reply = await mail(theo, { From: "theo@example.org", Subject: `RE: [${key}] Monitor flickers ${s}`, TextBody: `Still flickering ${s}\n\nOn Tue, IT wrote:\n> old text` });
    expect(reply.status()).toBe(200);
    await theo.goto(`/portal/requests/${key}`);
    await expect(theo.getByRole("heading", { name: `Monitor flickers ${s}` })).toBeVisible();
    await expect(theo.getByText(`Still flickering ${s}`)).toBeVisible();
    await expect(theo.getByText("old text")).toHaveCount(0);
    const omar = await as(AGENT);
    await omar.goto(`/items/${key}?show=all`);
    await expect(omar.getByText("sent it by email")).toBeVisible();
  });

  test("F10-N1 strangers, bad tokens and other people's keys are refused", async ({ as }) => {
    const page = await as(null);
    expect((await mail(page, { from: "theo@example.org", subject: "x", text: "x" }, "wrong")).status()).toBe(401);
    const before = one<{ n: number }>("select count(*) as n from items").n;
    expect((await mail(page, { from: "someone@elsewhere.test", subject: "Free money", text: "x" })).status()).toBe(202);
    // A key Theo can't see starts a new request instead of commenting on Maya's.
    const notTheos = one<{ key: string }>(
      "select i.key from items i, users t where t.email = 'theo@example.org' and i.reporter_id <> t.id and not exists (select 1 from item_people p where p.item_id = i.id and p.user_id = t.id) and not exists (select 1 from approvals a where a.item_id = i.id and a.approver_id = t.id) limit 1",
    ).key;
    const res = await mail(page, { from: "theo@example.org", subject: `[${notTheos}] me too`, text: "x" });
    expect(res.status()).toBe(201);
    expect(((await res.json()) as { key: string }).key).not.toBe(notTheos);
    expect(one<{ n: number }>("select count(*) as n from items").n).toBe(before + 1);
  });
});

test.describe("F11 admins edit workflows", () => {
  test("F11-H1 rename a status and add one, then use it", async ({ as }) => {
    const admin = await as(ADMIN);
    await admin.goto("/settings?tab=workflows");
    await a11y(admin);
    const panel = admin.locator("section").filter({ has: admin.getByRole("heading", { name: "Incident", exact: true }) });
    await panel.getByLabel("Name for Pending").fill("On hold");
    await panel.getByRole("button", { name: "Save names" }).click();
    await expect(admin.getByRole("main").getByText("Status names saved.")).toBeVisible();
    await panel.getByLabel("New status").fill("Waiting on vendor");
    await panel.getByLabel("Works like").selectOption("Work in progress");
    await panel.getByRole("button", { name: "Add status" }).click();
    await expect(admin.getByRole("main").getByText(/Added "Waiting on vendor"/)).toBeVisible();

    const omar = await as(AGENT);
    const key = await newWork(omar, "incident", { Summary: `Vendor link down ${stamp()}`, "What stopped working?": "Link" });
    await expect(status(omar, "On hold")).toBeVisible();
    await status(omar, "Work in progress").click();
    await status(omar, "Waiting on vendor").click();
    await expect(omar.getByRole("main").getByText("Waiting on vendor").first()).toBeVisible();
    expect(one<{ status: string }>("select status from items where key = ?", key).status).toBe("Waiting on vendor");

    // In use, so it can't be removed yet.
    await admin.goto("/settings?tab=workflows");
    await admin.getByRole("button", { name: "Remove Waiting on vendor" }).click();
    await expect(admin.getByRole("main").getByRole("alert")).toContainText("Move it on first");

    // Put things back for the other tests.
    await status(omar, "Resolved").click();
    await admin.goto("/settings?tab=workflows");
    await admin.getByRole("button", { name: "Remove Waiting on vendor" }).click();
    await expect(admin.getByRole("main").getByText('Removed "Waiting on vendor".')).toBeVisible();
    await panel.getByLabel("Name for Pending").fill("Pending");
    await panel.getByRole("button", { name: "Save names" }).click();
    await expect(admin.getByRole("main").getByText("Status names saved.")).toBeVisible();
  });

  test("F11-E1 two statuses can't share a name", async ({ as }) => {
    const admin = await as(ADMIN);
    await admin.goto("/settings?tab=workflows");
    await admin.getByLabel("Name for Open").first().fill("Closed");
    await admin.getByRole("button", { name: "Save names" }).nth(1).click();
    await expect(admin.getByRole("main").getByRole("alert")).toContainText('both be called "Closed"');
  });
});
