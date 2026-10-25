import { ADMIN, AGENT, EMPLOYEE, a11y, expect, one, signIn, stamp, test, field } from "./fixtures";

test.describe("F08 admin", () => {
  test("F08-H1 a new request type with a list question", async ({ as }) => {
    const dana = await as(ADMIN);
    await dana.goto("/settings?tab=types");
    await a11y(dana);
    const name = `Borrow a projector ${stamp()}`;
    const add = dana.locator("section", { has: dana.getByRole("heading", { name: "Add something people can ask for" }) });
    await field(add, "Name").fill(name);
    await add.getByLabel("Help center group").fill("Equipment and access");
    await add.getByLabel("One-line description").fill("For meetings and training days.");
    await add.getByLabel("Extra questions").fill("Which room? | list | required | Room 1, Room 2\nWhen? | date");
    await add.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dana.getByRole("main").getByRole("status")).toContainText("Saved.");
    const theo = await as(EMPLOYEE);
    await theo.goto("/portal");
    await theo.getByRole("link", { name: new RegExp(name) }).click();
    await theo.getByLabel("Summary").fill("For Thursday's training");
    await theo.getByLabel("Which room?").selectOption("Room 2");
    await theo.getByRole("button", { name: "Send" }).click();
    await theo.waitForURL(/SH-\d+/);
    await expect(theo.getByText("Room 2")).toBeVisible();
  });

  test("F08-H1b a bad question line is explained", async ({ as }) => {
    const dana = await as(ADMIN);
    await dana.goto("/settings?tab=types");
    const add = dana.locator("section", { has: dana.getByRole("heading", { name: "Add something people can ask for" }) });
    await field(add, "Name").fill(`Broken ${stamp()}`);
    await add.getByLabel("Extra questions").fill("Colour | dropdown");
    await add.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dana.getByRole("main").getByRole("alert")).toContainText("isn't a field kind");
  });

  test("F08-H2 add a person who can then sign in; short passwords refused", async ({ as }) => {
    const dana = await as(ADMIN);
    await dana.goto("/settings?tab=people");
    await a11y(dana);
    const email = `newstarter.${stamp()}@example.org`;
    const add = dana.locator("section", { has: dana.getByRole("heading", { name: "Add a person" }) });
    await field(add, "Name").fill("New Starter");
    await field(add, "Email").fill(email);
    await add.getByLabel("First password").fill("short");
    await add.evaluate((el) => el.querySelectorAll("[minlength]").forEach((i) => i.removeAttribute("minlength")));
    await add.getByRole("button", { name: "Add person" }).click();
    await expect(dana.getByRole("main").getByRole("alert")).toContainText("at least 12 characters");
    await field(add, "Name").fill("New Starter");
    await field(add, "Email").fill(email);
    await add.getByLabel("First password").fill("a-long-first-password");
    await add.getByRole("button", { name: "Add person" }).click();
    await expect(dana.getByRole("main").getByRole("status")).toContainText("They can sign in now.");
    const page = await as(null);
    await signIn(page, email, "a-long-first-password");
    await expect(page).toHaveURL(/\/portal$/);
  });

  test("F08-H3 an automation rule routes matching work", async ({ as }) => {
    const dana = await as(ADMIN);
    await dana.goto("/automation");
    await a11y(dana);
    const word = `toner${stamp()}`;
    await field(dana, "Name").fill(`Toner goes to Network ${word}`);
    await dana.getByLabel("Mentions").fill(word);
    await dana.locator("#a1").selectOption("assign_team");
    await dana.locator("#a1_team").selectOption({ label: "Network" });
    await dana.getByRole("button", { name: "Add rule" }).click();
    await expect(dana.getByRole("main").getByRole("status")).toContainText("Rule added");
    const theo = await as(EMPLOYEE);
    await theo.goto("/portal");
    await theo.getByRole("link", { name: /Ask IT a question/ }).click();
    await theo.getByLabel("Summary").fill(`Out of ${word}`);
    await theo.getByRole("button", { name: "Send" }).click();
    await theo.waitForURL(/SH-\d+/);
    const key = theo.url().match(/SH-\d+/)![0];
    expect(one<{ t: string }>("select t.name as t from items i join teams t on t.id = i.team_id where i.key = ?", key).t).toBe("Network");
  });

  test("F08-H4 changing an SLA goal shows on matching work", async ({ as }) => {
    const dana = await as(ADMIN);
    await dana.goto("/settings?tab=slas");
    await a11y(dana);
    const form = dana.locator("form", { has: dana.getByRole("heading", { name: "Time to first response" }) });
    await form.locator('input[name="g0_minutes"]').fill("45");
    await form.getByRole("button", { name: "Save goals" }).click();
    await expect(dana.getByRole("main").getByRole("status")).toContainText("Goals saved");
    await dana.goto("/items/SH-5");
    await expect(dana.locator("section", { hasText: "Service levels" }).locator('[title^="Time to first response: goal 45m"]')).toBeVisible();
  });

  test("F08-E1 removing someone's details keeps their work", async ({ as }) => {
    const dana = await as(ADMIN);
    const before = one<{ n: number }>("select count(*) as n from items i join users u on u.id = i.reporter_id where u.email = 'maya@example.org'").n;
    await dana.goto("/settings?tab=people");
    const row = dana.getByRole("row", { name: /Maya Lindqvist/ });
    await row.getByText("Edit").click();
    await row.getByRole("button", { name: "Remove personal details" }).click();
    await expect(dana.getByRole("main").getByRole("alert")).toContainText("Tick the box");
    await dana.getByRole("row", { name: /Maya Lindqvist/ }).getByText("Edit").click();
    await dana.getByRole("row", { name: /Maya Lindqvist/ }).getByLabel("Yes, remove their personal details").check();
    await dana.getByRole("row", { name: /Maya Lindqvist/ }).getByRole("button", { name: "Remove personal details" }).click();
    await expect(dana.getByRole("main").getByRole("status")).toContainText("past work stays");
    expect(one<{ n: number }>("select count(*) as n from users where email = 'maya@example.org'").n).toBe(0);
    expect(one<{ n: number }>("select count(*) as n from items i join users u on u.id = i.reporter_id where u.name = 'Former colleague'").n).toBe(before);
    const page = await as(null);
    await signIn(page, "maya@example.org", "demo-itsm-2026");
    expect(page.url()).toContain("/login");
  });

  test("F08-N1 agents can't open settings", async ({ as }) => {
    const omar = await as(AGENT);
    await omar.goto("/settings");
    await expect(omar).toHaveURL(/\/queues\//);
  });
});
