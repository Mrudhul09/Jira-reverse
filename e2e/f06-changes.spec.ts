import type { Page } from "@playwright/test";
import { ADMIN, a11y, expect, newWork, one, stamp, status, test, field } from "./fixtures";

// Kofi is in Infrastructure (and the CAB); changes default to the Infrastructure team.
const RAISER = "omar@example.org";
const PEER = "kofi@example.org";

async function change(page: Page, type: string, start = "2031-03-10T22:00", end = "2031-03-10T23:00") {
  return newWork(page, "change", { Summary: `Change ${type} ${stamp()}`, "Window starts": start, "Window ends": end }, { Type: type, Risk: "medium" });
}

async function decide(page: Page, key: string, decision: "Approve" | "Decline") {
  await page.goto(`/items/${key}`);
  await page.getByRole("button", { name: decision }).click();
  // Wait for the decision's own result, not any notice that was already on the page.
  await page.waitForURL(/[?&](ok|error)=/);
}

test.describe("F06 changes", () => {
  test("F06-H1/E1 normal change: teammate review, then every CAB member", async ({ as }) => {
    const omar = await as(RAISER);
    const key = await change(omar, "normal");
    await status(omar, "Planning").click();
    await status(omar, "Awaiting approval").click();
    await expect(omar.getByText("Peer review 1").first()).toBeVisible();
    await expect(omar.getByRole("button", { name: "Approve" })).toHaveCount(0); // F06-E1: the raiser can't review it
    await a11y(omar);
    const kofi = await as(PEER);
    await decide(kofi, key, "Approve");
    await expect(kofi.getByText("CAB review 1").first()).toBeVisible();
    await decide(kofi, key, "Approve"); // Kofi is also on the CAB
    expect(one<{ s: string }>("select status as s from items where key = ?", key).s).toBe("Awaiting approval");
    const dana = await as(ADMIN);
    await decide(dana, key, "Approve");
    expect(one<{ s: string }>("select status as s from items where key = ?", key).s).toBe("Awaiting implementation");
    await dana.goto("/changes/calendar?month=2031-03");
    await expect(dana.getByRole("link", { name: new RegExp(key) })).toBeVisible();
    await a11y(dana);
  });

  test("F06-E2 standard change skips approval", async ({ as }) => {
    const omar = await as(RAISER);
    const key = await change(omar, "standard");
    await status(omar, "Planning").click();
    await expect(status(omar, "Awaiting approval")).toHaveCount(0);
    await status(omar, "Awaiting implementation").click();
    expect(one<{ n: number }>("select count(*) as n from approvals a join items i on i.id = a.item_id where i.key = ?", key).n).toBe(0);
  });

  test("F06-E3 emergency change needs any one CAB member", async ({ as }) => {
    const omar = await as(RAISER);
    const key = await change(omar, "emergency");
    await status(omar, "Awaiting approval").click();
    const dana = await as(ADMIN);
    await decide(dana, key, "Approve");
    expect(one<{ s: string }>("select status as s from items where key = ?", key).s).toBe("Awaiting implementation");
  });

  test("F06-E4 one CAB decline ends it", async ({ as }) => {
    const omar = await as(RAISER);
    const key = await change(omar, "emergency");
    await status(omar, "Awaiting approval").click();
    const dana = await as(ADMIN);
    await decide(dana, key, "Decline");
    expect(one<{ s: string }>("select status as s from items where key = ?", key).s).toBe("Declined");
    expect(one<{ n: number }>("select count(*) as n from approvals a join items i on i.id = a.item_id where i.key = ? and a.decision = 'pending'", key).n).toBe(0);
  });

  test("F06-E5 a window that ends before it starts is refused", async ({ as }) => {
    const omar = await as(RAISER);
    await omar.goto("/items/new?category=change");
    const summary = `Backwards ${stamp()}`;
    await field(omar, "Summary").fill(summary);
    await omar.getByLabel("Window starts").fill("2031-04-02T10:00");
    await omar.getByLabel("Window ends").fill("2031-04-02T09:00");
    await omar.getByRole("button", { name: "Raise change" }).click();
    await expect(omar.getByRole("main").getByRole("alert")).toContainText("has to end after it starts");
    // BUG-007: what was typed is still there.
    await expect(field(omar, "Summary")).toHaveValue(summary);
    await expect(omar.getByLabel("Window starts")).toHaveValue("2031-04-02T10:00");
  });

  test("F06-E6 overlapping windows are flagged on both", async ({ as }) => {
    const omar = await as(RAISER);
    const a = await change(omar, "normal", "2031-05-05T20:00", "2031-05-05T22:00");
    const b = await change(omar, "normal", "2031-05-05T21:00", "2031-05-05T23:00");
    await expect(omar.getByText(new RegExp(`Overlaps .*${a}`))).toBeVisible();
    await omar.goto(`/items/${a}`);
    await expect(omar.getByText(new RegExp(`Overlaps .*${b}`))).toBeVisible();
  });
});
