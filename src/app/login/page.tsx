import { LifeBuoy } from "lucide-react";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { isAgent } from "@/lib/access";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_PASSWORD } from "@/lib/seed";
import { SignInForm } from "./SignInForm";

export const metadata = { title: "Sign in" };

const DEMO: [string, string][] = [
  ["admin@example.org", "admin"],
  ["omar@example.org", "agent, on call for Infrastructure"],
  ["lena@example.org", "agent, Network"],
  ["theo@example.org", "employee"],
  ["ravi@example.org", "employee who approves equipment"],
];

export default async function SignIn() {
  db();
  const user = await currentUser();
  if (user) redirect(isAgent(user) ? "/queues" : "/portal");
  const demo = process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_ACCOUNTS === "1";
  return (
    <main className="grid min-h-screen place-items-center bg-surface p-6">
      <Card className="w-full max-w-sm space-y-5 p-7 shadow-card">
        <div className="flex items-center gap-2 text-lg font-bold">
          <LifeBuoy aria-hidden="true" className="size-6 text-accent" /> IT Help
        </div>
        <div>
          <h1 className="text-xl">Sign in</h1>
          <p className="text-muted">Get help, or help someone else.</p>
        </div>
        <SignInForm />
        {demo ? (
          <div className="rounded-md bg-surface p-3 text-sm">
            <strong>Demo accounts</strong> · password <code className="font-mono">{DEMO_PASSWORD}</code>
            <ul className="mt-1.5 space-y-0.5">
              {DEMO.map(([email, role]) => (
                <li key={email}>
                  <span className="font-mono">{email}</span> <span className="text-muted">{role}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </main>
  );
}
