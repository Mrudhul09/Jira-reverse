import { changePasswordAction, emailPrefsAction, signOutEverywhereAction } from "@/app/actions/auth";
import { Banners, PageHead, Panel } from "@/components/ui";
import { Checkbox, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";
import { MIN_PASSWORD, requireUser } from "@/lib/auth";
import { get } from "@/lib/db";

export const metadata = { title: "Your account" };

export default async function Account({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const prefs = get<{ email_notifications: number }>("select email_notifications from users where id = ?", user.id)!;
  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 md:px-6">
      <Banners sp={await searchParams} />
      <PageHead title="Your account" intro={`${user.name} · ${user.email}`} />
      <Panel title="Email updates">
        <form action={emailPrefsAction} className="flex flex-wrap items-center justify-between gap-3">
          <Checkbox name="email" defaultChecked={!!prefs.email_notifications} label="Email me when something needs me or changes on my requests" />
          <SubmitButton size="sm" variant="secondary">
            Save
          </SubmitButton>
        </form>
      </Panel>
      <Panel title="Change password">
        <form action={changePasswordAction} className="space-y-3">
          <TextField id="current" name="current" type="password" label="Current password" autoComplete="current-password" required />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id="password" name="password" type="password" label="New password" autoComplete="new-password" minLength={MIN_PASSWORD} required hint={`At least ${MIN_PASSWORD} characters.`} />
            <TextField id="confirm" name="confirm" type="password" label="Type it again" autoComplete="new-password" minLength={MIN_PASSWORD} required />
          </div>
          <SubmitButton size="sm">Change password</SubmitButton>
        </form>
      </Panel>
      <Panel title="Devices">
        <form action={signOutEverywhereAction} className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Lost a laptop or phone? Sign out everywhere, including here.</p>
          <SubmitButton size="sm" variant="danger">
            Sign out everywhere
          </SubmitButton>
        </form>
      </Panel>
    </main>
  );
}
