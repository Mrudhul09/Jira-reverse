import { Bell, Eye, ListChecks } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Card, LinkButton } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Welcome" };

const FEATURES = [
  { icon: Eye, title: "What to expect, in plain words", text: "Every request says when you'll hear back and when it should be fixed, and tells you if we're running late." },
  { icon: ListChecks, title: "Who has it, and what it's waiting on", text: "See who's looking after your request, and the status of any bigger issue it's part of." },
  { icon: Bell, title: "Only the emails you want", text: "Pick which updates reach your inbox. Everything else is still on the request's page." },
];

const FAQ = [
  ["Do I need a new password?", "Yes: IT will send you a sign-in. If you forget it, use “Forgotten your password?” on the sign-in page."],
  ["Can I still email IT?", "Not yet. Ask through the help center so your request is tracked and you can follow it."],
  ["Will my old tickets move over?", "No. Anything still open is raised again here by the IT team, so you don't have to."],
  ["Who sees what I write?", "The IT team. Their internal notes stay internal, and nobody else at work sees your requests."],
];

// The internal launch page: what's better, for everyone at the company.
export default function Welcome() {
  return (
    <main className="mx-auto max-w-4xl space-y-12 px-4 py-10 md:px-6">
      <section className="space-y-4 text-center">
        <div className="text-accent">
          <Logo markClass="size-8" />
        </div>
        <h1>Ask for help, and always see where it's at.</h1>
        <p className="mx-auto max-w-2xl text-lg text-muted">
          {APP_NAME} is our new IT help desk. You'll know who has your request, when to expect a reply, and what it's waiting on.
        </p>
        <LinkButton href="/login" variant="primary">
          Sign in
        </LinkButton>
      </section>

      <section className="space-y-3">
        <h2>Why we changed</h2>
        <p className="text-muted">
          Asking IT for help used to mean sending something off and waiting to hear. You couldn't tell who had it or when it would be done, and the emails you did get were often the wrong
          ones.
        </p>
      </section>

      <section className="space-y-3">
        <h2>How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {["Pick what you need in the help center.", "Say what's going on; we may suggest an answer straight away.", "Follow it on one page until it's sorted."].map((t, i) => (
            <li key={t}>
              <Card className="h-full">
                <span className="text-sm font-semibold text-accent">Step {i + 1}</span>
                <p className="mt-1">{t}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2>What's better</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="space-y-2">
              <Icon aria-hidden="true" className="size-5 text-accent" />
              <h3>{title}</h3>
              <p className="text-sm text-muted">{text}</p>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted">Plus everything you'd expect: approvals, help articles, and updates in the app.</p>
      </section>

      <section className="space-y-3">
        <h2>Questions</h2>
        <dl className="space-y-3">
          {FAQ.map(([q, a]) => (
            <div key={q}>
              <dt className="font-semibold">{q}</dt>
              <dd className="text-muted">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="text-center">
        <LinkButton href="/login" variant="primary">
          Sign in to {APP_NAME}
        </LinkButton>
      </section>
    </main>
  );
}
