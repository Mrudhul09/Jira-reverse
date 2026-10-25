import { PageHead } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "My requests" };

// S04: stub from the shell step; built in its own commit.
export default async function Page() {
  await requireUser();
  return <PageHead title="My requests" intro="Coming in the next build step." />;
}
