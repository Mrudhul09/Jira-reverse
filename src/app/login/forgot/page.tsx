import Link from "next/link";
import { forgotAction } from "@/app/actions/auth";
import { Banners, Card } from "@/components/ui";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";

export const metadata = { title: "Forgotten password" };

export default async function Forgot({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return (
    <main className="grid min-h-screen place-items-center bg-surface p-6">
      <Card className="w-full max-w-sm space-y-4 p-7 shadow-card">
        <h1 className="text-xl">Forgotten your password?</h1>
        <p className="text-muted">We'll email you a link to choose a new one.</p>
        <Banners sp={await searchParams} />
        <form action={forgotAction} className="space-y-4">
          <TextField id="email" name="email" type="email" label="Work email" autoComplete="username" required />
          <SubmitButton className="w-full">Send the link</SubmitButton>
        </form>
        <Link href="/login" className="block text-sm">
          Back to sign in
        </Link>
      </Card>
    </main>
  );
}
