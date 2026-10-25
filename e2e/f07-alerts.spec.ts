import { AGENT, a11y, expect, one, stamp, test } from "./fixtures";

const post = (page: import("@playwright/test").Page, data: object, token = "e2e-token") =>
  page.request.post("/api/alerts", { data, headers: { "x-alert-token": token } });

test.describe("F07 alert to incident", () => {
  test("F07-H1/E1 a P2 alert opens one incident; repeats are counted", async ({ as }) => {
    const omar = await as(AGENT);
    const s = stamp();
    const first = await post(omar, { message: `Disk 95% on file server ${s}`, priority: 2, alias: `fs-disk-${s}`, team: "Infrastructure" });
    expect(first.status()).toBe(201);
    const again = await post(omar, { message: `Disk 95% on file server ${s}`, priority: 2, alias: `fs-disk-${s}` });
    expect(again.status()).toBe(200);
    expect((await again.json()).repeat).toBe(true);
    expect(one<{ n: number }>("select count(*) as n from items where summary = ?", `Disk 95% on file server ${s}`).n).toBe(1);
    await omar.goto("/alerts");
    await expect(omar.getByRole("row", { name: new RegExp(s) })).toBeVisible();
    await expect(omar.getByRole("row", { name: new RegExp(s) }).getByText("2×")).toBeVisible();
    await a11y(omar);
  });

  test("F07-E2 acknowledge, then open an incident by hand", async ({ as }) => {
    const omar = await as(AGENT);
    const s = stamp();
    await post(omar, { message: `Latency on VPN ${s}`, priority: 4, team: "Network" });
    await omar.goto("/alerts");
    const row = omar.getByRole("row", { name: new RegExp(`Latency on VPN ${s}`) });
    await row.getByRole("button", { name: "Acknowledge" }).click();
    await expect(row.getByText("acknowledged")).toBeVisible();
    await row.getByRole("button", { name: "Open incident" }).click();
    await omar.waitForURL(/\/items\/SH-\d+/);
    await expect(omar.getByRole("heading", { name: new RegExp(`Latency on VPN ${s}`) })).toBeVisible();
  });

  test("F07-N1 bad token and missing message", async ({ as }) => {
    const omar = await as(AGENT);
    expect((await post(omar, { message: "x" }, "wrong")).status()).toBe(401);
    expect((await post(omar, { priority: 1 })).status()).toBe(400);
    expect((await post(omar, { message: "x", team: "No such team" })).status()).toBe(400);
  });
});
