import type { Page } from "@playwright/test";
import { APPROVER, EMPLOYEE, a11y, expect, one, stamp, test } from "./fixtures";

async function orderScreen(theo: Page, summary: string) {
  await theo.goto("/portal");
  await theo.getByRole("link", { name: /Order equipment/ }).click();
  await theo.getByLabel("Summary").fill(summary);
  await theo.getByLabel("What do you need?").selectOption("Screen");
  await theo.getByLabel("What is it for?").fill("Two screens for reports");
  await theo.getByRole("button", { name: "Send" }).click();
  await theo.waitForURL(/SH-\d+/);
  return theo.url().match(/SH-\d+/)![0];
}

test.describe("F03 approvals", () => {
  test("F03-H1 approve from the help center", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const key = await orderScreen(theo, `Screen please ${stamp()}`);
    await expect(theo.getByText("Waiting for approval", { exact: true })).toBeVisible();
    const ravi = await as(APPROVER);
    await ravi.goto("/portal/requests?view=approvals");
    await ravi.getByRole("link", { name: key, exact: true }).click();
    await a11y(ravi);
    await ravi.getByLabel("Note to the requester (optional)").fill("Go ahead");
    await ravi.getByRole("button", { name: "Approve" }).click();
    await expect(ravi.getByRole("main").getByRole("status")).toContainText("Approved.");
    expect(one<{ status: string }>("select status from items where key = ?", key).status).toBe("Waiting for support");
    expect(one<{ n: number }>("select count(*) as n from notifications n join users u on u.id = n.user_id where u.email = ? and n.message like ?", EMPLOYEE, `%approved ${key}: Go ahead%`).n).toBe(1);
  });

  test("F03-H2 decline with a note", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const key = await orderScreen(theo, `Third screen ${stamp()}`);
    const ravi = await as(APPROVER);
    await ravi.goto(`/portal/requests/${key}`);
    await ravi.getByLabel("Note to the requester (optional)").fill("Two is plenty");
    await ravi.getByRole("button", { name: "Decline" }).click();
    await expect(ravi.getByRole("main").getByRole("status")).toContainText("Declined.");
    await theo.goto(`/portal/requests/${key}`);
    await expect(theo.getByText("Declined", { exact: true }).first()).toBeVisible();
  });

  test("F03-E1 deciding twice from two tabs", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const key = await orderScreen(theo, `Headset ${stamp()}`);
    const ravi = await as(APPROVER);
    const tabB = await ravi.context().newPage();
    await ravi.goto(`/portal/requests/${key}`);
    await tabB.goto(`/portal/requests/${key}`);
    await ravi.getByRole("button", { name: "Approve" }).click();
    await expect(ravi.getByRole("main").getByRole("status")).toContainText("Approved.");
    await tabB.getByRole("button", { name: "Approve" }).click();
    await expect(tabB.getByRole("main").getByRole("alert")).toContainText("already been decided");
  });

  test("F03-N1 someone else's approval can't be decided", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const key = await orderScreen(theo, `Forged approval ${stamp()}`);
    // The admin's pending CAB approval on the seeded change: not Ravi's to decide.
    const notRavis = one<{ id: string; item: string }>(
      "select a.id, i.key as item from approvals a join items i on i.id = a.item_id join users u on u.id = a.approver_id where u.email = 'admin@example.org' and a.decision = 'pending'",
    );
    const ravi = await as(APPROVER);
    await ravi.goto(`/portal/requests/${key}`);
    await ravi.evaluate((id) => {
      (document.querySelector('input[name="approvalId"]') as HTMLInputElement).value = id;
    }, notRavis.id);
    await ravi.getByRole("button", { name: "Approve" }).click();
    await expect(ravi.getByRole("main").getByRole("alert")).toContainText("isn't yours to decide");
    expect(one<{ d: string }>("select decision as d from approvals where id = ?", notRavis.id).d).toBe("pending");
    expect(one<{ status: string }>("select status from items where key = ?", key).status).toBe("Waiting for approval");
  });
});
