import Link from "next/link";
import { Card } from "@/components/ui";
import { mailConfigured } from "@/lib/mail";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Card className="space-y-4 leading-6">
        <h1 className="text-xl">Privacy</h1>
        <p>IT Help is run by our IT team for people who work here. This is what it keeps and who handles it.</p>
        <h2 className="text-lg">What we keep</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your name, work email, role and teams, so you can sign in and we know who asked.</li>
          <li>What you raise and write: requests, comments, approvals and ratings.</li>
          <li>Sign-in records (time, success, network address) for 30 days, to stop password guessing.</li>
          <li>A cookie that keeps you signed in for up to 7 days. Nothing for advertising or tracking.</li>
        </ul>
        <h2 className="text-lg">Who handles it</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Our own servers, where the app and its database live.</li>
          <li>{mailConfigured() ? "Resend, which delivers our emails." : "Email delivery is not switched on yet. If it is, Resend will deliver our emails."}</li>
        </ul>
        <h2 className="text-lg">Your choices</h2>
        <p>
          Turn email updates off under “Your account”. To leave, or to have your details removed from past work, ask the IT team: an admin replaces your name and email everywhere and keeps the work
          itself.
        </p>
        <Link href="/">Back to IT Help</Link>
      </Card>
    </main>
  );
}
