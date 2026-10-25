import { PageHead } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Raise a request" };

// S03: stub from the shell step; built in its own commit.
export default async function Page() {
  await requireUser();
  return <PageHead title="Raise a request" intro="Coming in the next build step." />;
}
