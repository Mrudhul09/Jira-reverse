import { ADMIN, AGENT, EMPLOYEE, a11y, expect, field, one, raise, stamp, status, test } from "./fixtures";

// The fixes /replica-entrepreneur found in what the original's users ask for.
test.describe("FIX fixes from users of the original", () => {
  test("FIX-1 the requester sees what to expect and the status of linked work", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const key = await raise(theo, /Ask IT a question/, `Payroll won't load ${stamp()}`);
    await expect(theo.getByText(/^A first reply: within /)).toBeVisible();
    const omar = await as(AGENT);
    await omar.goto(`/items/${key}`);
    await omar.getByLabel("How they relate").selectOption("relates");
    await omar.getByLabel("Key").fill("SH-5");
    await omar.getByRole("button", { name: "Link", exact: true }).click();
    await expect(omar.getByRole("cell", { name: "SH-5", exact: true })).toBeVisible();
    await theo.goto(`/portal/requests/${key}`);
    await expect(theo.getByText(/SH-5 Payroll shows a server error for everyone: work in progress/)).toBeVisible();
    await a11y(theo);
  });

  test("FIX-2/8 emails sent are listed on the item, and requester emails carry their answers", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    await theo.goto("/portal");
    await theo.getByRole("link", { name: /Unlock or reset an account/ }).click();
    await theo.getByLabel("Summary").fill(`Locked out of email ${stamp()}`);
    await theo.getByLabel("Which account?").selectOption("Email");
    await theo.getByRole("button", { name: "Send" }).click();
    await theo.waitForURL(/SH-\d+/);
    const key = theo.url().match(/SH-\d+/)![0];
    const omar = await as(AGENT);
    await omar.goto(`/items/${key}`);
    await omar.getByLabel("Message").fill("Unlocked; try again now.");
    await omar.getByRole("button", { name: "Send reply" }).click();
    await expect(omar.getByText("Unlocked; try again now.")).toBeVisible();
    const panel = omar.locator("section", { has: omar.getByRole("heading", { name: "Emails sent" }) });
    await expect(panel.getByText(/replied on/)).toBeVisible();
    await expect(panel.getByText(`to ${EMPLOYEE}`, { exact: false })).toBeVisible();
    const body = one<{ body: string }>("select o.body from outbox o join items i on i.id = o.item_id where i.key = ? and o.to_email = ? order by o.created_at desc", key, EMPLOYEE).body;
    expect(body).toContain("Which account?: Email");
  });

  test("FIX-3 merging a duplicate moves the conversation and lets its requester follow", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const keep = await raise(theo, /Ask IT a question/, `Printer on 2 is jammed ${stamp()}`);
    const ravi = await as("ravi@example.org");
    const dup = await raise(ravi, /Ask IT a question/, `Printer jam second floor ${stamp()}`);
    await ravi.getByLabel("Message").fill("It's the one by the lifts.");
    await ravi.getByRole("button", { name: "Send" }).click();
    await expect(ravi.getByText("It's the one by the lifts.")).toBeVisible();
    const omar = await as(AGENT);
    await omar.goto(`/items/${dup}`);
    await omar.getByLabel("Merge into").fill(keep);
    await omar.getByRole("button", { name: "Merge", exact: true }).click();
    await omar.waitForURL(new RegExp(`/items/${keep}`));
    await expect(omar.getByText("It's the one by the lifts.")).toBeVisible();
    await expect(omar.getByText(new RegExp(`Merged ${dup}`))).toBeVisible();
    expect(one<{ s: string }>("select status as s from items where key = ?", dup).s).toBe("Closed");
    const res = await ravi.goto(`/portal/requests/${keep}`);
    expect(res!.status()).toBe(200);
    await expect(ravi.getByText("It's the one by the lifts.")).toBeVisible();
  });

  test("FIX-3b can't merge into a different kind of work", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const key = await raise(theo, /Ask IT a question/, `Wrong merge ${stamp()}`);
    const omar = await as(AGENT);
    await omar.goto(`/items/${key}`);
    await omar.getByLabel("Merge into").fill("SH-5");
    await omar.getByRole("button", { name: "Merge", exact: true }).click();
    await expect(omar.getByRole("main").getByRole("alert")).toContainText("Only the same kind of work can merge");
  });

  test("FIX-4 resolve with a note and a saved reply in one step", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    const key = await raise(theo, /Ask IT a question/, `Mouse double-clicks ${stamp()}`);
    const omar = await as(AGENT);
    await omar.goto(`/items/${key}`);
    const panel = omar.locator("section", { has: omar.getByRole("heading", { name: "Finish with a note" }) });
    await panel.getByLabel("What fixed it (kept on the record)").fill("Swapped the mouse for a new one.");
    await panel.getByLabel("Tell the requester (optional)").selectOption({ label: "Please check" });
    await panel.getByRole("button", { name: "Save note and mark resolved" }).click();
    await expect(status(omar, "Closed")).toBeVisible();
    const row = one<{ status: string; resolution: string }>("select status, resolution from items where key = ?", key);
    expect(row).toEqual({ status: "Resolved", resolution: "Swapped the mouse for a new one." });
    await theo.goto(`/portal/requests/${key}`);
    await expect(theo.getByText("That should be fixed now.", { exact: false })).toBeVisible();
    await expect(theo.getByText("Swapped the mouse for a new one.")).toBeVisible();
  });

  test("FIX-5 people choose which emails they get", async ({ as }) => {
    const theo = await as(EMPLOYEE);
    await theo.goto("/portal/account");
    await a11y(theo);
    await theo.getByLabel("Updates on what I asked for").uncheck();
    await theo.getByRole("button", { name: "Save", exact: true }).click();
    await expect(theo.getByRole("main").getByRole("status")).toContainText("Saved.");
    const key = await raise(theo, /Ask IT a question/, `No emails please ${stamp()}`);
    const omar = await as(AGENT);
    await omar.goto(`/items/${key}`);
    await omar.getByLabel("Message").fill("On it.");
    await omar.getByRole("button", { name: "Send reply" }).click();
    await expect(omar.getByText("On it.", { exact: true })).toBeVisible();
    expect(one<{ n: number }>("select count(*) as n from outbox o join items i on i.id = o.item_id where i.key = ? and o.to_email = ?", key, EMPLOYEE).n).toBe(0);
    expect(one<{ n: number }>("select count(*) as n from notifications n join items i on i.id = n.item_id where i.key = ? and n.message like '%replied%'", key).n).toBe(1);
    await theo.goto("/portal/account");
    await theo.getByLabel("Updates on what I asked for").check();
    await theo.getByRole("button", { name: "Save", exact: true }).click();
  });

  test("FIX-6 queues sort by age", async ({ as }) => {
    const omar = await as(AGENT);
    await omar.goto("/queues");
    await omar.getByLabel("Sort by").selectOption("oldest");
    await omar.getByRole("button", { name: "Apply" }).click();
    await expect(omar).toHaveURL(/sort=oldest/);
    const keys = await omar.getByRole("link", { name: /^SH-\d+$/ }).allTextContents();
    const created = keys.map((k) => one<{ c: number }>("select created_at as c from items where key = ?", k).c);
    expect([...created].sort((a, b) => a - b)).toEqual(created);
  });

  test("FIX-7 assets export round-trips, and SLAs can be renamed", async ({ as }) => {
    const omar = await as(AGENT);
    const typeId = one<{ id: string }>("select id from asset_types where name = 'Laptop'").id;
    const res = await omar.request.get(`/api/assets/export?type=${typeId}`);
    expect(res.status()).toBe(200);
    const csv = await res.text();
    expect(csv.split("\r\n")[0]).toBe("name,serial,model,user,state,bought,site");
    expect(csv).toContain("LT-2041,SN-7Q2X-0041");
    expect(csv).toContain(",Main office");
    const theo = await as(EMPLOYEE);
    expect((await theo.request.get(`/api/assets/export?type=${typeId}`)).status()).toBe(401);
    const dana = await as(ADMIN);
    await dana.goto("/settings?tab=slas");
    const first = dana.locator("form").filter({ has: dana.getByRole("heading", { name: "Time to first response" }) });
    await field(first, "Name").fill("Time to first reply");
    await first.getByRole("button", { name: "Save goals" }).click();
    await expect(dana.getByRole("heading", { name: "Time to first reply" })).toBeVisible();
    await field(dana.locator("form").filter({ has: dana.getByRole("heading", { name: "Time to first reply" }) }), "Name").fill("Time to first response");
    await dana.locator("form").filter({ has: dana.getByRole("heading", { name: "Time to first reply" }) }).getByRole("button", { name: "Save goals" }).click();
    await expect(dana.getByRole("heading", { name: "Time to first response" })).toBeVisible();
  });
});
