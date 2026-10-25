import { AGENT, EMPLOYEE, a11y, db, expect, one, raise, stamp, status, test, field } from "./fixtures";

test.describe("F02 agent works the queue", () => {
  test("F02-H1 reply, work, resolve; requester sees it all", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const key = await raise(theo, /Ask IT a question/, `Monitor flickers ${stamp()}`);
    const omar = await as(AGENT);
    await omar.goto(`/items/${key}`);
    await a11y(omar);
    await omar.getByLabel("Message").fill("Swapping the cable now.");
    await omar.getByRole("button", { name: "Send reply" }).click();
    await expect(omar.getByText("Swapping the cable now.")).toBeVisible();
    await expect(omar.locator("section", { hasText: "Service levels" }).getByText("Met")).toBeVisible();
    await status(omar, "In progress").click();
    await expect(status(omar, "Resolved")).toBeVisible();
    await status(omar, "Resolved").click();
    await expect(status(omar, "Closed")).toBeVisible();
    await theo.goto(`/portal/requests/${key}`);
    await expect(theo.getByText("Swapping the cable now.")).toBeVisible();
    await expect(theo.getByText(/marked this as resolved/)).toBeVisible();
    await expect(theo.getByRole("heading", { name: "How did we do?" })).toBeVisible();
    await a11y(theo);
  });

  test("F02-E1 internal notes never reach the requester", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const key = await raise(theo, /Ask IT a question/, `Keyboard missing keys ${stamp()}`);
    const omar = await as(AGENT);
    await omar.goto(`/items/${key}`);
    await omar.getByRole("tab", { name: "Internal note" }).click();
    await omar.getByLabel("Internal note").fill("Secret: this user spilled coffee again");
    await omar.getByRole("button", { name: "Add note" }).click();
    await expect(omar.getByText("Secret: this user spilled coffee again")).toBeVisible();
    await theo.goto(`/portal/requests/${key}`);
    await expect(theo.getByText(/spilled coffee/)).toHaveCount(0);
  });

  test("F02-E2 waiting for the requester pauses the clock; their reply hands it back", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const key = await raise(theo, /Ask IT a question/, `Printer jams ${stamp()}`);
    const omar = await as(AGENT);
    await omar.goto(`/items/${key}`);
    await omar.getByLabel("Message").fill("Which printer is it?");
    await omar.getByRole("button", { name: "Send and mark waiting for customer" }).click();
    await expect(omar.getByText("Waiting for customer", { exact: true })).toBeVisible();
    await expect(omar.locator("section", { hasText: "Service levels" }).getByText(/paused/)).toBeVisible();
    await theo.goto(`/portal/requests/${key}`);
    await theo.getByLabel("Message").fill("The one by the kitchen.");
    await theo.getByRole("button", { name: "Send" }).click();
    await expect(theo.getByText("The one by the kitchen.")).toBeVisible();
    expect(one<{ status: string }>("select status from items where key = ?", key).status).toBe("Waiting for support");
  });

  test("F02-E3 a stale second tab gets a clear message", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const key = await raise(theo, /Ask IT a question/, `Two tabs ${stamp()}`);
    const omar = await as(AGENT);
    const tabB = await omar.context().newPage();
    await omar.goto(`/items/${key}`);
    await tabB.goto(`/items/${key}`);
    await status(omar, "Resolved").click();
    await expect(status(omar, "Closed")).toBeVisible();
    await status(tabB, "Waiting for customer").click();
    await expect(tabB.getByRole("main").getByRole("alert")).toContainText("can't go from Resolved to Waiting for customer");
    expect(one<{ status: string }>("select status from items where key = ?", key).status).toBe("Resolved");
  });

  test("F02-E4/E5 bulk: nothing ticked explains itself; two ticked get assigned", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const a = await raise(theo, /Ask IT a question/, `Bulk A ${stamp()}`);
    const b = await raise(theo, /Ask IT a question/, `Bulk B ${stamp()}`);
    const omar = await as(AGENT);
    await omar.goto("/queues");
    await omar.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(omar.getByRole("main").getByRole("alert")).toContainText("Tick at least one");
    await omar.getByRole("checkbox", { name: `Select ${a}` }).check();
    await omar.getByRole("checkbox", { name: `Select ${b}` }).check();
    await omar.getByLabel("Assign to").selectOption({ label: "Lena Fischer" });
    await omar.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(omar.getByRole("main").getByRole("status")).toContainText("Updated 2 work items");
    const lena = one<{ id: string }>("select id from users where email = 'lena@example.org'").id;
    for (const k of [a, b]) expect(one<{ a: string }>("select assignee_id as a from items where key = ?", k).a).toBe(lena);
  });

  test("F02-E6 filters, board and calendar", async ({ as }) => {
    const omar = await as(AGENT);
    await omar.goto("/queues");
    await field(omar, "Status").selectOption("Pending");
    await omar.getByRole("button", { name: "Filter" }).click();
    await expect(omar.getByRole("link", { name: /Wi-Fi crawls/ })).toBeVisible();
    await expect(omar.getByRole("link", { name: /Payroll shows/ })).toHaveCount(0);
    await omar.getByRole("link", { name: "Board", exact: true }).click();
    await expect(omar.getByRole("region", { name: /Pending, 1/ })).toBeVisible();
    await a11y(omar);
    await omar.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(omar.getByRole("region", { name: "Work by date raised" })).toBeVisible();
    await a11y(omar);
  });

  test("F02-E7 an expired session is sent to sign in and changes nothing", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const key = await raise(theo, /Ask IT a question/, `Expired session ${stamp()}`);
    const omar = await as(AGENT);
    await omar.goto(`/items/${key}`);
    db().prepare("update sessions set expires_at = 0 where user_id = (select id from users where email = ?)").run(AGENT);
    await status(omar, "In progress").click();
    await omar.waitForURL(/\/login/);
    expect(one<{ status: string }>("select status from items where key = ?", key).status).toBe("Waiting for support");
  });

  test("F02-N1 employees can't reach agent or admin pages", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    for (const p of ["/queues", "/items/SH-1", "/settings", "/reports"]) {
      await theo.goto(p);
      await expect(theo).toHaveURL(/\/portal$/);
    }
  });
});
