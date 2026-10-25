import { notFound } from "next/navigation";
import { Avatar, Banner, Button, Card, EmptyState, Kv, LinkButton, Lozenge, PageHead, Panel, Person, PriorityMark, TabLinks } from "@/components/ui";
import { Checkbox, SelectField, TextArea, TextField } from "@/components/ui/field";
import { SlaBadge } from "@/components/ui/sla-badge";
import { SubmitButton } from "@/components/ui/submit";
import { Table, Td, Th, Tr } from "@/components/ui/table";

export const metadata = { title: "Design system" };

const H = 3_600_000;

// The design-system check from replica-design: every primitive, every state, one page.
export default function DesignPage() {
  if (process.env.NODE_ENV === "production" && process.env.SHOW_DESIGN_PAGE !== "1") notFound();
  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      <PageHead title="Design system" intro="Tokens from replica/design/tokens.json. Placeholder accent until /replica-brand." />

      <section className="space-y-3">
        <h2>Buttons</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="subtle">Subtle</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="primary" size="sm">
            Small
          </Button>
          <LinkButton href="/design">Link button</LinkButton>
          <form>
            <SubmitButton>Submit (shows progress)</SubmitButton>
          </form>
        </div>
      </section>

      <section className="space-y-3">
        <h2>Status, priority, SLA</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Lozenge tone="todo">Waiting for support</Lozenge>
          <Lozenge tone="inprogress">In progress</Lozenge>
          <Lozenge tone="done">Resolved</Lozenge>
          <Lozenge tone="bad">Declined</Lozenge>
          <Lozenge tone="warning">Internal</Lozenge>
          <Lozenge tone="accent">Everyone</Lozenge>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {[1, 2, 3, 4, 5].map((p) => (
            <PriorityMark key={p} value={p} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlaBadge sla={{ name: "Time to resolution", goalMs: 8 * H, remainingMs: 5 * H, state: "running", warning: false, calendar: "24/7" }} />
          <SlaBadge sla={{ name: "Time to resolution", goalMs: 8 * H, remainingMs: 0.5 * H, state: "running", warning: true, calendar: "24/7" }} />
          <SlaBadge sla={{ name: "Time to resolution", goalMs: 8 * H, remainingMs: 3 * H, state: "paused", warning: false, calendar: "Business hours" }} />
          <SlaBadge sla={{ name: "Time to first response", goalMs: H, remainingMs: 0.4 * H, state: "met", warning: false, calendar: "24/7" }} />
          <SlaBadge sla={{ name: "Time to resolution", goalMs: 4 * H, remainingMs: -2 * H, state: "breached", warning: false, calendar: "24/7" }} />
        </div>
      </section>

      <section className="space-y-3">
        <h2>Fields</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField id="d-name" label="Summary" required placeholder="What do you need?" hint="A short description." />
          <TextField id="d-bad" label="Email" defaultValue="not-an-email" error="Enter a valid email address." />
          <SelectField id="d-sel" label="Priority" placeholder="Choose…" options={[1, 2, 3, 4, 5].map((p) => ({ value: p, label: `P${p}` }))} />
          <TextField id="d-dis" label="Disabled" disabled defaultValue="Read only" />
          <TextArea id="d-ta" label="Details" className="md:col-span-2" />
          <Checkbox label="Major incident" />
        </div>
      </section>

      <section className="space-y-3">
        <h2>Banners</h2>
        <Banner tone="error">That email and password don't match an active account.</Banner>
        <Banner tone="ok">Request raised.</Banner>
        <Banner tone="info">This change overlaps SH-12 in the change calendar.</Banner>
      </section>

      <section className="space-y-3">
        <h2>Tabs, panels, people</h2>
        <TabLinks label="Example" current="open" tabs={[{ key: "open", label: "Open", href: "/design" }, { key: "closed", label: "Closed", href: "/design" }]} />
        <div className="grid gap-4 md:grid-cols-3">
          <Card>Card</Card>
          <Card sunken>Sunken card</Card>
          <Panel title="Panel" actions={<Button size="sm">Save</Button>}>
            <Kv rows={[["Assignee", <Person key="p" name="Alex Morgan" />], ["Reporter", <Person key="q" name={null} empty="Nobody" />]]} />
          </Panel>
        </div>
        <div className="flex items-center gap-2">
          <Avatar name="Sam Example" /> <Avatar name={null} />
        </div>
      </section>

      <section className="space-y-3">
        <h2>Table and empty state</h2>
        <Table>
          <thead>
            <tr>
              <Th>Key</Th>
              <Th>Summary</Th>
              <Th>Status</Th>
              <Th>Priority</Th>
            </tr>
          </thead>
          <tbody>
            <Tr>
              <Td className="whitespace-nowrap font-mono text-sm">SH-1</Td>
              <Td>A very long summary that wraps onto two lines when the screen is narrow enough to need it</Td>
              <Td>
                <Lozenge tone="inprogress">In progress</Lozenge>
              </Td>
              <Td>
                <PriorityMark value={2} short />
              </Td>
            </Tr>
          </tbody>
        </Table>
        <Card>
          <EmptyState title="Nothing here">This queue is clear.</EmptyState>
        </Card>
      </section>
    </main>
  );
}
