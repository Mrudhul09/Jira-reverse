import Link from "next/link";
import { resetAction } from "@/app/actions/auth";
import { Banners, Card } from "@/components/ui";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { MIN_PASSWORD, resetUser } from "@/lib/auth";

export const metadata = { title: "Choose a new password" };

export default async function Reset({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const token = sp.token ?? "";
  const valid = !!token && !!resetUser(token);
  return (
    <main className="grid min-h-screen place-items-center bg-surface p-6">
      <Card className="w-full max-w-sm space-y-4 p-7 shadow-card">
        <h1 className="text-xl">Choose a new password</h1>
        <Banners sp={sp} />
        {valid ? (
          <form action={resetAction} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <TextField id="password" name="password" type="password" label="New password" autoComplete="new-password" minLength={MIN_PASSWORD} required hint={`At least ${MIN_PASSWORD} characters.`} />
            <TextField id="confirm" name="confirm" type="password" label="Type it again" autoComplete="new-password" minLength={MIN_PASSWORD} required />
            <SubmitButton className="w-full">Save new password</SubmitButton>
          </form>
        ) : (
          <p className="text-muted">
            This link has expired or was already used. <Link href="/login/forgot">Ask for a new one</Link>.
          </p>
        )}
      </Card>
    </main>
  );
}
